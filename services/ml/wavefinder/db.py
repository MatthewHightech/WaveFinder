"""Minimal Postgres access for the ML worker (mirrors Drizzle schema)."""

from __future__ import annotations

import json
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any

import psycopg
from psycopg.rows import dict_row

from wavefinder.config import settings


@contextmanager
def get_conn():
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        yield conn


def update_job(
    job_id: str,
    *,
    status: str | None = None,
    tile_count: int | None = None,
    progress: int | None = None,
    result: dict | None = None,
    error: str | None = None,
) -> None:
    sets: list[str] = []
    params: list[Any] = []

    def add(col: str, val: Any):
        sets.append(f"{col} = %s")
        params.append(val)

    if status is not None:
        add("status", status)
        if status == "running":
            add("started_at", datetime.now(timezone.utc))
        if status in ("done", "failed"):
            add("finished_at", datetime.now(timezone.utc))
    if tile_count is not None:
        add("tile_count", tile_count)
    if progress is not None:
        add("progress", progress)
    if result is not None:
        add("result", json.dumps(result))
    if error is not None:
        add("error", error)

    if not sets:
        return

    params.append(job_id)
    sql = f"UPDATE jobs SET {', '.join(sets)} WHERE id = %s"

    with get_conn() as conn:
        conn.execute(sql, params)
        conn.commit()


def upsert_pin(lat: float, lon: float, score: float, model_version_id: str | None) -> None:
    """Update in place if within 100m and score is higher; else insert."""
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, score FROM pins
            WHERE NOT suppressed
              AND (
                6371000 * acos(
                  least(1, greatest(-1,
                    sin(radians(%s)) * sin(radians(lat))
                    + cos(radians(%s)) * cos(radians(lat))
                    * cos(radians(lon) - radians(%s))
                  ))
                )
              ) < %s
            ORDER BY score DESC
            LIMIT 1
            """,
            (lat, lat, lon, settings.pin_dedup_m),
        ).fetchone()

        now = datetime.now(timezone.utc)
        if row and score > row["score"]:
            conn.execute(
                """
                UPDATE pins SET score = %s, model_version_id = %s, updated_at = %s
                WHERE id = %s
                """,
                (score, model_version_id, now, row["id"]),
            )
        elif row:
            return
        else:
            conn.execute(
                """
                INSERT INTO pins (id, lat, lon, score, model_version_id, suppressed, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, false, %s, %s)
                """,
                (str(uuid.uuid4()), lat, lon, score, model_version_id, now, now),
            )
        conn.commit()
