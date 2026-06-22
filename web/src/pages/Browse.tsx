import { useEffect, useState } from 'react';
import { type TitleSummary, listTitles } from '../api/catalog.ts';
import { Icon } from '../components/ui/Icon.tsx';
import { Reveal } from '../components/ui/Reveal.tsx';
import { FilmCard } from '../components/ui/FilmCard.tsx';

const MOODS = [
  'Quiet',
  'Tender',
  'Tense',
  'Nocturnal',
  'Warm',
  'Wistful',
  'Cold',
  'Hopeful',
  'Wonder',
  'Slow',
];

// (Removed local cards)

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
    setSelectedMoods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  // With moods selected, filter titles whose genres overlap selected moods (loose match)
  const filtered =
    selectedMoods.length === 0
      ? titles
      : titles.filter((t) =>
          selectedMoods.some(
            (m) =>
              t.genres.some((g) => g.toLowerCase().includes(m.toLowerCase())) ||
              t.name.toLowerCase().includes(m.toLowerCase()),
          ),
        );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 84 }}>
      <div className="grain" aria-hidden="true" />

      <div
        className="screen-anim"
        style={{ padding: 'clamp(56px,8vh,96px) var(--page-x) clamp(80px,12vh,140px)' }}
      >
        {/* Header */}
        <Reveal>
          <p className="kicker" style={{ marginBottom: 24 }}>
            Browse
          </p>
          <h1
            className="display"
            style={{
              fontSize: 'clamp(40px,5vw,72px)',
              letterSpacing: '-0.03em',
              marginBottom: 20,
            }}
          >
            How do you want it to{' '}
            <em
              className="editorial"
              style={{
                color: 'var(--accent)',
                fontSize: '1.05em',
              }}
            >
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
                  style={{
                    padding: '10px 20px',
                    borderRadius: 999,
                    border: `1px solid ${active ? 'var(--accent-line)' : 'var(--hairline)'}`,
                    fontFamily: 'var(--sans)',
                    fontWeight: 500,
                    fontSize: 16,
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
                style={{
                  padding: '10px 16px',
                  borderRadius: 999,
                  border: '1px solid var(--hairline-soft)',
                  fontSize: 13.5,
                  color: 'var(--text-faint)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'none',
                  transition: 'all .3s',
                }}
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
              <div
                key={i}
                style={{
                  aspectRatio: '4/5',
                  borderRadius: 18,
                  background: 'var(--bg-2)',
                  animation: 'pulse 1.6s ease-in-out infinite alternate',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
            <style>{`@keyframes pulse{from{opacity:.4}to{opacity:.8}}`}</style>
          </div>
        ) : (
          <div>
            {selectedMoods.length > 0 && (
              <p className="kicker" style={{ marginBottom: 32 }}>
                {filtered.length} {filtered.length === 1 ? 'film' : 'films'} ·{' '}
                {selectedMoods.join(', ')}
              </p>
            )}

            {filtered.length === 0 && selectedMoods.length > 0 ? (
              <p
                style={{ fontSize: 'clamp(18px,2vw,24px)', color: 'var(--text-dim)', fontFamily: 'var(--sans)' }}
              >
                No films match {selectedMoods.join(' + ')}.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '32px 24px' }}>
                {filtered.map((t, i) => (
                  <Reveal key={t.id} delay={Math.min(i * 40, 400)}>
                    <FilmCard title={t} tall />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
