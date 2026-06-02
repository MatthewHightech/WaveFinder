"""Enumerate 512px-equivalent chips along the coastal corridor."""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass

from pyproj import Transformer
from shapely.geometry import box
from shapely.ops import transform

from wavefinder.config import settings
from wavefinder.geo.coastline import corridor_union, load_coastline_corridor


@dataclass
class ChipSpec:
    chip_key: str
    west: float
    south: float
    east: float
    north: float


def _chip_key(west: float, south: float, east: float, north: float) -> str:
    raw = f"{west:.6f},{south:.6f},{east:.6f},{north:.6f}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _meters_to_deg_lat(m: float) -> float:
    return m / 111_320.0


def _meters_to_deg_lon(m: float, lat: float) -> float:
    return m / (111_320.0 * math.cos(math.radians(lat)))


def enumerate_coastal_chips(
    west: float,
    south: float,
    east: float,
    north: float,
) -> list[ChipSpec]:
    """
    Grid chips over viewport; keep those intersecting the buffered coastline corridor.
    """
    corridor_gdf = load_coastline_corridor(west, south, east, north)
    corridor = corridor_union(corridor_gdf)
    if corridor is None or corridor.is_empty:
        return []

    size_m = settings.chip_size_m
    step_m = size_m * (1.0 - settings.overlap_fraction)

    center_lat = (south + north) / 2.0
    d_lat = _meters_to_deg_lat(size_m)
    d_lon = _meters_to_deg_lon(size_m, center_lat)
    step_lat = _meters_to_deg_lat(step_m)
    step_lon = _meters_to_deg_lon(step_m, center_lat)

    chips: list[ChipSpec] = []
    lat = south
    while lat < north:
        lon = west
        while lon < east:
            chip_box = box(lon, lat, lon + d_lon, lat + d_lat)
            if chip_box.intersects(corridor):
                chips.append(
                    ChipSpec(
                        chip_key=_chip_key(lon, lat, lon + d_lon, lat + d_lat),
                        west=lon,
                        south=lat,
                        east=lon + d_lon,
                        north=lat + d_lat,
                    )
                )
            lon += step_lon
        lat += step_lat

    return chips


def shore_span_km_approx(
    west: float,
    south: float,
    east: float,
    north: float,
) -> float:
    """
    Straight-line span along shore (v1 approximation): diagonal of viewport in km.
    Refine later with coastline polyline length.
    """
    to_m = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    x0, y0 = to_m.transform(west, south)
    x1, y1 = to_m.transform(east, north)
    return math.hypot(x1 - x0, y1 - y0) / 1000.0


def validate_scan_extent(
    west: float,
    south: float,
    east: float,
    north: float,
) -> str | None:
    """Return error message if scan should be rejected."""
    span = shore_span_km_approx(west, south, east, north)
    if span > settings.max_shore_span_km:
        return (
            f"Scan area too large ({span:.1f} km). "
            f"Maximum is {settings.max_shore_span_km:.0f} km along shore."
        )
    chips = enumerate_coastal_chips(west, south, east, north)
    if not chips:
        return "No coastal tiles found"
    return None
