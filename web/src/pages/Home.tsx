import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { type TitleSummary, listTitles } from '../api/catalog.ts';
import { useAuth } from '../hooks/useAuth.ts';

function RuntimeLabel({ seconds }: { seconds: number | null }) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return (
    <span className="text-slate-400 text-xs">
      {h > 0 ? `${h}h ${m}m` : `${m}m`}
    </span>
  );
}

function TitleCard({ title }: { title: TitleSummary }) {
  const isReady = title.assetStatus === 'ready' && title.assetId;
  return (
    <Link
      to={isReady ? `/watch/${title.assetId}` : '#'}
      className={`group relative block rounded-xl overflow-hidden bg-slate-800 transition-transform ${
        isReady ? 'hover:scale-105 cursor-pointer' : 'opacity-60 cursor-not-allowed'
      }`}
    >
      {/* Poster placeholder */}
      <div className="aspect-[2/3] bg-gradient-to-br from-slate-700 to-slate-900 flex items-end p-3">
        <div className="space-y-1">
          <p className="text-white font-semibold text-sm leading-tight line-clamp-2">
            {title.name}
          </p>
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-slate-400 text-xs">{title.year}</span>
            <RuntimeLabel seconds={title.runtimeSeconds} />
            {!isReady && (
              <span className="bg-slate-700 text-slate-300 text-xs px-1.5 py-0.5 rounded">
                {title.assetStatus ?? 'queued'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {title.genres.slice(0, 2).map((g) => (
              <span key={g} className="text-xs bg-slate-700/70 text-slate-300 px-1.5 py-0.5 rounded">
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [titles, setTitles] = useState<TitleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTitles()
      .then(setTitles)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-red-500">StreamFlix</h1>
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-slate-400">{user?.displayName}</span>
              <button
                onClick={logout}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {!isAuthenticated && (
          <div className="mb-6 bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-sm text-slate-300">
            <Link to="/login" className="text-red-400 underline font-medium">Sign in</Link>
            {' '}to play titles.
          </div>
        )}

        <h2 className="text-2xl font-bold mb-6">Browse</h2>

        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-slate-800 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {titles.map((t) => (
              <TitleCard key={t.id} title={t} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
