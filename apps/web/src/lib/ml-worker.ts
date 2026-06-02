const ML_WORKER_URL = process.env.ML_WORKER_URL ?? "http://localhost:8000";

export type ScanBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type ChipBounds = ScanBounds;

export type ChipPayload = {
  chip_key: string;
  bounds: ChipBounds;
  image_path?: string | null;
};

export async function previewScan(bounds: ScanBounds) {
  const res = await fetch(`${ML_WORKER_URL}/scan/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bounds),
  });
  if (!res.ok) throw new Error(`ML worker error: ${res.status}`);
  return res.json() as Promise<{ tile_count: number; error: string | null }>;
}

export async function startScan(jobId: string, bounds: ScanBounds) {
  const res = await fetch(`${ML_WORKER_URL}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, ...bounds }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `ML worker error: ${res.status}`);
  }
  return res.json() as Promise<{ accepted: boolean; tile_count: number }>;
}

export async function startTrain(jobId: string) {
  const res = await fetch(`${ML_WORKER_URL}/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId }),
  });
  if (!res.ok) throw new Error(`ML worker error: ${res.status}`);
  return res.json() as Promise<{ accepted: boolean }>;
}

export async function fetchChipAtPoint(lat: number, lon: number): Promise<ChipPayload> {
  const res = await fetch(`${ML_WORKER_URL}/chip/at-point`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = (err as { detail?: string }).detail;
    throw new Error(detail ?? `ML worker error: ${res.status}`);
  }
  return res.json();
}

export async function fetchRandomCoastalChip(): Promise<ChipPayload> {
  const res = await fetch(`${ML_WORKER_URL}/chip/random`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = (err as { detail?: string }).detail;
    throw new Error(detail ?? `ML worker error: ${res.status}`);
  }
  return res.json();
}

export function chipImageUrl(chipKey: string): string {
  return `${ML_WORKER_URL}/chip/image/${chipKey}`;
}

export async function mlHealth() {
  try {
    const res = await fetch(`${ML_WORKER_URL}/health`, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
