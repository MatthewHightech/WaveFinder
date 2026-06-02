"""Chip fetch and image serving."""

from __future__ import annotations

import random

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from wavefinder.config import settings
from wavefinder.geo.chips import ChipSpec, _chip_key, chip_at_point, chip_is_coastal
from wavefinder.geo.coastline import WCNA_BBOX, point_in_wcna
from wavefinder.sentinel.fetch import (
    _has_excessive_black_pixels,
    _is_placeholder_file,
    chip_image_path,
    fetch_chip_rgb,
)

router = APIRouter(prefix="/chip", tags=["chip"])


class PointRequest(BaseModel):
    lat: float
    lon: float


class BoundsRequest(BaseModel):
    west: float
    south: float
    east: float
    north: float


def _chip_to_dict(chip: ChipSpec, fetched: bool = True) -> dict:
    return {
        "chip_key": chip.chip_key,
        "bounds": {
            "west": chip.west,
            "south": chip.south,
            "east": chip.east,
            "north": chip.north,
        },
        "image_path": str(chip_image_path(chip)) if fetched else None,
    }


@router.post("/at-point")
def chip_from_point(body: PointRequest):
    if not point_in_wcna(body.lat, body.lon):
        raise HTTPException(
            status_code=400,
            detail="Point is outside the WCNA labeling region (Alaska → Baja + Hawaii)",
        )
    chip = chip_at_point(body.lat, body.lon)
    if not chip_is_coastal(chip):
        raise HTTPException(status_code=400, detail="Point is not on a coastal chip")
    path = chip_image_path(chip)
    force = not path.exists() or _is_placeholder_file(path) or _has_excessive_black_pixels(path)
    fetch_chip_rgb(chip, force=force)
    return _chip_to_dict(chip)


@router.post("/fetch")
def chip_from_bounds(body: BoundsRequest):
    chip = ChipSpec(
        chip_key=_chip_key(body.west, body.south, body.east, body.north),
        west=body.west,
        south=body.south,
        east=body.east,
        north=body.north,
    )
    if not chip_is_coastal(chip):
        raise HTTPException(status_code=400, detail="Bounds are not coastal")
    path = chip_image_path(chip)
    force = not path.exists() or _is_placeholder_file(path) or _has_excessive_black_pixels(path)
    fetch_chip_rgb(chip, force=force)
    return _chip_to_dict(chip)


@router.get("/random")
def random_coastal_chip():
    """Random coastal chip in WCNA for empty-chip labeling queue."""
    west, south, east, north = WCNA_BBOX
    for _ in range(60):
        lon = random.uniform(west, east)
        lat = random.uniform(south, north)
        chip = chip_at_point(lat, lon)
        if chip_is_coastal(chip):
            path = chip_image_path(chip)
            force = (
                not path.exists()
                or _is_placeholder_file(path)
                or _has_excessive_black_pixels(path)
            )
            fetch_chip_rgb(chip, force=force)
            return _chip_to_dict(chip)
    raise HTTPException(status_code=404, detail="Could not sample a coastal chip")


@router.get("/image/{chip_key}")
def serve_chip_image(chip_key: str):
    path = settings.data_dir / "chips" / f"{chip_key}.png"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Chip image not found")
    if _is_placeholder_file(path) or _has_excessive_black_pixels(path):
        raise HTTPException(
            status_code=503,
            detail="Chip imagery not ready; retry in a moment",
        )
    return FileResponse(
        path,
        media_type="image/png",
        headers={"Cache-Control": "no-cache"},
    )
