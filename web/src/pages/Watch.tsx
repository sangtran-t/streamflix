import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPlaybackUrl } from '../api/playback.ts';
import { getProgress, saveProgress } from '../api/progress.ts';
import Player from '../components/Player.tsx';
import { useAuth } from '../hooks/useAuth.ts';

const SAVE_INTERVAL_S = 10;

export default function Watch() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, initialized, accessToken } = useAuth();

  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [titleId, setTitleId] = useState<string | null>(null);
  const [titleSlug, setTitleSlug] = useState<string | null>(null);
  const [titleName, setTitleName] = useState<string | undefined>(undefined);
  const [initialTime, setInitialTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const lastSavedRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);

  useEffect(() => {
    // Wait for session restore before redirecting — prevents flash on refresh.
    if (!initialized) return;
    if (!isAuthenticated || !accessToken) {
      void navigate('/login', { replace: true });
      return;
    }
    if (!assetId) return;

    const load = async () => {
      try {
        const data = await getPlaybackUrl(assetId, accessToken);
        setMasterUrl(data.masterUrl);
        setTitleId(data.titleId);
        setTitleSlug(data.titleSlug);
        // API doesn't expose titleName — use slug as display fallback
        setTitleName(data.titleSlug ?? undefined);

        if (data.titleId) {
          const progress = await getProgress(accessToken);
          const saved = progress.find((p) => p.titleId === data.titleId);
          if (saved && !saved.completed && saved.positionSeconds > 5) {
            setInitialTime(saved.positionSeconds);
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load playback URL');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [assetId, accessToken, isAuthenticated, initialized, navigate]);

  const handleTimeUpdate = useCallback(
    (currentTime: number) => {
      currentTimeRef.current = currentTime;
      if (titleId && accessToken && currentTime - lastSavedRef.current >= SAVE_INTERVAL_S) {
        lastSavedRef.current = currentTime;
        void saveProgress(titleId, currentTime, accessToken);
      }
    },
    [titleId, accessToken],
  );

  useEffect(() => {
    return () => {
      if (titleId && accessToken && currentTimeRef.current > 5) {
        void saveProgress(titleId, currentTimeRef.current, accessToken);
      }
    };
  }, [titleId, accessToken]);

  const handleBack = () => {
    if (titleSlug) void navigate(`/title/${titleSlug}`);
    else void navigate('/');
  };

  // Re-issues the sf_play signed cookie when hls.js reports a fatal 401/403.
  // After this resolves, Player calls hls.startLoad() to resume playback.
  const handleRefreshPlayback = useCallback(async () => {
    if (!assetId || !accessToken) throw new Error('No credentials');
    await getPlaybackUrl(assetId, accessToken);
    // Side effect: server sets a fresh sf_play cookie; no return value needed.
  }, [assetId, accessToken]);

  // Loading state — keep it minimal (player will show soon)
  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'grid', placeItems: 'center', fontFamily: 'var(--sans)' }}>
        <span style={{
          width: 48, height: 48, borderRadius: 99,
          border: '3px solid rgba(255,255,255,0.15)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (error || !masterUrl) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'grid', placeItems: 'center', fontFamily: 'var(--sans)', color: '#f7f6f3' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 24, fontSize: 15 }}>{error ?? 'Playback unavailable'}</p>
          <button onClick={handleBack} style={{
            padding: '10px 24px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#f7f6f3', fontSize: 14, fontWeight: 600,
            background: 'none', cursor: 'pointer', fontFamily: 'var(--sans)',
          }}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <Player
      masterUrl={masterUrl}
      titleName={titleName}
      initialTime={initialTime}
      onTimeUpdate={handleTimeUpdate}
      onBack={handleBack}
      refreshPlayback={handleRefreshPlayback}
    />
  );
}
