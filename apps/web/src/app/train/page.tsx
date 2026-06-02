"use client";

import { useEffect, useState } from "react";

export default function TrainPage() {
  const [stats, setStats] = useState<{
    positive_labels: number;
    empty_chips: number;
    ready_to_train: boolean;
  } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  async function train() {
    const res = await fetch("/api/train", { method: "POST" });
    const data = await res.json();
    if (data.job_id) {
      setJobId(data.job_id);
      poll(data.job_id);
    }
  }

  function poll(id: string) {
    const t = setInterval(async () => {
      const res = await fetch(`/api/jobs/${id}`);
      const job = await res.json();
      setStatus(job.status);
      if (job.status === "done" || job.status === "failed") clearInterval(t);
    }, 3000);
  }

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold text-teal-400">Train model</h1>
      <p className="mt-2 text-sm text-slate-400">
        YOLOv8s on Apple MPS · requires 100 positives + 200 empty chips
      </p>
      {stats && (
        <ul className="mt-4 space-y-1 text-sm font-mono">
          <li>Positive labels: {stats.positive_labels}</li>
          <li>Empty chips: {stats.empty_chips}</li>
          <li className={stats.ready_to_train ? "text-teal-400" : "text-amber-400"}>
            {stats.ready_to_train ? "Ready to train" : "Not enough data yet"}
          </li>
        </ul>
      )}
      <button
        type="button"
        onClick={train}
        className="mt-6 rounded bg-teal-600 px-4 py-2 text-sm font-medium hover:bg-teal-500"
      >
        Start training job
      </button>
      {jobId && <p className="mt-4 text-xs text-slate-400">Job {jobId}: {status}</p>}
      <p className="mt-8 text-xs text-slate-500">
        Run the ML worker locally: <code>bun run dev:ml</code>
      </p>
    </div>
  );
}
