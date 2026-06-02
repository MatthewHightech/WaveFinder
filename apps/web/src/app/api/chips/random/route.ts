import { chips, labels } from "@wavefinder/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchRandomCoastalChip } from "@/lib/ml-worker";

/** Return a random coastal chip not yet labeled or marked empty. */
export async function GET() {
  for (let attempt = 0; attempt < 15; attempt++) {
    const chip = await fetchRandomCoastalChip();

    const existing = await db
      .select({ id: chips.id, isEmpty: chips.isEmpty })
      .from(chips)
      .where(eq(chips.chipKey, chip.chip_key))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(chip);
    }

    const row = existing[0];
    if (row.isEmpty) continue;

    const hasLabel = await db
      .select({ id: labels.id })
      .from(labels)
      .where(eq(labels.chipId, row.id))
      .limit(1);

    if (hasLabel.length === 0) {
      return NextResponse.json(chip);
    }
  }

  return NextResponse.json(
    { error: "Could not find an unlabeled chip — try again" },
    { status: 404 },
  );
}
