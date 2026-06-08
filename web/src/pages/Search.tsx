import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { type TitleSummary, listTitles } from '../api/catalog.ts';
import { Icon } from '../components/ui/Icon.tsx';
import { Still } from '../components/ui/Still.tsx';

const SUGGESTIONS = ['Quiet', 'Tense', 'Drama', 'Crime', 'Romance', 'Thriller', 'Warm'];

function formatRuntime(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function ResultItem({ title }: { title: TitleSummary }) {
  return (
    <Link
      to={`/title/${title.slug}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '80px minmax(0,1fr)',
        gap: 20,
        alignItems: 'center',
        padding: '14px 0',
        borderTop: '1px solid var(--hairline-soft)',
      }}
    >
      <div style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: '3/4', position: 'relative' }}>
        <Still imageUrl={title.posterImageUrl ?? title.heroImageUrl} style={{ position: 'absolute', inset: 0 }} />
      </div>
      <div>
        <h3 className="display" style={{ fontSize: 'clamp(16px,1.6vw,22px)', textTransform: 'uppercase', marginBottom: 6 }}>
          {title.name}
        </h3>
        <p className="editorial" style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {title.genres.slice(0, 2).join(', ')} · {title.year}
          {title.runtimeSeconds ? ` · ${formatRuntime(title.runtimeSeconds)}` : ''}
        </p>
      </div>
    </Link>
  );
}

export default function Search() {
  const [query, setQuery] = useState('');
  // useDeferredValue: input stays responsive at 60fps; heavy list re-renders
  // are deferred to a lower-priority task (React 18 concurrent rendering).
  const deferredQuery = useDeferredValue(query);
  const [catalog, setCatalog] = useState<TitleSummary[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listTitles().then(setCatalog).catch(() => {});
    // Autofocus
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const q = deferredQuery.trim().toLowerCase();
  const results = q
    ? catalog.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.genres.some((g) => g.toLowerCase().includes(q)) ||
        (t.synopsis ?? '').toLowerCase().includes(q)
      )
    : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 84 }}>
      <div className="grain" aria-hidden="true" />

      <div className="screen-anim" style={{ padding: 'clamp(48px,7vh,80px) var(--page-x) clamp(80px,12vh,140px)' }}>
        {/* Big search field */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--hairline-soft)', paddingBottom: 12, marginBottom: 48 }}>
          <Icon name="search" size={28} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, genres…"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--display)',
              fontWeight: 600,
              fontSize: 'clamp(28px,4vw,56px)',
              letterSpacing: '-0.03em',
              color: 'var(--text)',
              caretColor: 'var(--accent)',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
              <Icon name="close" size={22} />
            </button>
          )}
        </div>

        {/* Empty state */}
        {!query && (
          <div>
            <p className="kicker" style={{ marginBottom: 20 }}>Try a feeling</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="editorial"
                  style={{
                    padding: '10px 20px',
                    borderRadius: 999,
                    border: '1px solid var(--hairline)',
                    fontSize: 17,
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    background: 'none',
                    transition: 'all .3s var(--ease)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {query && (
          <div>
            <p className="kicker" style={{ marginBottom: 32 }}>
              {results.length > 0
                ? `${results.length} ${results.length === 1 ? 'result' : 'results'}`
                : ''}
            </p>
            {results.length === 0 ? (
              <p className="editorial" style={{ fontSize: 'clamp(18px,2.4vw,34px)', color: 'var(--text-dim)' }}>
                No films match "{query}."
              </p>
            ) : (
              <ul style={{ listStyle: 'none' }}>
                {results.map((t) => (
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
