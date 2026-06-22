export interface PlaybackUrlResponse {
  masterUrl: string;
  expiresAt: string;
  titleId: string;
  titleSlug: string;
}

export async function getPlaybackUrl(
  assetId: string,
  accessToken: string,
): Promise<PlaybackUrlResponse> {
  const res = await fetch(`/api/v1/playback/${assetId}/url`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Not authorised to play this title');
  }
  if (!res.ok) {
    throw new Error(`Playback URL fetch failed: ${res.status}`);
  }
  return res.json() as Promise<PlaybackUrlResponse>;
}
