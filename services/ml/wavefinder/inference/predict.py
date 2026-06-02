"""YOLO inference on a single chip; returns geo-located detections."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from wavefinder.config import settings
from wavefinder.geo.chips import ChipSpec


@dataclass
class Detection:
    lat: float
    lon: float
    score: float


def _latest_weights() -> Path | None:
    models = sorted(settings.models_dir.glob("*/best.pt"), key=lambda p: p.stat().st_mtime)
    return models[-1] if models else None


def predict_chip(image_path: Path, chip: ChipSpec) -> list[Detection]:
    weights = _latest_weights()
    if weights is None:
        # No model yet — no-op
        return []

    from ultralytics import YOLO

    model = YOLO(str(weights))
    results = model.predict(
        str(image_path),
        imgsz=settings.chip_size_px,
        conf=settings.pin_score_threshold,
        verbose=False,
    )

    detections: list[Detection] = []
    for r in results:
        if r.boxes is None:
            continue
        for box in r.boxes:
            xyxy = box.xyxy[0].tolist()
            cx = (xyxy[0] + xyxy[2]) / 2 / settings.chip_size_px
            cy = (xyxy[1] + xyxy[3]) / 2 / settings.chip_size_px
            lon = chip.west + cx * (chip.east - chip.west)
            lat = chip.south + cy * (chip.north - chip.south)
            detections.append(Detection(lat=lat, lon=lon, score=float(box.conf[0])))

    return detections
