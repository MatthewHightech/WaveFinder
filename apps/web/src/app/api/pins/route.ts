import { pins } from "@wavefinder/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const west = Number(searchParams.get("west"));
  const south = Number(searchParams.get("south"));
  const east = Number(searchParams.get("east"));
  const north = Number(searchParams.get("north"));

  let rows = await db.select().from(pins).where(eq(pins.suppressed, false));

  if ([west, south, east, north].every((n) => !Number.isNaN(n))) {
    rows = rows.filter(
      (p) => p.lon >= west && p.lon <= east && p.lat >= south && p.lat <= north,
    );
  }

  return NextResponse.json(rows);
}
