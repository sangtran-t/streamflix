import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { type TitleSummary, getTitle, listTitles } from '../api/catalog.ts';
import { Icon } from '../components/ui/Icon.tsx';
import { Reveal } from '../components/ui/Reveal.tsx';
import { Still } from '../components/ui/Still.tsx';
import { useAuth } from '../hooks/useAuth.ts';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRuntime(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── FilmCard (landscape 16/9 for "more like this") ───────────────────────────

function FilmCard({ title }: { title: TitleSummary }) {
  const [hov, setHov] = useState(false);

  return (
    <Link
      to={`/title/${title.slug}`}
      style={{ display: 'block', textAlign: 'left' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <article>
        <div style={{
          position: 'relative', borderRadius: 16, overflow: 'hidden', aspectRatio: '16/9',
          transform: hov ? 'translateY(-6px)' : 'none',
          transition: 'transform .6s var(--ease), box-shadow .6s var(--ease)',
          boxShadow: hov ? '0 30px 60px -28px rgba(0,0,0,0.8)' : '0 0 0 rgba(0,0,0,0)',
        }}>
          <Still imageUrl={title.heroImageUrl ?? title.posterImageUrl} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(var(--scrim-deep),0.78) 0%, transparent 48%)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: hov ? 1 : 0, transition: 'opacity .4s' }}>
            <span style={{ width: 60, height: 60, borderRadius: 99, background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,0.25)' }}>
              <Icon name="play" size={21} />
            </span>
          </div>
          <div style={{ position: 'absolute', left: 20, right: 20, bottom: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <h3 className="display" style={{ fontSize: 20, letterSpacing: '-0.03em', flex: 1, paddingRight: 8 }}>{title.name}</h3>
            <span className="kicker" style={{ color: 'rgba(255,255,255,0.62)', flexShrink: 0 }}>{title.year}</span>
          </div>
        </div>
        <p className="kicker" style={{ marginTop: 12, color: 'var(--text-faint)' }}>
          {title.genres.slice(0, 2).join(' · ')}
        </p>
      </article>
    </Link>
  );
}

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
        } catch { /* non-fatal */ }
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
        <div style={{ height: '82vh', background: 'var(--bg-2)', animation: 'pulse 1.6s ease-in-out infinite alternate' }}>
          <style>{`@keyframes pulse{from{opacity:.4}to{opacity:.8}}`}</style>
        </div>
      </div>
    );
  }

  if (error || !title) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'grid', placeItems: 'center' }}>
        <div className="grain" aria-hidden="true" />
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-faint)', marginBottom: 24 }}>{error ?? 'Title not found'}</p>
          <Link to="/" className="btn btn--ghost"><Icon name="back" size={16} /> Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-anim" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="grain" aria-hidden="true" />

      {/* ── Cinematic backdrop header ─────────────────────────────────────── */}
      <header style={{ position: 'relative', height: '82vh', minHeight: 560, overflow: 'hidden' }}>
        <Still
          imageUrl={title.heroImageUrl ?? title.posterImageUrl}
          ken
          style={{ position: 'absolute', inset: 0 }}
        />
        <div style={{ position: 'absolute', inset: 0, background:
          'linear-gradient(0deg, var(--bg) 1%, rgba(var(--scrim),0.2) 42%, rgba(var(--scrim),0.5) 100%)' }} />

        {/* Back button */}
        <Link to="/" className="btn btn--icon" style={{ position: 'absolute', top: 100, left: 'var(--page-x)' }}>
          <Icon name="back" size={18} />
        </Link>

        {/* Bottom-anchored content */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 'clamp(40px,7vh,72px) var(--page-x)' }}>
          <p className="kicker kicker--accent" style={{ marginBottom: 22 }}>
            {title.genres.slice(0, 2).join(' · ')} · {title.year}
          </p>
          <h1
            className="display display--xl"
            style={{ fontSize: 'clamp(13px,1.8vw,27px)', maxWidth: '16ch', textTransform: 'uppercase' }}
          >
            {title.name}
          </h1>
          <div style={{ display: 'flex', gap: 12, marginTop: 34, flexWrap: 'wrap' }}>
            {isReady ? (
              <button className="btn btn--play" onClick={handlePlay}>
                <Icon name="play" size={18} /> <span>Play</span>
              </button>
            ) : (
              <button className="btn btn--ghost" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                {title.assetStatus === 'processing' ? 'Transcoding…' : 'Not available'}
              </button>
            )}
            <button className="btn btn--ghost" onClick={() => { void navigate('/browse'); }}>
              <Icon name="plus" size={17} /> <span>Add</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Editorial body ────────────────────────────────────────────────── */}
      <div style={{
        padding: 'clamp(56px,8vh,96px) var(--page-x) clamp(80px,12vh,140px)',
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,0.7fr)',
        gap: 'clamp(40px,7vw,110px)',
        maxWidth: 1320,
      }}>
        {/* Left column */}
        <Reveal>
          <div>
            {/* Synopsis as logline */}
            {title.synopsis && (
              <p className="editorial" style={{ fontSize: 'clamp(22px,2.4vw,34px)', lineHeight: 1.3, marginBottom: 40 }}>
                {title.synopsis}
              </p>
            )}

            {/* Pull-quote block */}
            <figure style={{ borderLeft: '2px solid var(--accent-line)', paddingLeft: 28, margin: '0 0 56px' }}>
              <blockquote className="editorial" style={{ fontSize: 'clamp(20px,2.2vw,28px)', lineHeight: 1.32, color: 'var(--text)' }}>
                "{title.synopsis?.split('.')[0] ?? title.name}"
              </blockquote>
              <figcaption className="kicker" style={{ marginTop: 18 }}>Streamflix Editorial</figcaption>
            </figure>

            {/* Genre tag chips */}
            {title.genres.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {title.genres.map((g) => (
                  <Link
                    key={g}
                    to="/browse"
                    className="chip"
                    style={{ padding: '9px 16px', borderRadius: 99, border: '1px solid var(--hairline)', fontSize: 13.5, color: 'var(--text-dim)', transition: 'all .3s var(--ease)' }}
                  >
                    {g}
                  </Link>
                ))}
              </div>
            )}

            {/* Sign-in nudge */}
            {!isAuthenticated && isReady && (
              <p style={{ marginTop: 40, fontSize: 14, color: 'var(--text-faint)' }}>
                <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Sign in</Link> to watch this title and track your progress.
              </p>
            )}
          </div>
        </Reveal>

        {/* Right sidebar */}
        <Reveal delay={120}>
          <aside>
            <div style={{ display: 'grid', gap: 0 }}>
              {/* Year */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '16px 0', borderTop: '1px solid var(--hairline-soft)' }}>
                <span className="kicker" style={{ alignSelf: 'center' }}>Year</span>
                <span style={{ fontSize: 15.5 }}>{title.year}</span>
              </div>
              {/* Runtime */}
              {title.runtimeSeconds && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '16px 0', borderTop: '1px solid var(--hairline-soft)' }}>
                  <span className="kicker" style={{ alignSelf: 'center' }}>Runtime</span>
                  <span style={{ fontSize: 15.5 }}>{formatRuntime(title.runtimeSeconds)}</span>
                </div>
              )}
              {/* Genre */}
              {title.genres.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '16px 0', borderTop: '1px solid var(--hairline-soft)' }}>
                  <span className="kicker" style={{ alignSelf: 'center' }}>Genre</span>
                  <span style={{ fontSize: 15.5 }}>{title.genres.join(', ')}</span>
                </div>
              )}
              {/* Status indicator */}
              {title.assetStatus && title.assetStatus !== 'ready' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '16px 0', borderTop: '1px solid var(--hairline-soft)', borderBottom: '1px solid var(--hairline-soft)' }}>
                  <span className="kicker" style={{ alignSelf: 'center' }}>Status</span>
                  <span style={{ fontSize: 15.5, color: 'var(--text-dim)', textTransform: 'capitalize' }}>{title.assetStatus}</span>
                </div>
              )}
              {/* Upload link */}
              <div style={{ padding: '20px 0', color: 'var(--text-dim)', fontSize: 14 }}>
                <Link to="/admin/upload" style={{ color: 'var(--accent)', opacity: 0.8 }}>+ Upload new title</Link>
              </div>
            </div>
          </aside>
        </Reveal>
      </div>

      {/* ── More like this ────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <section style={{ padding: '0 var(--page-x) clamp(90px,14vh,150px)' }}>
          <Reveal>
            <p className="kicker" style={{ marginBottom: 36 }}>If you liked this</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
              {related.map((r) => <FilmCard key={r.id} title={r} />)}
            </div>
          </Reveal>
        </section>
      )}
    </div>
  );
}
