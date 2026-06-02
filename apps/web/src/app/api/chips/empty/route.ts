import { chips } from "@wavefinder/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Placeholder: create empty chip from bounds (ML worker will own chip keys later). */
export async function POST(request: Request) {
  const body = await request.json();
  const { west, south, east, north } = body as {
    west: number;
    south: number;
    east: number;
    north: number;
  };

  const chipKey = `empty-${west}-${south}-${east}-${north}`.replace(/\./g, "_");

  await db
    .insert(chips)
    .values({
      chipKey,
      bounds: { west, south, east, north },
      isEmpty: true,
      labeledAt: new Date(),
    })
    .onConflictDoNothing();

  return NextResponse.json({ message: "Empty chip recorded", chip_key: chipKey });
}
