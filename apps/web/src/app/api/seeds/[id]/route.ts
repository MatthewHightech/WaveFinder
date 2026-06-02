import { seedImports } from "@wavefinder/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const status = body.status as "rejected" | "pending";

  await db
    .update(seedImports)
    .set({ status, reviewedAt: new Date() })
    .where(eq(seedImports.id, id));

  return NextResponse.json({ ok: true });
}
