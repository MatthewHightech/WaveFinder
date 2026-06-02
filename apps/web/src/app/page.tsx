"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { ScanPanel } from "@/components/Map/ScanPanel";
import type { Pin } from "@/components/Map/WaveMap";

const WaveMap = dynamic(() => import("@/components/Map/WaveMap").then((m) => m.WaveMap), {
  ssr: false,
});

type Bounds = { west: number; south: number; east: number; north: number };

export default function FinderPage() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [bounds, setBounds] = useState<Bounds | null>(null);

  const loadPins = useCallback(async (b?: Bounds) => {
    const qs = b
      ? `?west=${b.west}&south=${b.south}&east=${b.east}&north=${b.north}`
      : "";
    const res = await fetch(`/api/pins${qs}`);
    setPins(await res.json());
  }, []);

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  const onBoundsChange = useCallback((b: Bounds) => {
    setBounds(b);
    loadPins(b);
  }, [loadPins]);

  return (
    <>
      <WaveMap pins={pins} onBoundsChange={onBoundsChange} />
      <ScanPanel bounds={bounds} onScanComplete={() => loadPins(bounds ?? undefined)} />
    </>
  );
}
