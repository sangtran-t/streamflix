export interface PlaybackUrlResponse {
  masterUrl: string;
  expiresAt: string;
}

/**
 * Calls POST /api/playback/:assetId/url with the user's JWT.
 * The server sets the sf_play signed cookie in the response; subsequent
 * HLS segment requests to /hls/:assetId/* will include it automatically
 * because the cookie path matches and we're on the same origin.
 */
export async function getPlaybackUrl(
  assetId: string,
  accessToken: string,
): Promise<PlaybackUrlResponse> {
  const res = await fetch(`/api/v1/playback/${assetId}/url`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include', // ensure Set-Cookie response header is honoured
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Not authorised to play this title');
  }
  if (!res.ok) {
    throw new Error(`Playback URL fetch failed: ${res.status}`);
  }
  return res.json() as Promise<PlaybackUrlResponse>;
}
