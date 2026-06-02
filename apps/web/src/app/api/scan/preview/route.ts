import { NextResponse } from "next/server";
import { previewScan, type ScanBounds } from "@/lib/ml-worker";

export async function POST(request: Request) {
  const body = (await request.json()) as ScanBounds;
  try {
    const result = await previewScan(body);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "ML worker unavailable";
    return NextResponse.json(
      { tile_count: 0, error: message, worker_down: true },
      { status: 503 },
    );
  }
}
