"use client";

import { useEffect, useState } from "react";

type Seed = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  source: string;
};

export default function ReviewQueuePage() {
  const [seeds, setSeeds] = useState<Seed[]>([]);

  useEffect(() => {
    fetch("/api/seeds?status=pending")
      .then((r) => r.json())
      .then(setSeeds)
      .catch(() => setSeeds([]));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-teal-400">Review queue</h1>
      <p className="mt-2 text-sm text-slate-400">
        Imported surf spots awaiting bbox approval. Seed import CLI coming next.
      </p>
      {seeds.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No pending seeds — run seed import script.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-800">
          {seeds.map((s) => (
            <li key={s.id} className="py-2 text-sm">
              {s.name} · {s.lat.toFixed(4)}, {s.lon.toFixed(4)} · {s.source}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
