"""
Fetch Sentinel-2 RGB chips via Microsoft Planetary Computer (primary)
or Mapbox satellite static tiles (labeling fallback).
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import rasterio
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds

from shapely.geometry import box

from wavefinder.config import settings
from wavefinder.geo.chips import ChipSpec

logger = logging.getLogger(__name__)


def chip_image_path(chip: ChipSpec) -> Path:
    return settings.data_dir / "chips" / f"{chip.chip_key}.png"


def _has_excessive_black_pixels(path: Path, threshold: float = 0.08) -> bool:
    """True if nodata (0,0,0) fill from partial Sentinel tiles covers too much of the chip."""
    try:
        from PIL import Image

        arr = np.array(Image.open(path).convert("RGB"))
        black = (arr[:, :, 0] == 0) & (arr[:, :, 1] == 0) & (arr[:, :, 2] == 0)
        return float(black.mean()) > threshold
    except Exception:
        return False


def _is_placeholder_file(path: Path) -> bool:
    """Detect the dev placeholder (blue water / tan land split)."""
    try:
        from PIL import Image

        im = Image.open(path).convert("RGB")
        w, h = im.size
        left = im.getpixel((w // 8, h // 2))
        right = im.getpixel((7 * w // 8, h // 2))
        return left == (30, 80, 140) and right == (210, 200, 170)
    except Exception:
        return False


def fetch_chip_rgb(chip: ChipSpec, force: bool = False) -> Path:
    """
    Return path to a 512×512 RGB PNG for the chip bounds.
    """
    out = chip_image_path(chip)
    out.parent.mkdir(parents=True, exist_ok=True)

    if (
        out.exists()
        and not force
        and not _is_placeholder_file(out)
        and not _has_excessive_black_pixels(out)
    ):
        return out

    errors: list[str] = []

    try:
        _fetch_from_planetary_computer(chip, out)
        if _has_excessive_black_pixels(out):
            raise ValueError("Sentinel tile did not fully cover chip (black fill)")
        return out
    except Exception as e:
        errors.append(f"Sentinel: {e}")
        logger.warning("Planetary Computer fetch failed: %s", e)

    try:
        return _fetch_from_mapbox(chip, out)
    except Exception as e:
        errors.append(f"Mapbox: {e}")
        logger.warning("Mapbox fetch failed: %s", e)

    logger.error("All chip sources failed (%s); writing placeholder", "; ".join(errors))
    return _write_placeholder(chip, out)


def _pick_best_sentinel_item(items: list, chip: ChipSpec):
    """Prefer the granule whose STAC bbox fully covers the chip (avoids half-black chips)."""
    chip_box = box(chip.west, chip.south, chip.east, chip.north)

    def coverage(item) -> float:
        ib = box(*item.bbox)
        return chip_box.intersection(ib).area

    return max(items, key=coverage)


def _fetch_from_planetary_computer(chip: ChipSpec, out: Path) -> Path:
    import planetary_computer as pc
    import pystac_client
    from PIL import Image

    catalog = pystac_client.Client.open(settings.stac_url, modifier=pc.sign_inplace)
    search = catalog.search(
        collections=["sentinel-2-l2a"],
        bbox=[chip.west, chip.south, chip.east, chip.north],
        query={"eo:cloud_cover": {"lt": 30}},
        max_items=10,
    )
    items = [pc.sign(item) for item in search.items()]
    if not items:
        raise ValueError("No Sentinel-2 scenes found for this chip")

    item = _pick_best_sentinel_item(items, chip)
    asset = item.assets.get("visual")
    if asset is None:
        raise ValueError("Scene has no visual asset")

    href = pc.sign(asset).href
    with rasterio.open(href) as src:
        proj = transform_bounds(
            "EPSG:4326",
            src.crs,
            chip.west,
            chip.south,
            chip.east,
            chip.north,
        )
        window = from_bounds(*proj, transform=src.transform)
        data = src.read(window=window, boundless=True, fill_value=0)

    bands = data.shape[0]
    rgb = np.transpose(data[: min(3, bands)], (1, 2, 0))
    if rgb.dtype != np.uint8:
        rgb = np.clip(rgb, 0, 65535)
        rgb = (rgb / 3000.0 * 255).clip(0, 255).astype(np.uint8)

    img = Image.fromarray(rgb)
    img = img.resize(
        (settings.chip_size_px, settings.chip_size_px),
        Image.Resampling.LANCZOS,
    )
    img.save(out)
    return out


def _fetch_from_mapbox(chip: ChipSpec, out: Path) -> Path:
    """Mapbox satellite static image — good for labeling when PC is slow."""
    import httpx
    from PIL import Image

    token = settings.mapbox_access_token
    if not token:
        raise ValueError("MAPBOX_ACCESS_TOKEN not set on ML worker")

    size = settings.chip_size_px
    bbox = f"[{chip.west},{chip.south},{chip.east},{chip.north}]"
    url = (
        f"https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/"
        f"{bbox}/{size}x{size}?access_token={token}&attribution=false&logo=false"
    )
    with httpx.Client(timeout=60) as client:
        resp = client.get(url)
        resp.raise_for_status()
        out.write_bytes(resp.content)

    # Normalize to exact chip size
    img = Image.open(out).convert("RGB")
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    img.save(out)
    return out


def _write_placeholder(chip: ChipSpec, out: Path) -> Path:
    from PIL import Image

    arr = np.zeros((settings.chip_size_px, settings.chip_size_px, 3), dtype=np.uint8)
    arr[:, : settings.chip_size_px // 3] = (30, 80, 140)
    arr[:, settings.chip_size_px // 3 :] = (210, 200, 170)
    Image.fromarray(arr).save(out)
    return out
