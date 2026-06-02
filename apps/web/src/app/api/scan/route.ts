import { jobs } from "@wavefinder/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startScan, type ScanBounds } from "@/lib/ml-worker";

export async function POST(request: Request) {
  const body = (await request.json()) as ScanBounds;

  const [job] = await db
    .insert(jobs)
    .values({
      type: "scan",
      status: "pending",
      bounds: body,
    })
    .returning();

  try {
    const result = await startScan(job.id, body);
    await db
      .update(jobs)
      .set({ tileCount: result.tile_count, status: "pending" })
      .where(eq(jobs.id, job.id));
    return NextResponse.json({ job_id: job.id, tile_count: result.tile_count });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Scan failed";
    await db
      .update(jobs)
      .set({ status: "failed", error: message })
      .where(eq(jobs.id, job.id));
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
