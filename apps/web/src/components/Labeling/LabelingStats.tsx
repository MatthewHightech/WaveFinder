"use client";

import { useEffect, useState } from "react";

type Stats = {
  positive_labels: number;
  empty_chips: number;
  pending_seeds: number;
  ready_to_train: boolean;
};

export function LabelingStats({ refreshKey = 0 }: { refreshKey?: number }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats);
  }, [refreshKey]);

  if (!stats) return null;

  const posTarget = 100;
  const emptyTarget = 200;

  return (
    <aside className="rounded-lg border border-slate-800 bg-slate-900/80 p-4 text-sm">
      <h3 className="font-semibold text-slate-200">Dataset progress</h3>
      <ul className="mt-3 space-y-2 font-mono text-xs">
        <li>
          Positives:{" "}
          <span className={stats.positive_labels >= posTarget ? "text-teal-400" : "text-white"}>
            {stats.positive_labels}
          </span>
          /{posTarget}
        </li>
        <li>
          Empty chips:{" "}
          <span className={stats.empty_chips >= emptyTarget ? "text-teal-400" : "text-white"}>
            {stats.empty_chips}
          </span>
          /{emptyTarget}
        </li>
        <li>Pending seeds: {stats.pending_seeds}</li>
      </ul>
      {stats.ready_to_train ? (
        <p className="mt-3 text-xs text-teal-400">Ready to train on /train</p>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Keep labeling to unlock training</p>
      )}
    </aside>
  );
}
