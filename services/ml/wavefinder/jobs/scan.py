"""On-demand scan: enumerate coastal chips, infer, upsert pins."""

from __future__ import annotations

from wavefinder.config import settings
from wavefinder.db import update_job, upsert_pin
from wavefinder.geo.chips import enumerate_coastal_chips, validate_scan_extent
from wavefinder.inference.predict import predict_chip
from wavefinder.sentinel.fetch import fetch_chip_rgb


def run_scan_job(
    job_id: str,
    west: float,
    south: float,
    east: float,
    north: float,
    model_version_id: str | None = None,
) -> None:
    err = validate_scan_extent(west, south, east, north)
    if err:
        update_job(job_id, status="failed", error=err)
        return

    chips = enumerate_coastal_chips(west, south, east, north)
    update_job(job_id, status="running", tile_count=len(chips), progress=0)

    detections_total = 0
    for i, chip in enumerate(chips):
        img_path = fetch_chip_rgb(chip)
        detections = predict_chip(img_path, chip)
        for det in detections:
            if det.score <= settings.pin_score_threshold:
                continue
            upsert_pin(det.lat, det.lon, det.score, model_version_id)
            detections_total += 1

        if (i + 1) % 5 == 0 or i == len(chips) - 1:
            update_job(job_id, progress=i + 1)

    update_job(
        job_id,
        status="done",
        progress=len(chips),
        result={"detections": detections_total, "tiles_scanned": len(chips)},
    )
