"use client";

import { useCallback, useEffect, useState } from "react";
import { ChipLabeler, type BboxPixels } from "@/components/Labeling/ChipLabeler";
import { LabelingStats } from "@/components/Labeling/LabelingStats";
import { upsertChipAndLabel } from "@/lib/labeling";

type Chip = {
  chip_key: string;
  bounds: { west: number; south: number; east: number; north: number };
};

export default function EmptyChipPage() {
  const [chip, setChip] = useState<Chip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsKey, setStatsKey] = useState(0);
  const [imageVersion, setImageVersion] = useState(0);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chips/random");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No chip available");
      setChip(data);
      setImageVersion(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setChip(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  async function markEmpty() {
    if (!chip) return;
    setSaving(true);
    try {
      await upsertChipAndLabel({ chip, source: "empty_chip", isEmpty: true });
      setStatsKey((k) => k + 1);
      await loadNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function savePositive(bboxes: BboxPixels[]) {
    if (!chip || bboxes.length === 0) return;
    setSaving(true);
    try {
      await upsertChipAndLabel({ chip, bboxes, source: "free_explore" });
      setStatsKey((k) => k + 1);
      await loadNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[1fr_220px]">
      <div>
        <h1 className="text-xl font-semibold text-teal-400">Empty chip queue</h1>
        <p className="mt-1 text-sm text-slate-400">
          Random coastal chips — mark &quot;Nothing here&quot; or draw a box if you spot a break.
        </p>
        {loading && <p className="mt-8 text-slate-500">Loading chip…</p>}
        {error && <p className="mt-4 text-sm text-amber-400">{error}</p>}
        {chip && !loading && (
          <div className="mt-6">
            <ChipLabeler
              imageUrl={`/api/chips/image/${chip.chip_key}?v=${imageVersion}`}
              subtitle="No break visible? Use the empty button."
              onSave={savePositive}
              onMarkEmpty={markEmpty}
              onSkip={loadNext}
              saving={saving}
            />
          </div>
        )}
      </div>
      <LabelingStats refreshKey={statsKey} />
    </div>
  );
}
