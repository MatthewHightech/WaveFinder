import { chips, labels, seedImports } from "@wavefinder/db";
import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [labelCount] = await db.select({ n: count() }).from(labels);
  const [emptyCount] = await db
    .select({ n: count() })
    .from(chips)
    .where(eq(chips.isEmpty, true));
  const [pendingSeeds] = await db
    .select({ n: count() })
    .from(seedImports)
    .where(eq(seedImports.status, "pending"));

  return NextResponse.json({
    positive_labels: labelCount.n,
    empty_chips: emptyCount.n,
    pending_seeds: pendingSeeds.n,
    ready_to_train: labelCount.n >= 100 && emptyCount.n >= 200,
  });
}
