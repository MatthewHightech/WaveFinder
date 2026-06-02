import { jobs } from "@wavefinder/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startTrain } from "@/lib/ml-worker";

export async function POST() {
  const [job] = await db
    .insert(jobs)
    .values({ type: "train", status: "pending" })
    .returning();

  try {
    await startTrain(job.id);
    return NextResponse.json({ job_id: job.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Train failed";
    await db.update(jobs).set({ status: "failed", error: message }).where(eq(jobs.id, job.id));
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
