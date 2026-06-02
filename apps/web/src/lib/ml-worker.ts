const ML_WORKER_URL = process.env.ML_WORKER_URL ?? "http://localhost:8000";

export type ScanBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
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

export async function mlHealth() {
  try {
    const res = await fetch(`${ML_WORKER_URL}/health`, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
