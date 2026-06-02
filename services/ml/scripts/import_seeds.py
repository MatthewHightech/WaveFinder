#!/usr/bin/env python3
"""
Import surf spot seeds from a GeoJSON or CSV file into seed_imports.

Example GeoJSON feature properties: { "name": "Mavericks", "source": "osm" }

Usage:
  python scripts/import_seeds.py --file seeds.geojson
"""

from __future__ import annotations

import argparse
import json
import math
import uuid
from datetime import datetime, timezone

import psycopg
from psycopg.rows import dict_row

from wavefinder.config import settings

DEDUP_M = 100.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def load_features(path: str) -> list[dict]:
    with open(path) as f:
        data = json.load(f)
    if data.get("type") == "FeatureCollection":
        return data["features"]
    if isinstance(data, list):
        return data
    raise ValueError("Expected GeoJSON FeatureCollection or list of features")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    args = parser.parse_args()

    features = load_features(args.file)
    inserted = 0
    skipped = 0

    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        existing = conn.execute("SELECT lat, lon FROM seed_imports").fetchall()

        for feat in features:
            props = feat.get("properties", feat)
            geom = feat.get("geometry", {})
            if geom.get("type") == "Point":
                lon, lat = geom["coordinates"][:2]
            else:
                lat = props.get("lat") or props.get("latitude")
                lon = props.get("lon") or props.get("longitude")
            if lat is None or lon is None:
                continue

            name = props.get("name") or "Unknown"
            source = props.get("source") or "import"

            if any(haversine_m(lat, lon, e["lat"], e["lon"]) < DEDUP_M for e in existing):
                skipped += 1
                continue

            conn.execute(
                """
                INSERT INTO seed_imports (id, name, lat, lon, source, status, created_at)
                VALUES (%s, %s, %s, %s, %s, 'pending', %s)
                """,
                (str(uuid.uuid4()), name, lat, lon, source, datetime.now(timezone.utc)),
            )
            existing.append({"lat": lat, "lon": lon})
            inserted += 1

        conn.commit()

    print(f"Inserted {inserted}, skipped {skipped} (within {DEDUP_M}m)")


if __name__ == "__main__":
    main()
