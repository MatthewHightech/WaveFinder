#!/usr/bin/env python3
"""Delete placeholder chip PNGs so they are re-fetched as real imagery."""

from pathlib import Path

from wavefinder.config import settings
from wavefinder.sentinel.fetch import _has_excessive_black_pixels, _is_placeholder_file


def main() -> None:
    chips_dir = settings.data_dir / "chips"
    if not chips_dir.exists():
        print("No chips directory")
        return
    removed = 0
    for path in chips_dir.glob("*.png"):
        if _is_placeholder_file(path) or _has_excessive_black_pixels(path):
            path.unlink()
            removed += 1
    print(f"Removed {removed} bad chip(s). Reload labeling pages to refetch.")


if __name__ == "__main__":
    main()
