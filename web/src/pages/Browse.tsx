import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { type TitleSummary, listTitles } from '../api/catalog.ts';
import { Icon } from '../components/ui/Icon.tsx';
import { Reveal } from '../components/ui/Reveal.tsx';
import { Still } from '../components/ui/Still.tsx';

const MOODS = ['Quiet', 'Tender', 'Tense', 'Nocturnal', 'Warm', 'Wistful', 'Cold', 'Hopeful', 'Wonder', 'Slow'];

function formatRuntime(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Collection card ───────────────────────────────────────────────────────────

function CollectionCard({ title, index }: { title: TitleSummary; index: number }) {
  const [hov, setHov] = useState(false);
  return (
    <Link
      to={`/title/${title.slug}`}
      style={{ display: 'block' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{
        position: 'relative',
        borderRadius: 18,
        overflow: 'hidden',
        aspectRatio: '4/5',
        transform: hov ? 'translateY(-6px)' : 'none',
        transition: 'transform .6s var(--ease), box-shadow .6s var(--ease)',
        boxShadow: hov ? '0 30px 60px -28px rgba(0,0,0,0.8)' : '0 0 0 rgba(0,0,0,0)',
      }}>
        <Still imageUrl={title.posterImageUrl ?? title.heroImageUrl} style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(var(--scrim-deep),0.85) 0%, transparent 55%)' }} />
        <div style={{ position: 'absolute', left: 24, right: 24, bottom: 28 }}>
          <p className="kicker" style={{ marginBottom: 10 }}>
            {String(index + 1).padStart(2, '0')} · {title.genres[0]}
          </p>
          <h3 className="display" style={{ fontSize: 'clamp(20px,1.8vw,28px)', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
            {title.name}
          </h3>
        </div>
      </div>
    </Link>
  );
}

// ── Result list item ──────────────────────────────────────────────────────────

function ResultItem({ title }: { title: TitleSummary }) {
  return (
    <Link
      to={`/title/${title.slug}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '96px minmax(0,1fr)',
        gap: 24,
        alignItems: 'center',
        padding: '16px 0',
        borderTop: '1px solid var(--hairline-soft)',
        transition: 'opacity .3s',
      }}
    >
      <div style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: '3/4', position: 'relative' }}>
        <Still imageUrl={title.posterImageUrl ?? title.heroImageUrl} style={{ position: 'absolute', inset: 0 }} />
      </div>
      <div>
        <h3 className="display" style={{ fontSize: 'clamp(18px,1.8vw,24px)', textTransform: 'uppercase', marginBottom: 8 }}>
          {title.name}
        </h3>
        <p className="editorial" style={{ fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {title.genres.slice(0, 2).join(', ')} · {title.year}
          {title.runtimeSeconds ? ` · ${formatRuntime(title.runtimeSeconds)}` : ''}
        </p>
      </div>
    </Link>
  );
}

// ── Browse ────────────────────────────────────────────────────────────────────

export default function Browse() {
  const [titles, setTitles] = useState<TitleSummary[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTitles()
      .then(setTitles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleMood = (m: string) => {
    setSelectedMoods((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  // With moods selected, filter titles whose genres overlap selected moods (loose match)
  const filtered = selectedMoods.length === 0
    ? titles
    : titles.filter((t) =>
        selectedMoods.some((m) =>
          t.genres.some((g) => g.toLowerCase().includes(m.toLowerCase())) ||
          t.name.toLowerCase().includes(m.toLowerCase())
        )
      );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 84 }}>
      <div className="grain" aria-hidden="true" />

      <div className="screen-anim" style={{ padding: 'clamp(56px,8vh,96px) var(--page-x) clamp(80px,12vh,140px)' }}>
        {/* Header */}
        <Reveal>
          <p className="kicker" style={{ marginBottom: 24 }}>Browse</p>
          <h1 className="display display--xl" style={{ fontSize: 'clamp(48px,7.5vw,120px)', textTransform: 'uppercase', marginBottom: 20 }}>
            How do you want it to{' '}
            <em className="editorial" style={{ color: 'var(--accent)', fontFamily: 'var(--serif)', fontStyle: 'italic', textTransform: 'lowercase', fontSize: '1.05em' }}>
              feel
            </em>
            ?
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text-dim)', maxWidth: '48ch', marginBottom: 56 }}>
            Filter by mood. The right film finds you.
          </p>
        </Reveal>

        {/* Mood chips */}
        <Reveal delay={80}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 80 }}>
            {MOODS.map((mood) => {
              const active = selectedMoods.includes(mood);
              return (
                <button
                  key={mood}
                  onClick={() => toggleMood(mood)}
                  className="editorial"
                  style={{
                    padding: '10px 20px',
                    borderRadius: 999,
                    border: `1px solid ${active ? 'var(--accent-line)' : 'var(--hairline)'}`,
                    fontSize: 17,
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--text)' : 'var(--text-dim)',
                    cursor: 'pointer',
                    transition: 'all .3s var(--ease)',
                  }}
                >
                  {mood}
                </button>
              );
            })}
            {selectedMoods.length > 0 && (
              <button
                onClick={() => setSelectedMoods([])}
                style={{ padding: '10px 16px', borderRadius: 999, border: '1px solid var(--hairline-soft)', fontSize: 13.5, color: 'var(--text-faint)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', transition: 'all .3s' }}
              >
                <Icon name="close" size={14} /> Clear
              </button>
            )}
          </div>
        </Reveal>

        {/* Body */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ aspectRatio: '4/5', borderRadius: 18, background: 'var(--bg-2)', animation: 'pulse 1.6s ease-in-out infinite alternate', animationDelay: `${i * 0.15}s` }} />
            ))}
            <style>{`@keyframes pulse{from{opacity:.4}to{opacity:.8}}`}</style>
          </div>
        ) : selectedMoods.length === 0 ? (
          /* No filter → collection cards */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
            {titles.map((t, i) => (
              <Reveal key={t.id} delay={Math.min(i * 80, 400)}>
                <CollectionCard title={t} index={i} />
              </Reveal>
            ))}
          </div>
        ) : (
          /* Filtered → result list */
          <div>
            <p className="kicker" style={{ marginBottom: 32 }}>
              {filtered.length} {filtered.length === 1 ? 'film' : 'films'} · {selectedMoods.join(', ')}
            </p>
            {filtered.length === 0 ? (
              <p className="editorial" style={{ fontSize: 'clamp(18px,2vw,28px)', color: 'var(--text-dim)' }}>
                No films match {selectedMoods.join(' + ')}.
              </p>
            ) : (
              <ul style={{ listStyle: 'none' }}>
                {filtered.map((t) => (
                  <li key={t.id}><ResultItem title={t} /></li>
                ))}
                <li style={{ borderTop: '1px solid var(--hairline-soft)' }} />
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
