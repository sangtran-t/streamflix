import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getPlaybackUrl } from '../api/playback.ts';
import Player from '../components/Player.tsx';
import { useAuth } from '../hooks/useAuth.ts';

export default function Watch() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, accessToken } = useAuth();

  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      navigate('/login', { replace: true });
      return;
    }
    if (!assetId) return;

    getPlaybackUrl(assetId, accessToken)
      .then((data) => setMasterUrl(data.masterUrl))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load playback URL'),
      )
      .finally(() => setLoading(false));
  }, [assetId, accessToken, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-black text-slate-100">
      {/* Minimal nav */}
      <header className="px-6 py-4 flex items-center gap-4">
        <Link to="/" className="text-red-500 font-bold text-lg">StreamFlix</Link>
        <span className="text-slate-600">›</span>
        <span className="text-slate-400 text-sm">Now playing</span>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-12">
        {loading && (
          <div className="aspect-video bg-slate-900 rounded-lg animate-pulse flex items-center justify-center">
            <span className="text-slate-500 text-sm">Loading…</span>
          </div>
        )}

        {error && (
          <div className="aspect-video bg-slate-900 rounded-lg flex items-center justify-center">
            <div className="text-center space-y-2">
              <p className="text-red-400 text-sm">{error}</p>
              <Link to="/" className="text-slate-400 text-sm underline">Back to browse</Link>
            </div>
          </div>
        )}

        {masterUrl && <Player masterUrl={masterUrl} />}
      </main>
    </div>
  );
}
