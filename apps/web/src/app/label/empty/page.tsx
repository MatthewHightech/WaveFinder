"use client";

import { useState } from "react";

export default function EmptyChipPage() {
  const [message, setMessage] = useState<string | null>(null);

  async function markEmpty() {
    const res = await fetch("/api/chips/empty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        west: -122.5,
        south: 37.7,
        east: -122.4,
        north: 37.8,
      }),
    });
    const data = await res.json();
    setMessage(data.message ?? (res.ok ? "Saved" : data.error));
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-teal-400">Empty chip queue</h1>
      <p className="mt-2 text-sm text-slate-400">
        One-click “nothing here” for coastal chips. Placeholder uses demo bounds.
      </p>
      <button
        type="button"
        onClick={markEmpty}
        className="mt-4 rounded bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600"
      >
        Mark demo chip empty
      </button>
      {message && <p className="mt-2 text-sm text-teal-300">{message}</p>}
    </div>
  );
}
