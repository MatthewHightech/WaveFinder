"use client";

import { useCallback, useEffect, useState } from "react";
import { ChipLabeler, type BboxPixels } from "@/components/Labeling/ChipLabeler";
import { LabelingStats } from "@/components/Labeling/LabelingStats";
import { rejectSeed, upsertChipAndLabel } from "@/lib/labeling";

type Seed = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  source: string;
};

type Chip = {
  chip_key: string;
  bounds: { west: number; south: number; east: number; north: number };
};

export default function ReviewQueuePage() {
  const [seed, setSeed] = useState<Seed | null>(null);
  const [chip, setChip] = useState<Chip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsKey, setStatsKey] = useState(0);
  const [imageVersion, setImageVersion] = useState(0);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setChip(null);
    try {
      const seedRes = await fetch("/api/seeds/next");
      const { seed: nextSeed } = await seedRes.json();
      setSeed(nextSeed);
      if (!nextSeed) {
        setLoading(false);
        return;
      }
      const chipRes = await fetch("/api/chips/at-point", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: nextSeed.lat, lon: nextSeed.lon }),
      });
      const chipData = await chipRes.json();
      if (!chipRes.ok) {
        setError(chipData.error ?? "Failed to load chip");
        setLoading(false);
        return;
      }
      setChip(chipData);
      setImageVersion(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  async function save(bboxes: BboxPixels[]) {
    if (!chip || !seed || bboxes.length === 0) return;
    setSaving(true);
    try {
      await upsertChipAndLabel({
        chip,
        bboxes,
        source: "seed_review",
        seedId: seed.id,
      });
      setStatsKey((k) => k + 1);
      await loadNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function reject() {
    if (!seed) return;
    setSaving(true);
    await rejectSeed(seed.id);
    setStatsKey((k) => k + 1);
    await loadNext();
    setSaving(false);
  }

  const imageUrl = chip
    ? `/api/chips/image/${chip.chip_key}?v=${imageVersion}`
    : "";

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[1fr_220px]">
      <div>
        <h1 className="text-xl font-semibold text-teal-400">Review queue</h1>
        <p className="mt-1 text-sm text-slate-400">
          Draw a box on each break in the chip, then save — boxes need not include the imported pin.
        </p>
        {loading && <p className="mt-8 text-slate-500">Loading…</p>}
        {!loading && !seed && (
          <p className="mt-8 text-slate-500">
            No pending seeds. Import spots with{" "}
            <code className="text-teal-400">python scripts/import_seeds.py</code>
          </p>
        )}
        {error && <p className="mt-4 text-sm text-amber-400">{error}</p>}
        {seed && chip && !loading && (
          <div className="mt-6">
            <ChipLabeler
              imageUrl={imageUrl}
              title={seed.name}
              subtitle={`${seed.source} · ${seed.lat.toFixed(4)}, ${seed.lon.toFixed(4)}`}
              onSave={save}
              onSkip={loadNext}
              saving={saving}
            />
            <button
              type="button"
              disabled={saving}
              onClick={reject}
              className="mt-4 text-sm text-amber-400 hover:text-amber-300"
            >
              Reject seed (not a valid spot)
            </button>
          </div>
        )}
      </div>
      <LabelingStats refreshKey={statsKey} />
    </div>
  );
}
