export interface ProgressItem {
  titleId: string;
  titleSlug: string;
  titleName: string;
  assetId: string | null;
  positionSeconds: number;
  completed: boolean;
  updatedAt: string;
}

export async function getProgress(accessToken: string): Promise<ProgressItem[]> {
  const res = await fetch('/api/v1/me/progress', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Progress fetch failed: ${res.status}`);
  return res.json() as Promise<ProgressItem[]>;
}

export async function saveProgress(
  titleId: string,
  positionSeconds: number,
  accessToken: string,
): Promise<void> {
  await fetch(`/api/v1/me/progress/${titleId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ positionSeconds: Math.floor(positionSeconds) }),
  });
  // Fire-and-forget; ignore errors to avoid interrupting playback.
}
