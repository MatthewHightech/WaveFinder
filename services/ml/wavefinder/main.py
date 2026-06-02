"""
FastAPI ML worker — run locally; deploy separately from Vercel.

Vercel hosts Next.js only. Point ML_WORKER_URL to this service (Railway, Fly, etc.).
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, Field

from wavefinder import __version__
from wavefinder.config import settings
from wavefinder.geo.chips import enumerate_coastal_chips, validate_scan_extent
from wavefinder.jobs.scan import run_scan_job
from wavefinder.jobs.train import run_train_job
from wavefinder.routes.chips import router as chips_router

app = FastAPI(title="WaveFinder ML", version=__version__)
app.include_router(chips_router)
_executor = ThreadPoolExecutor(max_workers=1)


class ScanPreviewRequest(BaseModel):
    west: float
    south: float
    east: float
    north: float


class ScanPreviewResponse(BaseModel):
    tile_count: int
    error: str | None = None


class ScanRequest(ScanPreviewRequest):
    job_id: UUID


class TrainRequest(BaseModel):
    job_id: UUID


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": __version__,
        "chip_size_px": settings.chip_size_px,
        "gsd_m": settings.gsd_m,
    }


@app.post("/scan/preview", response_model=ScanPreviewResponse)
def scan_preview(body: ScanPreviewRequest):
    err = validate_scan_extent(body.west, body.south, body.east, body.north)
    if err:
        return ScanPreviewResponse(tile_count=0, error=err)
    chips = enumerate_coastal_chips(body.west, body.south, body.east, body.north)
    return ScanPreviewResponse(tile_count=len(chips))


@app.post("/scan")
def scan(body: ScanRequest, background_tasks: BackgroundTasks):
    err = validate_scan_extent(body.west, body.south, body.east, body.north)
    if err:
        raise HTTPException(status_code=400, detail=err)

    background_tasks.add_task(
        run_scan_job,
        str(body.job_id),
        body.west,
        body.south,
        body.east,
        body.north,
    )
    chips = enumerate_coastal_chips(body.west, body.south, body.east, body.north)
    return {"accepted": True, "job_id": str(body.job_id), "tile_count": len(chips)}


@app.post("/train")
def train(body: TrainRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_train_job, str(body.job_id))
    return {"accepted": True, "job_id": str(body.job_id)}


@app.on_event("shutdown")
def shutdown():
    _executor.shutdown(wait=False)
