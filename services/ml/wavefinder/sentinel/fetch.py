"""
Fetch Sentinel-2 RGB composite chips via Microsoft Planetary Computer STAC.

Requires: pip install planetary-computer (and `import planetary_computer` before stackstac)
For v1 scaffold, chip fetch is stubbed until PC signup/assets are wired in training loop.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from wavefinder.config import settings
from wavefinder.geo.chips import ChipSpec


def chip_image_path(chip: ChipSpec) -> Path:
    return settings.data_dir / "chips" / f"{chip.chip_key}.png"


def fetch_chip_rgb(chip: ChipSpec, force: bool = False) -> Path:
    """
    Return path to a 512x512 RGB PNG for the chip bounds.
    Downloads via STAC when stackstac + planetary_computer are available.
    """
    out = chip_image_path(chip)
    out.parent.mkdir(parents=True, exist_ok=True)

    if out.exists() and not force:
        return out

    try:
        return _fetch_from_planetary_computer(chip, out)
    except Exception:
        # Placeholder tile for UI/dev without STAC wired
        return _write_placeholder(chip, out)


def _write_placeholder(chip: ChipSpec, out: Path) -> Path:
    from PIL import Image

    # Coastal-ish gradient placeholder (clearly not real imagery)
    arr = np.zeros((settings.chip_size_px, settings.chip_size_px, 3), dtype=np.uint8)
    arr[:, : settings.chip_size_px // 3] = (30, 80, 140)  # water
    arr[:, settings.chip_size_px // 3 :] = (210, 200, 170)  # land
    Image.fromarray(arr).save(out)
    return out


def _fetch_from_planetary_computer(chip: ChipSpec, out: Path) -> Path:
    import planetary_computer
    import stackstac
    from PIL import Image

    planetary_computer.sign_inplace()

    bbox = [chip.west, chip.south, chip.east, chip.north]
    catalog_url = settings.stac_url

    import pystac_client

    catalog = pystac_client.Client.open(catalog_url, modifier=planetary_computer.sign_inplace)
    search = catalog.search(
        collections=["sentinel-2-l2a"],
        bbox=bbox,
        query={"eo:cloud_cover": {"lt": 30}},
        max_items=3,
    )
    items = list(search.items())
    if not items:
        return _write_placeholder(chip, out)

    data = stackstac.stack(
        items,
        assets=["red", "green", "blue"],
        bounds_latlon=bbox,
        resolution=settings.gsd_m,
        epsg=3857,
    )
    # Median composite across time
    rgb = data.median(dim="time").compute()
    rgb = rgb.transpose("y", "x", "band").values
    rgb = np.clip(rgb / 3000.0 * 255, 0, 255).astype(np.uint8)

    img = Image.fromarray(rgb)
    img = img.resize((settings.chip_size_px, settings.chip_size_px))
    img.save(out)
    return out
