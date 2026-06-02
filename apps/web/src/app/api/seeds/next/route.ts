import { seedImports } from "@wavefinder/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [seed] = await db
    .select()
    .from(seedImports)
    .where(eq(seedImports.status, "pending"))
    .limit(1);

  if (!seed) {
    return NextResponse.json({ seed: null });
  }

  return NextResponse.json({ seed });
}
