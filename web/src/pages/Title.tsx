import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { type TitleSummary, getTitle, listTitles } from '../api/catalog.ts';
import { Icon } from '../components/ui/Icon.tsx';
import { Still } from '../components/ui/Still.tsx';
import { Reveal } from '../components/ui/Reveal.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { FilmCard } from '../components/ui/FilmCard.tsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRuntime(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// (Removed local FilmCard)

// ── TitlePage ─────────────────────────────────────────────────────────────────

export default function TitlePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [title, setTitle] = useState<TitleSummary | null>(null);
  const [related, setRelated] = useState<TitleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    window.scrollTo(0, 0);

    const load = async () => {
      try {
        const t = await getTitle(slug);
        setTitle(t);
        // Load related (same first genre, excluding current)
        try {
          const all = await listTitles();
          const rel = all
            .filter((x) => x.id !== t.id && x.genres.some((g) => t.genres.includes(g)))
            .slice(0, 3);
          setRelated(rel);
        } catch {
          /* non-fatal */
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [slug]);

  const handlePlay = () => {
    if (!isAuthenticated) {
      void navigate('/login', { state: { from: `/title/${slug}` } });
      return;
    }
    if (title?.assetId) void navigate(`/watch/${title.assetId}`);
  };

  const isReady = title?.assetStatus === 'ready' && title?.assetId;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div className="grain" aria-hidden="true" />
        <div
          style={{
            height: '82vh',
            background: 'var(--bg-2)',
            animation: 'pulse 1.6s ease-in-out infinite alternate',
          }}
        >
          <style>{`@keyframes pulse{from{opacity:.4}to{opacity:.8}}`}</style>
        </div>
      </div>
    );
  }

  if (error || !title) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div className="grain" aria-hidden="true" />
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-faint)', marginBottom: 24 }}>
            {error ?? 'Title not found'}
          </p>
          <Link to="/" className="btn btn--ghost">
            <Icon name="back" size={16} /> Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="screen-anim"
      style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', position: 'relative' }}
    >
      <div className="grain" aria-hidden="true" />

      {/* ── Full Page Background ────────────────────────────────────────────── */}
      <Still
        imageUrl={title.heroImageUrl ?? title.posterImageUrl}
        style={{ 
          position: 'fixed', 
          top: 0, left: 0, right: 0, height: '100vh', 
          zIndex: 0,
          opacity: 0.6
        }} 
      />
      {/* Overlay gradient to fade bottom into the dark page background */}
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, height: '100vh',
          zIndex: 0,
          background: 'linear-gradient(180deg, transparent 0%, rgba(22,23,27,0.4) 50%, var(--bg) 100%)',
          pointerEvents: 'none'
        }}
      />

      {/* Back button */}
      <Link
        to="/"
        className="btn btn--icon"
        style={{ position: 'absolute', top: 'clamp(20px, 4vh, 40px)', left: 'var(--page-x)', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', zIndex: 100 }}
      >
        <Icon name="back" size={18} />
      </Link>

      {/* ── Content Wrapper ─────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 10, paddingTop: '35vh', paddingBottom: 100 }}>
        <div
          style={{
            padding: '0 var(--page-x)',
            maxWidth: 1400,
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 64,
            alignItems: 'flex-start',
          }}
        >
          {/* Left Column (Poster & Info) */}
          <Reveal style={{ flex: '0 0 280px', maxWidth: 300 }}>
            <div>
              {/* Poster */}
              <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', marginBottom: 24, aspectRatio: '2/3', background: 'var(--bg-2)' }}>
                <img 
                  src={title.posterImageUrl ?? ''} 
                  alt={title.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              </div>

              {/* Title */}
              <h1 style={{ fontFamily: 'var(--display)', fontSize: 32, fontWeight: 800, lineHeight: 1.2, marginBottom: 8, letterSpacing: '-0.02em' }}>
                {title.name}
              </h1>

              {/* Tags/Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)' }}>{title.year}</span>
                {title.assetStatus === 'ready' ? (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)' }}>HD</span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.1)', color: '#e07070' }}>{title.assetStatus}</span>
                )}
              </div>

              {/* Synopsis */}
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>Synopsis</h3>
                {title.synopsis ? (
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-faint)' }}>{title.synopsis}</p>
                ) : (
                  <p style={{ fontSize: 14, color: 'var(--text-ghost)', fontStyle: 'italic' }}>No synopsis available.</p>
                )}
              </div>

              {/* Detailed Metadata Grid */}
              <div style={{ display: 'grid', gap: 16, fontSize: 13 }}>
                {title.runtimeSeconds && (
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12 }}>
                    <span style={{ color: 'var(--text-ghost)', fontWeight: 600 }}>Runtime</span>
                    <span style={{ color: 'var(--text-dim)' }}>{formatRuntime(title.runtimeSeconds)}</span>
                  </div>
                )}
                {title.genres.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12 }}>
                    <span style={{ color: 'var(--text-ghost)', fontWeight: 600 }}>Genres</span>
                    <span style={{ color: 'var(--text-dim)' }}>{title.genres.join(', ')}</span>
                  </div>
                )}
              </div>
              
              {/* Sign-in nudge */}
              {!isAuthenticated && isReady && (
                <div style={{ marginTop: 40, padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--hairline)' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    Please <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>Sign In</Link> to save your watch history.
                  </p>
                </div>
              )}
            </div>
          </Reveal>

          {/* Right Column (Actions & Expandable Content) */}
          <Reveal delay={120} style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div>
              {/* Full Width Glassmorphism Action Bar */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  width: '100%',
                  flexWrap: 'wrap',
                  gap: 16, 
                  padding: '24px 32px', 
                  background: 'rgba(255,255,255,0.04)', 
                  backdropFilter: 'blur(32px)', 
                  WebkitBackdropFilter: 'blur(32px)', 
                  borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.05)',
                  marginBottom: 32
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                  {isReady ? (
                    <button 
                      className="btn" 
                      onClick={handlePlay}
                      style={{ height: 48, padding: '0 32px', fontSize: 16, fontWeight: 700, borderRadius: 999, background: 'var(--accent)', color: '#000', boxShadow: '0 8px 32px var(--accent-soft)' }}
                    >
                      <Icon name="play" size={18} /> <span style={{ marginLeft: 8 }}>Play</span>
                    </button>
                  ) : (
                    <button
                      className="btn btn--ghost"
                      disabled
                      style={{ height: 48, padding: '0 32px', fontSize: 16, borderRadius: 999, opacity: 0.5, cursor: 'not-allowed', background: 'rgba(255,255,255,0.05)' }}
                    >
                      {title.assetStatus === 'processing' ? 'Processing…' : 'Not ready'}
                    </button>
                  )}

                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn--ghost" style={{ height: 48, padding: '0 20px', borderRadius: 999, background: 'transparent', flexDirection: 'column', gap: 4 }} title="Favorite">
                      <Icon name="star" size={18} /> <span style={{ fontSize: 11, fontWeight: 600 }}>Favorite</span>
                    </button>
                    <button className="btn btn--ghost" style={{ height: 48, padding: '0 20px', borderRadius: 999, background: 'transparent', flexDirection: 'column', gap: 4 }} title="Add to List">
                      <Icon name="plus" size={18} /> <span style={{ fontSize: 11, fontWeight: 600 }}>Add</span>
                    </button>
                    <button className="btn btn--ghost" style={{ height: 48, padding: '0 20px', borderRadius: 999, background: 'transparent', flexDirection: 'column', gap: 4 }} title="Share">
                      <Icon name="upload" size={18} /> <span style={{ fontSize: 11, fontWeight: 600 }}>Share</span>
                    </button>
                  </div>
                </div>

                {/* Rating Badge Right Aligned */}
                <div style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 999, fontWeight: 700, fontSize: 13, border: '1px solid var(--hairline-soft)' }}>
                  <Icon name="star" size={14} style={{ color: 'var(--accent)' }} /> 0.0 <span style={{ fontWeight: 400, opacity: 0.8 }}>Rating</span>
                </div>
              </div>

              {/* Related / More Like This (Expands downwards infinitely) */}
              {related.length > 0 && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: 'var(--text)' }}>More Like This</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 24 }}>
                    {related.map((r) => (
                      <FilmCard key={r.id} title={r} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
