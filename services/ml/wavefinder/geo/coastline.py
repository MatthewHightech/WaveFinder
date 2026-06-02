"""
Coastline corridor for chip gating.

v1: Natural Earth 10m land polygons (bundled download on first use).
Future: OSM land polygons with Natural Earth fallback for remote gaps.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

import geopandas as gpd
from shapely.geometry import box
from shapely.ops import unary_union

from wavefinder.config import settings

# WCNA rough bbox for caching (Alaska → San Diego)
WCNA_BBOX = (-170.0, 32.0, -117.0, 72.0)

NE_LAND_URL = (
    "https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip"
)


def _natural_earth_land_path() -> Path:
    return settings.coastline_cache_dir / "ne_10m_land.shp"


def _ensure_natural_earth_land() -> Path:
    shp = _natural_earth_land_path()
    if shp.exists():
        return shp

    settings.coastline_cache_dir.mkdir(parents=True, exist_ok=True)
    zip_path = settings.coastline_cache_dir / "ne_10m_land.zip"

    import httpx

    with httpx.stream("GET", NE_LAND_URL, follow_redirects=True, timeout=120) as r:
        r.raise_for_status()
        with open(zip_path, "wb") as f:
            for chunk in r.iter_bytes():
                f.write(chunk)

    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(settings.coastline_cache_dir)

    if not shp.exists():
        raise FileNotFoundError(f"Expected shapefile at {shp} after extract")

    return shp


def load_coastline_corridor(
    west: float,
    south: float,
    east: float,
    north: float,
    buffer_m: float | None = None,
) -> gpd.GeoDataFrame:
    """
    Land polygons clipped to viewport, buffered in EPSG:3857 for meter accuracy.
  """
    buffer_m = buffer_m if buffer_m is not None else settings.coast_buffer_m

    shp = _ensure_natural_earth_land()
    land = gpd.read_file(shp)
    land = land.to_crs(epsg=4326)

    viewport = box(west, south, east, north)
    wcna = box(*WCNA_BBOX)
    clip_geom = viewport.intersection(wcna)

    clipped = land[land.intersects(clip_geom)].copy()
    if clipped.empty:
        return clipped

    clipped = clipped.to_crs(epsg=3857)
    clipped["geometry"] = clipped.geometry.buffer(buffer_m)
    clipped = clipped.to_crs(epsg=4326)
    return clipped


def corridor_union(gdf: gpd.GeoDataFrame):
    if gdf.empty:
        return None
    return unary_union(gdf.geometry)
