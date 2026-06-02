"use client";

import { useState } from "react";
import { ChipLabeler, type BboxPixels } from "@/components/Labeling/ChipLabeler";
import { LabelingStats } from "@/components/Labeling/LabelingStats";
import { upsertChipAndLabel } from "@/lib/labeling";

type Chip = {
  chip_key: string;
  bounds: { west: number; south: number; east: number; north: number };
};

export default function ExploreLabelPage() {
  const [lat, setLat] = useState("37.655");
  const [lon, setLon] = useState("-122.505");
  const [chip, setChip] = useState<Chip | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsKey, setStatsKey] = useState(0);
  const [imageVersion, setImageVersion] = useState(0);

  async function loadChip() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chips/at-point", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: Number(lat), lon: Number(lon) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setChip(data);
      setImageVersion(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setChip(null);
    } finally {
      setLoading(false);
    }
  }

  async function save(bboxes: BboxPixels[]) {
    if (!chip || bboxes.length === 0) return;
    setSaving(true);
    try {
      await upsertChipAndLabel({ chip, bboxes, source: "free_explore" });
      setStatsKey((k) => k + 1);
      setChip(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[1fr_220px]">
      <div>
        <h1 className="text-xl font-semibold text-teal-400">Free explore</h1>
        <p className="mt-1 text-sm text-slate-400">
          Enter coordinates from the Finder map (or any coastal point) and label new positives.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">
            Lat
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="mt-1 block w-32 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-sm"
            />
          </label>
          <label className="text-xs text-slate-400">
            Lon
            <input
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              className="mt-1 block w-32 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-sm"
            />
          </label>
          <button
            type="button"
            onClick={loadChip}
            disabled={loading}
            className="rounded bg-slate-700 px-4 py-1.5 text-sm hover:bg-slate-600 disabled:opacity-40"
          >
            {loading ? "Loading…" : "Load chip"}
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-amber-400">{error}</p>}
        {chip && (
          <div className="mt-6">
            <ChipLabeler
              imageUrl={`/api/chips/image/${chip.chip_key}?v=${imageVersion}`}
              subtitle={`Chip ${chip.chip_key.slice(0, 8)}…`}
              onSave={save}
              saving={saving}
            />
          </div>
        )}
      </div>
      <LabelingStats refreshKey={statsKey} />
    </div>
  );
}
