import { NextResponse } from "next/server";
import { fetchChipAtPoint } from "@/lib/ml-worker";

export async function POST(request: Request) {
  const { lat, lon } = (await request.json()) as { lat: number; lon: number };
  try {
    const chip = await fetchChipAtPoint(lat, lon);
    return NextResponse.json(chip);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch chip";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
