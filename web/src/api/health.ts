export interface HealthStatus {
  status: 'ok';
  service: string;
}

/** Calls the API liveness probe through the single-origin proxy (`/api/healthz`). */
export async function fetchApiHealth(signal?: AbortSignal): Promise<HealthStatus> {
  const res = await fetch('/api/healthz', { signal });
  if (!res.ok) {
    throw new Error(`api healthz returned ${res.status}`);
  }
  return (await res.json()) as HealthStatus;
}
