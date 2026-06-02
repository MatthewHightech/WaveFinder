# WaveFinder

Discover potential surf breaks from **Sentinel-2** imagery using **YOLO** object detection, with a **Mapbox** map UI for labeling and on-demand coastal scans.

## Architecture

| Layer | Tech | Deploy target |
|-------|------|----------------|
| Web | Next.js 15 + Tailwind + Mapbox GL | **Vercel** |
| Database | PostgreSQL + PostGIS (Drizzle) | Local Docker → **Neon** (for Vercel) |
| ML worker | Python FastAPI + Ultralytics + GeoPandas | **Local M3** → Railway / Fly (not Vercel) |

**Important:** Vercel serverless cannot run long YOLO training or multi-tile scans. The Next.js app calls `ML_WORKER_URL` for scan/train jobs.

## Prerequisites

- [Bun](https://bun.sh) 1.1+
- [Docker](https://www.docker.com) (PostGIS)
- Python 3.11+ (ML worker)
- Mapbox access token ([create one](https://account.mapbox.com/access-tokens/))

## Quick start

```bash
# 1. Install JS deps
bun install

# 2. Start PostGIS
bun run docker:up

# 3. Migrate database
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local — set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

export DATABASE_URL=postgresql://wavefinder:wavefinder@localhost:5432/wavefinder
bun run db:migrate

# 4. Python ML worker
cd services/ml
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp ../../.env.example .env   # optional; defaults work locally
uvicorn wavefinder.main:app --reload --port 8000

# 5. Web app (new terminal, repo root)
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | `apps/web/.env.local` | Map UI |
| `DATABASE_URL` | web + ml | Postgres |
| `ML_WORKER_URL` | `apps/web/.env.local` | Default `http://localhost:8000` |

Sentinel-2 chips use [Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/) STAC (no key for basic use). Placeholder tiles are generated if STAC fetch fails.

## v1 product spec

See the grill session outcomes in project docs:

- Single class `potential_break`, 512×512 chips, 25% overlap
- Scan: coastal tiles only, 200 m shoreline buffer, max ~25 km span
- Pins: global, score > 0.2, dedup 100 m, raw score shown
- Training gate: 100 positives + 200 empty chips
- Branch C later: `suppressed` flag for bathy/swell

## Seed import

```bash
cd services/ml
source .venv/bin/activate
python scripts/import_seeds.py --file your_spots.geojson
```

## Deploying to Vercel (later)

1. Create a **Neon** (or Supabase) Postgres with PostGIS; set `DATABASE_URL` in Vercel.
2. Deploy **ML worker** to Railway/Fly; set `ML_WORKER_URL` in Vercel.
3. Connect the Git repo; set root directory to `apps/web` or configure monorepo build.
4. Add `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in Vercel env.
5. Do **not** run train/scan inside Vercel functions — always proxy to the worker.

`apps/web/vercel.json` documents expected env var names.

## Project layout

```
apps/web/          Next.js UI + API routes
packages/db/       Drizzle schema + migrations
services/ml/       FastAPI worker, geo, Sentinel, YOLO
docker-compose.yml Local PostGIS
```

## License note

Ultralytics YOLO is AGPL-3.0. Personal non-commercial use is fine; commercialize later only with a license plan.
