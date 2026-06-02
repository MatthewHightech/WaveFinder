import { chips, labels, seedImports, type LabelBbox } from "@wavefinder/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Body = {
  chip: { chip_key: string; bounds: { west: number; south: number; east: number; north: number } };
  bbox?: LabelBbox;
  bboxes?: LabelBbox[];
  source: "seed_review" | "free_explore" | "empty_chip";
  isEmpty?: boolean;
  seedId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Body;

  if (body.isEmpty) {
    const [chip] = await db
      .insert(chips)
      .values({
        chipKey: body.chip.chip_key,
        bounds: body.chip.bounds,
        isEmpty: true,
        labeledAt: new Date(),
      })
      .onConflictDoUpdate({
        target: chips.chipKey,
        set: { isEmpty: true, labeledAt: new Date() },
      })
      .returning();
    return NextResponse.json({ chip_id: chip.id, empty: true });
  }

  const allBboxes = body.bboxes ?? (body.bbox ? [body.bbox] : []);
  if (allBboxes.length === 0) {
    return NextResponse.json({ error: "At least one bbox required" }, { status: 400 });
  }

  const [chip] = await db
    .insert(chips)
    .values({
      chipKey: body.chip.chip_key,
      bounds: body.chip.bounds,
      isEmpty: false,
      labeledAt: new Date(),
    })
    .onConflictDoUpdate({
      target: chips.chipKey,
      set: { isEmpty: false, labeledAt: new Date() },
    })
    .returning();

  const inserted = await db
    .insert(labels)
    .values(
      allBboxes.map((bbox) => ({
        chipId: chip.id,
        bbox,
        source: body.source,
      })),
    )
    .returning();

  if (body.seedId && inserted.length > 0) {
    await db
      .update(seedImports)
      .set({
        status: "approved",
        labelId: inserted[0].id,
        reviewedAt: new Date(),
      })
      .where(eq(seedImports.id, body.seedId));
  }

  return NextResponse.json({
    chip_id: chip.id,
    label_ids: inserted.map((l) => l.id),
    count: inserted.length,
  });
}
