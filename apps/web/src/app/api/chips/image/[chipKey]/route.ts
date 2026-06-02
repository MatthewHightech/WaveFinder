import { NextResponse } from "next/server";
import { chipImageUrl } from "@/lib/ml-worker";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chipKey: string }> },
) {
  const { chipKey } = await params;
  const res = await fetch(chipImageUrl(chipKey), { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
  const bytes = await res.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "image/png",
      // Avoid serving stale placeholder PNGs after imagery fetch is fixed
      "Cache-Control": "private, no-cache, must-revalidate",
    },
  });
}
