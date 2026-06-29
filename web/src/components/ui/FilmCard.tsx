import { Link } from 'react-router-dom';
import { type TitleSummary } from '../../api/catalog.ts';
import { Icon } from './Icon.tsx';
import { Still } from './Still.tsx';
import { backdropImage, coverImage } from '../../utils/image.ts';

export function FilmCard({ title, tall = false }: { title: TitleSummary; tall?: boolean }) {
  return (
    <Link to={`/title/${title.slug}`} className="film-card">
      <article>
        <div className="film-card-media" style={{ aspectRatio: tall ? '3/4' : '16/9' }}>
          <Still
            imageUrl={tall ? coverImage(title) : backdropImage(title)}
            style={{ position: 'absolute', inset: 0 }}
          />

          {/* Top Right Year Tag */}
          {title.year && <div className="glass-pill">{title.year}</div>}

          <div className="film-card-play">
            <span className="film-card-play-icon">
              <Icon name="play" size={21} />
            </span>
          </div>

          {/* Glassmorphism Info Block */}
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              left: 4,
              right: 4,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 16,
              padding: tall ? '10px 12px' : '10px 16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 20,
              display: 'flex',
              flexDirection: tall ? 'column' : 'row',
              alignItems: tall ? 'flex-start' : 'center',
              justifyContent: tall ? 'flex-start' : 'space-between',
              gap: tall ? 0 : 12,
            }}
          >
            <div
              className="title-scroll-container"
              style={{ flex: 1 }}
              onMouseEnter={(e) => {
                const el = e.currentTarget.firstElementChild as HTMLElement;
                if (el && el.scrollWidth > e.currentTarget.clientWidth) {
                  const dist = el.scrollWidth - e.currentTarget.clientWidth + 8;
                  el.style.setProperty('--scroll-dist', `-${dist}px`);
                  el.style.setProperty('--scroll-dur', `${Math.max(dist / 25, 2)}s`);
                  el.classList.add('animate-marquee');
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget.firstElementChild as HTMLElement;
                if (el) {
                  el.classList.remove('animate-marquee');
                }
              }}
            >
              <h3
                className="card-title title-scroll-text"
                style={{
                  color: 'var(--text)',
                  marginBottom: tall && title.genres && title.genres.length > 0 ? 4 : 0,
                  WebkitLineClamp: 'unset', // Override the 2-line clamp to allow scrolling
                }}
              >
                {title.name}
              </h3>
            </div>

            {title.genres && title.genres.length > 0 && (
              <p
                className="kicker"
                style={{
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: 12,
                  letterSpacing: '0.02em',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {title.genres.slice(0, 2).join(' · ')}
              </p>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
