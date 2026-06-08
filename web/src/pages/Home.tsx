import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { type HomeResponse, type TitleSummary, getHome } from '../api/catalog.ts';
import { type ProgressItem, getProgress } from '../api/progress.ts';
import { Icon } from '../components/ui/Icon.tsx';
import { Reveal } from '../components/ui/Reveal.tsx';
import { Still } from '../components/ui/Still.tsx';
import { trySilentRefresh, useAuth } from '../hooks/useAuth.ts';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRuntime(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Cover image for portrait cards; backdrop for landscape cards — always with cross-fallback. */
function coverImage(t: TitleSummary): string | null {
  return t.posterImageUrl ?? t.heroImageUrl;
}
function backdropImage(t: TitleSummary): string | null {
  return t.heroImageUrl ?? t.posterImageUrl;
}

// ── FilmCard ──────────────────────────────────────────────────────────────────

function FilmCard({ title, tall = false }: { title: TitleSummary; tall?: boolean }) {
  const [hov, setHov] = useState(false);

  return (
    <Link
      to={`/title/${title.slug}`}
      style={{ display: 'block', textAlign: 'left' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <article>
        <div
          style={{
            position: 'relative',
            borderRadius: 16,
            overflow: 'hidden',
            aspectRatio: tall ? '3/4' : '16/9',
            transform: hov ? 'translateY(-6px)' : 'none',
            transition: 'transform .6s var(--ease), box-shadow .6s var(--ease)',
            boxShadow: hov ? '0 30px 60px -28px rgba(0,0,0,0.8)' : '0 0 0 rgba(0,0,0,0)',
          }}
        >
          <Still
            imageUrl={tall ? coverImage(title) : backdropImage(title)}
            style={{ position: 'absolute', inset: 0 }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(var(--scrim-deep),0.78) 0%, transparent 48%)' }} />

          {/* Hover play button */}
          <div style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            opacity: hov ? 1 : 0, transition: 'opacity .4s',
          }}>
            <span style={{
              width: 60, height: 60, borderRadius: 99,
              background: 'rgba(255,255,255,0.16)',
              backdropFilter: 'blur(8px)',
              display: 'grid', placeItems: 'center',
              border: '1px solid rgba(255,255,255,0.25)',
            }}>
              <Icon name="play" size={21} />
            </span>
          </div>

          {/* Bottom info */}
          <div style={{ position: 'absolute', left: 20, right: 20, bottom: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <h3 className="display" style={{ fontSize: 22, letterSpacing: '-0.03em', flex: 1, paddingRight: 8 }}>
              {title.name}
            </h3>
            <span className="kicker" style={{ color: 'rgba(255,255,255,0.62)', flexShrink: 0 }}>{title.year}</span>
          </div>
        </div>
        <p className="kicker" style={{ marginTop: 14, color: 'var(--text-faint)' }}>
          {title.genres.slice(0, 2).join(' · ')}
        </p>
      </article>
    </Link>
  );
}

// ── Marquee (hero) ────────────────────────────────────────────────────────────

function Marquee({ title, isAuthenticated }: { title: TitleSummary; isAuthenticated: boolean }) {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const isReady = title.assetStatus === 'ready' && title.assetId;

  useEffect(() => {
    const onScroll = () => setOffset(Math.min(window.scrollY * 0.28, 220));
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handlePlay = () => {
    if (!isAuthenticated) { void navigate('/login'); return; }
    if (title.assetId) void navigate(`/watch/${title.assetId}`);
  };

  return (
    <header style={{ position: 'relative', height: '92vh', minHeight: 560, overflow: 'hidden' }}>
      {/* Parallax still */}
      <div style={{ position: 'absolute', inset: '-8% 0 0 0', transform: `translateY(${offset}px) scale(1.04)` }}>
        <Still
          imageUrl={backdropImage(title)}
          ken
          style={{ position: 'absolute', inset: 0 }}
        />
      </div>

      {/* Cinematic scrim */}
      <div style={{ position: 'absolute', inset: 0, background:
        'linear-gradient(90deg, rgba(var(--scrim),0.92) 0%, rgba(var(--scrim),0.5) 36%, rgba(var(--scrim),0) 66%), linear-gradient(0deg, var(--bg) 1%, rgba(var(--scrim),0) 32%)' }} />

      {/* Content */}
      <div className="screen-anim" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '84px var(--page-x) 0', maxWidth: 1100 }}>
        <p className="kicker kicker--accent" style={{ marginBottom: 24 }}>Tonight</p>
        <h1
          className="display display--xl"
          style={{ fontSize: 'clamp(14px, 2vw, 30px)', maxWidth: '14ch', marginBottom: 22, textTransform: 'uppercase' }}
        >
          {title.name}
        </h1>
        {title.synopsis && (
          <p className="editorial" style={{ fontSize: 'clamp(18px,2.1vw,28px)', color: 'var(--text)', opacity: 0.9, maxWidth: '24ch', lineHeight: 1.3 }}>
            {title.synopsis.slice(0, 120)}{title.synopsis.length > 120 ? '…' : ''}
          </p>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 38, alignItems: 'center', flexWrap: 'wrap' }}>
          {isReady && (
            <button className="btn btn--play" onClick={handlePlay}>
              <Icon name="play" size={18} /> <span>Play</span>
            </button>
          )}
          <Link to={`/title/${title.slug}`} className="btn btn--ghost">
            <span>Details</span>
          </Link>
          {title.runtimeSeconds && (
            <span className="dim" style={{ fontSize: 14, marginLeft: 8, fontWeight: 500, whiteSpace: 'nowrap' }}>
              {title.genres[0]} · {formatRuntime(title.runtimeSeconds)}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Thread (curated section) ──────────────────────────────────────────────────

function Thread({ row }: { row: { title: string; items: TitleSummary[] } }) {
  return (
    <section style={{ padding: 'clamp(80px,12vh,150px) var(--page-x) 0' }}>
      <Reveal>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32, marginBottom: 56 }}>
          <div>
            <p className="kicker" style={{ marginBottom: 18 }}>This week's thread</p>
            <h2 className="display" style={{ fontSize: 'clamp(44px,5.5vw,84px)' }}>{row.title}</h2>
          </div>
          <Link to="/browse" className="hoverline" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: 'var(--text-dim)', fontSize: 15, fontWeight: 600, paddingBottom: 8, whiteSpace: 'nowrap' }}>
            Open <Icon name="arrow" size={16} />
          </Link>
        </header>
      </Reveal>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
        {row.items.slice(0, 3).map((t, i) => (
          <Reveal key={t.id} delay={i * 110}>
            <FilmCard title={t} tall />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── Film Row (generic catalog grid — New Arrivals, genre rows, etc.) ──────────

function FilmRow({ row }: { row: { title: string; items: TitleSummary[] } }) {
  return (
    <section style={{ padding: 'clamp(56px,8vh,96px) var(--page-x) 0' }}>
      <Reveal>
        <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24, marginBottom: 32 }}>
          <h2 className="display" style={{ fontSize: 'clamp(28px,3.2vw,42px)' }}>{row.title}</h2>
          <Link to="/browse" className="hoverline" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: 'var(--text-dim)', fontSize: 15, fontWeight: 600, paddingBottom: 4, whiteSpace: 'nowrap' }}>
            More <Icon name="arrow" size={16} />
          </Link>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {row.items.slice(0, 4).map((t, i) => (
            <Reveal key={t.id} delay={i * 80}>
              <FilmCard title={t} tall={false} />
            </Reveal>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

// ── Continue watching ─────────────────────────────────────────────────────────

function Continue({
  items,
  progressMap,
}: {
  items: TitleSummary[];
  progressMap: Map<string, ProgressItem>;
}) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleResume = (t: TitleSummary) => {
    if (!isAuthenticated) { void navigate('/login'); return; }
    if (t.assetId) void navigate(`/watch/${t.assetId}`);
    else void navigate(`/title/${t.slug}`);
  };

  return (
    <section style={{ padding: 'clamp(80px,12vh,150px) var(--page-x) 0' }}>
      <Reveal>
        <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 40 }}>
          <h2 className="display" style={{ fontSize: 'clamp(28px,3.2vw,42px)' }}>Keep watching</h2>
          <p className="kicker">Continue</p>
        </header>
      </Reveal>
      <Reveal>
        <ul style={{ listStyle: 'none' }}>
          {items.map((t, i) => {
            const prog = progressMap.get(t.id);
            const pos = prog?.positionSeconds ?? 0;
            const runtime = t.runtimeSeconds ?? null;
            // Fraction 0–1: only computable when runtime is known
            const fraction = runtime && pos ? Math.min(pos / runtime, 1) : 0;
            // Time remaining: runtime - pos (positive means still time left)
            const secondsLeft = runtime !== null ? Math.max(0, runtime - pos) : null;
            // Fallback label when runtime unknown: show how much was watched
            const watchedLabel = runtime === null && pos > 0 ? formatRuntime(pos) + ' watched' : null;
            return (
              <li key={t.id}>
                <button
                  onClick={() => handleResume(t)}
                  className="cont-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '128px minmax(0,1fr) auto',
                    gap: 28,
                    alignItems: 'center',
                    width: '100%',
                    padding: '20px 12px',
                    borderTop: '1px solid var(--hairline-soft)',
                    borderBottom: i === items.length - 1 ? '1px solid var(--hairline-soft)' : 'none',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '16/10' }}>
                    <Still imageUrl={backdropImage(t)} style={{ position: 'absolute', inset: 0 }} />
                  </div>
                  <div>
                    <h3 className="display" style={{ fontSize: 24, marginBottom: 12, letterSpacing: '-0.03em' }}>{t.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ width: 200, maxWidth: '34vw', height: 3, borderRadius: 2, background: 'var(--hairline)', overflow: 'hidden', display: 'block' }}>
                        <span style={{ width: `${fraction * 100}%`, height: '100%', background: 'var(--accent)', display: 'block', transition: 'width .6s var(--ease)' }} />
                      </span>
                      {prog?.completed
                        ? <span className="kicker" style={{ color: 'var(--accent)' }}>Watched</span>
                        : secondsLeft !== null && secondsLeft > 0
                          ? <span className="faint" style={{ fontSize: 13, fontWeight: 500 }}>{formatRuntime(secondsLeft)} left</span>
                          : watchedLabel
                            ? <span className="faint" style={{ fontSize: 13, fontWeight: 500 }}>{watchedLabel}</span>
                            : null
                      }
                    </div>
                  </div>
                  <span className="cont-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: 14, fontWeight: 600 }}>
                    Resume <Icon name="play" size={14} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </section>
  );
}

// ── The Index — typographic catalog ──────────────────────────────────────────

function TheIndex({ titles }: { titles: TitleSummary[] }) {
  const [active, setActive] = useState<string | null>(null);
  const cur = (active ? titles.find((t) => t.id === active) : titles[0]) ?? titles[0];

  if (!cur) return null;

  return (
    <section style={{ padding: 'clamp(80px,12vh,160px) var(--page-x) clamp(80px,12vh,150px)' }}>
      <Reveal>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 48 }}>
          <div>
            <p className="kicker" style={{ marginBottom: 16 }}>The Index</p>
            <h2 className="display" style={{ fontSize: 'clamp(44px,5.5vw,80px)' }}>Every film.</h2>
          </div>
          <Link to="/browse" className="hoverline" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: 'var(--text-dim)', fontSize: 15, fontWeight: 600, paddingBottom: 8 }}>
            Browse by feeling <Icon name="arrow" size={16} />
          </Link>
        </header>
      </Reveal>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,0.65fr)', gap: 64, alignItems: 'start' }}>
        {/* Left: list */}
        <Reveal>
          <ul style={{ listStyle: 'none' }} onMouseLeave={() => setActive(null)}>
            {titles.map((t) => {
              const on = (active ?? titles[0]?.id) === t.id;
              return (
                <li key={t.id}>
                  <Link
                    to={`/title/${t.slug}`}
                    onMouseEnter={() => setActive(t.id)}
                    className="index-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1fr) 88px',
                      gap: 20,
                      alignItems: 'baseline',
                      width: '100%',
                      textAlign: 'left',
                      padding: '20px 4px',
                      borderTop: '1px solid var(--hairline-soft)',
                      color: active ? (on ? 'var(--text)' : 'var(--text-faint)') : 'var(--text)',
                      transition: 'color .4s var(--ease)',
                    }}
                  >
                    <span className="display" style={{ fontSize: 'clamp(26px,2.6vw,40px)', letterSpacing: '-0.035em', textTransform: 'uppercase' }}>
                      {t.name}
                    </span>
                    <span className="kicker" style={{ textAlign: 'right', color: 'inherit', opacity: 0.7 }}>{t.year}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Reveal>

        {/* Right: sticky preview */}
        <div style={{ position: 'sticky', top: 120 }}>
          <div
            style={{
              borderRadius: 18,
              overflow: 'hidden',
              aspectRatio: '4/5',
              position: 'relative',
              boxShadow: '0 40px 80px -40px rgba(0,0,0,0.9)',
            }}
          >
            <Still
              key={cur.id}
              imageUrl={coverImage(cur)}
              ken
              style={{ position: 'absolute', inset: 0, animation: 'screenIn .8s var(--ease) both' }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(var(--scrim-deep),0.8), transparent 50%)' }} />
            <div style={{ position: 'absolute', left: 24, right: 24, bottom: 24 }}>
              <h3 className="display" style={{ fontSize: 28, letterSpacing: '-0.03em', marginBottom: 10, textTransform: 'uppercase' }}>{cur.name}</h3>
              {cur.synopsis && (
                <p className="editorial" style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--text-dim)' }}>
                  {cur.synopsis.slice(0, 90)}…
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

const PULSE_BASE = 'var(--bg-2)';
const PULSE_ANIM = 'pulse 1.6s ease-in-out infinite alternate';

function Skeleton() {
  return (
    <div style={{ padding: '0 var(--page-x)', paddingTop: 128 }}>
      <style>{`@keyframes pulse{from{opacity:.4}to{opacity:.8}}`}</style>
      <div style={{ background: PULSE_BASE, borderRadius: 12, animation: PULSE_ANIM, height: '60vh', marginBottom: 48 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ background: PULSE_BASE, borderRadius: 12, animation: PULSE_ANIM, aspectRatio: '3/4', animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const { isAuthenticated, accessToken } = useAuth();
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [progressMap, setProgressMap] = useState<Map<string, ProgressItem>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // If auth isn't resolved yet, wait for the app-level refresh to complete.
      // trySilentRefresh is idempotent/deduped — it's already in-flight from App.tsx.
      const token = isAuthenticated ? accessToken : await trySilentRefresh();
      try {
        // Fetch home + progress in parallel when authenticated
        const [data, progressItems] = await Promise.all([
          getHome(token),
          token ? getProgress(token).catch(() => [] as ProgressItem[]) : Promise.resolve([] as ProgressItem[]),
        ]);
        setHome(data);
        if (progressItems.length > 0) {
          setProgressMap(new Map(progressItems.map((p) => [p.titleId, p])));
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Collect all titles for The Index
  const allTitles = home ? [
    ...(home.hero ? [home.hero] : []),
    ...home.rows.flatMap((r) => r.items),
  ].filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i) : [];

  // Identify rows by title string (authoritative — see catalog.service.ts)
  const continueRow = home?.rows.find((r) => r.title === 'Continue Watching');

  // All non-"Continue Watching" rows in API order
  const contentRows = home?.rows.filter((r) => r.title !== 'Continue Watching') ?? [];

  // First content row becomes the featured Thread section (portrait cards, editorial style)
  const threadRow = contentRows[0] as (typeof contentRows)[0] | undefined;

  // Remaining rows (New Arrivals, genre rows) get the landscape FilmRow grid
  const extraRows = contentRows.slice(1).filter((r) => r.items.length > 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Global grain overlay */}
      <div className="grain" aria-hidden="true" />

      {loading && <Skeleton />}

      {error && (
        <div style={{ padding: 'clamp(120px,20vh,200px) var(--page-x)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-faint)', fontSize: 15 }}>{error}</p>
        </div>
      )}

      {home && (
        <>
          {home.hero && <Marquee title={home.hero} isAuthenticated={isAuthenticated} />}

          {/* Continue Watching — auth only, always shown above the fold */}
          {continueRow && continueRow.items.length > 0 && isAuthenticated && (
            <Continue items={continueRow.items.slice(0, 4)} progressMap={progressMap} />
          )}

          {/* Featured editorial row (Trending Now or first API row) */}
          {threadRow && threadRow.items.length > 0 && (
            <Thread row={threadRow} />
          )}

          {/* Remaining rows: New Arrivals, genre rows, etc. */}
          {extraRows.map((row) => (
            <FilmRow key={row.title} row={row} />
          ))}

          {allTitles.length > 0 && (
            <TheIndex titles={allTitles} />
          )}

          {allTitles.length === 0 && !loading && (
            <div style={{ padding: 'clamp(80px,15vh,160px) var(--page-x)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-faint)', fontSize: 15, marginBottom: 24 }}>No titles yet.</p>
              {isAuthenticated ? (
                <Link to="/admin/upload" className="btn btn--ghost">Upload a title</Link>
              ) : (
                <Link to="/login" className="btn btn--ghost">Sign in to get started</Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
