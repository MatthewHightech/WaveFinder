import type { LabelBbox } from "@wavefinder/db";

type ChipBounds = { west: number; south: number; east: number; north: number };

export const CHIP_SIZE_PX = 512;

export type ChipRecord = {
  chip_key: string;
  bounds: ChipBounds;
};

export async function upsertChipAndLabel(opts: {
  chip: ChipRecord;
  bbox?: LabelBbox;
  bboxes?: LabelBbox[];
  source: "seed_review" | "free_explore" | "empty_chip";
  isEmpty?: boolean;
  seedId?: string;
}) {
  const res = await fetch("/api/labels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to save");
  return data;
}

export async function rejectSeed(seedId: string) {
  const res = await fetch(`/api/seeds/${seedId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "rejected" }),
  });
  if (!res.ok) throw new Error("Failed to reject seed");
}
