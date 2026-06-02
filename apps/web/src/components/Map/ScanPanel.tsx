"use client";

import { useState } from "react";

type Bounds = { west: number; south: number; east: number; north: number };

type ScanPanelProps = {
  bounds: Bounds | null;
  onScanComplete?: (jobId: string) => void;
};

export function ScanPanel({ bounds, onScanComplete }: ScanPanelProps) {
  const [tileCount, setTileCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  async function preview() {
    if (!bounds) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scan/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bounds),
      });
      const data = await res.json();
      setTileCount(data.tile_count);
      setError(data.error ?? (data.worker_down ? "ML worker is not running" : null));
    } finally {
      setLoading(false);
    }
  }

  async function scan() {
    if (!bounds) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bounds),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Scan failed");
        return;
      }
      setJobId(data.job_id);
      setTileCount(data.tile_count);
      onScanComplete?.(data.job_id);
      pollJob(data.job_id);
    } finally {
      setLoading(false);
    }
  }

  async function pollJob(id: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/jobs/${id}`);
      const job = await res.json();
      setJobStatus(job.status);
      if (job.status === "done" || job.status === "failed") {
        clearInterval(interval);
        if (job.error) setError(job.error);
      }
    }, 2000);
  }

  return (
    <div className="absolute top-4 left-4 z-10 w-72 rounded-lg border border-slate-700 bg-slate-900/95 p-4 shadow-xl backdrop-blur">
      <h2 className="text-sm font-semibold text-teal-400">Scan this area</h2>
      <p className="mt-1 text-xs text-slate-400">
        Coastal tiles only · max ~25 km shore span · score &gt; 0.2
      </p>
      {tileCount !== null && (
        <p className="mt-2 text-sm">
          Tiles to scan: <span className="font-mono text-white">{tileCount}</span>
        </p>
      )}
      {error && <p className="mt-2 text-xs text-amber-400">{error}</p>}
      {jobStatus && (
        <p className="mt-1 text-xs text-slate-300">Job: {jobStatus}</p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!bounds || loading}
          onClick={preview}
          className="flex-1 rounded bg-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-600 disabled:opacity-40"
        >
          Preview tiles
        </button>
        <button
          type="button"
          disabled={!bounds || loading || tileCount === 0}
          onClick={scan}
          className="flex-1 rounded bg-teal-600 px-3 py-1.5 text-xs font-medium hover:bg-teal-500 disabled:opacity-40"
        >
          Scan
        </button>
      </div>
    </div>
  );
}
