# Labeling workflow

Goal: **100 positive bboxes** + **200 empty chips**, then train at [/train](http://localhost:3000/train).

## Daily loop (recommended)

1. **Import seeds** (once, then occasionally)
2. **Review queue** — approve known spots with bboxes
3. **Empty chips** — fast negatives (~2× positives)
4. **Free explore** — extra positives where you know the coast

## 1. Import seed spots

```bash
cd services/ml && source .venv/bin/activate
python scripts/import_seeds.py --file ../../data/sample-seeds.geojson
```

Use your own GeoJSON `FeatureCollection` with `properties.name`, `properties.source`, and `Point` geometry. Duplicates within 100 m are skipped.

## 2. Review queue (`/label/review`)

- Loads the next pending seed
- Fetches a Sentinel chip centered on the point (may use placeholder tiles until STAC is wired)
- Draw a bbox on the visible break feature → **Save label**
- **Reject** if the listing is wrong

## 3. Empty chip queue (`/label/empty`)

- Random coastal chip in WCNA
- **Nothing here (empty)** — counts toward the 200 negatives
- Or draw a bbox if you see a break (counts as positive)

## 4. Free explore (`/label/explore`)

- Paste lat/lon from the Finder map
- **Load chip** → draw bbox → save

## 5. Train

When the sidebar shows **Ready to train**, open `/train` and start a job (ML worker must be running).

## Tips

- Label only features visible in the imagery (reef, bar, plume) — not foam/swell (Branch C later).
- Mix regions as you go; random train split is OK for v1.
- First chip fetch may download Natural Earth coastline data (~few MB).
