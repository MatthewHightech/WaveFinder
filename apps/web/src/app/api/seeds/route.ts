import { seedImports } from "@wavefinder/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  const rows = await db
    .select()
    .from(seedImports)
    .where(eq(seedImports.status, status as "pending" | "approved" | "rejected"))
    .limit(100);
  return NextResponse.json(rows);
}
