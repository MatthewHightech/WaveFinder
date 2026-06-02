"""Export YOLO dataset from DB and train YOLOv8 small on MPS."""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from wavefinder.config import settings
from wavefinder.db import get_conn, update_job


def run_train_job(job_id: str) -> None:
    update_job(job_id, status="running", progress=0)

    try:
        dataset_dir = _export_yolo_dataset()
        if dataset_dir is None:
            update_job(
                job_id,
                status="failed",
                error="Need at least 100 positive labels and 200 empty chips before training.",
            )
            return

        version = datetime.now(timezone.utc).strftime("v%Y%m%d-%H%M%S")
        weights_dir = settings.models_dir / version
        weights_dir.mkdir(parents=True, exist_ok=True)

        from ultralytics import YOLO

        model = YOLO("yolov8s.pt")
        results = model.train(
            data=str(dataset_dir / "data.yaml"),
            imgsz=settings.chip_size_px,
            epochs=50,
            batch=8,
            device="mps",
            project=str(settings.models_dir),
            name=version,
            exist_ok=True,
        )

        best = Path(results.save_dir) / "weights" / "best.pt"
        dest = weights_dir / "best.pt"
        if best.exists():
            shutil.copy(best, dest)

        metrics = {}
        if hasattr(results, "results_dict") and results.results_dict:
            metrics = {k: float(v) for k, v in results.results_dict.items() if isinstance(v, (int, float))}

        model_version_id = _register_model(version, str(dest), metrics)

        update_job(
            job_id,
            status="done",
            progress=100,
            result={"model_version": version, "model_version_id": model_version_id, "metrics": metrics},
        )
    except Exception as e:
        update_job(job_id, status="failed", error=str(e))


def _register_model(version: str, weights_path: str, metrics: dict) -> str:
    import uuid

    mid = str(uuid.uuid4())
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO model_versions (id, version, weights_path, metrics)
            VALUES (%s, %s, %s, %s)
            """,
            (mid, version, weights_path, json.dumps(metrics)),
        )
        conn.commit()
    return mid


def _export_yolo_dataset() -> Path | None:
    """Build YOLO layout under data/yolo-export."""
    with get_conn() as conn:
        pos = conn.execute(
            """
            SELECT c.chip_key, c.bounds, l.bbox, c.image_path
            FROM labels l
            JOIN chips c ON c.id = l.chip_id
            """
        ).fetchall()
        empty_count = conn.execute(
            "SELECT count(*) AS n FROM chips WHERE is_empty = true"
        ).fetchone()["n"]

    if len(pos) < 100 or empty_count < 200:
        return None

    export = settings.data_dir / "yolo-export"
    for split in ("train", "val"):
        (export / "images" / split).mkdir(parents=True, exist_ok=True)
        (export / "labels" / split).mkdir(parents=True, exist_ok=True)

    # Simple 80/20 split
    for i, row in enumerate(pos):
        split = "train" if i % 5 else "val"
        _copy_chip_row(row, export, split, has_box=True)

    with get_conn() as conn:
        empties = conn.execute(
            "SELECT chip_key, bounds, image_path FROM chips WHERE is_empty = true LIMIT 500"
        ).fetchall()

    for i, row in enumerate(empties):
        split = "train" if i % 5 else "val"
        _copy_chip_row(row, export, split, has_box=False)

    yaml = export / "data.yaml"
    yaml.write_text(
        f"path: {export.resolve()}\n"
        "train: images/train\n"
        "val: images/val\n"
        "names:\n  0: potential_break\n"
        "nc: 1\n"
    )
    return export


def _copy_chip_row(row: dict, export: Path, split: str, has_box: bool) -> None:
    from wavefinder.geo.chips import ChipSpec
    from wavefinder.sentinel.fetch import chip_image_path, fetch_chip_rgb

    bounds = row["bounds"]
    chip = ChipSpec(
        chip_key=row["chip_key"],
        west=bounds["west"],
        south=bounds["south"],
        east=bounds["east"],
        north=bounds["north"],
    )
    src = fetch_chip_rgb(chip)
    dst_img = export / "images" / split / f"{chip.chip_key}.png"
    shutil.copy(src, dst_img)

    dst_lbl = export / "labels" / split / f"{chip.chip_key}.txt"
    if has_box and row.get("bbox"):
        b = row["bbox"]
        # YOLO normalized cx,cy,w,h
        cx = (b["x"] + b["width"] / 2) / settings.chip_size_px
        cy = (b["y"] + b["height"] / 2) / settings.chip_size_px
        w = b["width"] / settings.chip_size_px
        h = b["height"] / settings.chip_size_px
        dst_lbl.write_text(f"0 {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n")
    else:
        dst_lbl.write_text("")
