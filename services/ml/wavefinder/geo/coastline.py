"""
Coastline corridor for chip gating.

v1: Natural Earth 10m land polygons (bundled download on first use).
Future: OSM land polygons with Natural Earth fallback for remote gaps.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

import geopandas as gpd
import shapely
from shapely.geometry import box
from shapely.geometry.base import BaseGeometry

from wavefinder.config import settings

# WCNA: Alaska → southern Baja + Hawaii
WCNA_BBOX = (-170.0, 18.0, -117.0, 72.0)

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


def repair_geometry(geom: BaseGeometry) -> BaseGeometry:
    """Fix invalid Natural Earth polygons so GEOS ops do not throw."""
    if geom is None or geom.is_empty:
        return geom
    if not geom.is_valid:
        geom = shapely.make_valid(geom)
    # buffer(0) cleans remaining self-intersections from projection/buffer
    cleaned = geom.buffer(0)
    return cleaned if not cleaned.is_empty else geom


def load_coastline_corridor(
    west: float,
    south: float,
    east: float,
    north: float,
    buffer_m: float | None = None,
) -> gpd.GeoDataFrame:
    """
    Land polygons clipped to viewport ∩ WCNA, buffered in EPSG:3857.
    """
    buffer_m = buffer_m if buffer_m is not None else settings.coast_buffer_m

    shp = _ensure_natural_earth_land()
    land = gpd.read_file(shp)
    land = land.to_crs(epsg=4326)

    viewport = box(west, south, east, north)
    wcna = box(*WCNA_BBOX)
    clip_geom = viewport.intersection(wcna)

    if clip_geom.is_empty:
        return gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")

    clipped = land[land.intersects(clip_geom)].copy()
    if clipped.empty:
        return clipped

    clipped = clipped.to_crs(epsg=3857)
    clipped["geometry"] = clipped.geometry.map(repair_geometry).map(
        lambda g: g.buffer(buffer_m) if not g.is_empty else g
    )
    clipped = clipped[~clipped.geometry.is_empty]
    clipped = clipped.to_crs(epsg=4326)
    clipped["geometry"] = clipped.geometry.map(repair_geometry)
    return clipped


def corridor_intersects_box(gdf: gpd.GeoDataFrame, target: BaseGeometry) -> bool:
    """
    True if any buffered land polygon intersects target — no unary_union (avoids GEOS topology errors).
    """
    if gdf.empty or target.is_empty:
        return False

    try:
        idx = list(gdf.sindex.query(target, predicate="intersects"))
        candidates = gdf.iloc[idx] if idx else gdf
    except Exception:
        candidates = gdf

    for geom in candidates.geometry:
        if geom is None or geom.is_empty:
            continue
        try:
            if repair_geometry(geom).intersects(target):
                return True
        except shapely.GEOSException:
            continue
    return False


def point_in_wcna(lat: float, lon: float) -> bool:
    west, south, east, north = WCNA_BBOX
    return west <= lon <= east and south <= lat <= north
