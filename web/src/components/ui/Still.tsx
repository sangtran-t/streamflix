import { type CSSProperties, type ReactNode } from 'react';

interface StillProps {
  /** Real image URL — shown with grain+vignette+scrim treatment */
  imageUrl?: string | null;
  /** Fallback gradient grade when no image is available */
  grade?: {
    deep: string; glow: string; shadow: string; a: string; b: string;
  };
  ken?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Cinematic film still. Uses a real image when available (with grain+vignette
 * overlay to keep text legible), or falls back to a color-grade gradient.
 */
export function Still({ imageUrl, grade, ken = false, className = '', style = {}, children }: StillProps) {
  const gradeVars = grade
    ? ({
        '--c-deep':   grade.deep,
        '--c-glow':   grade.glow,
        '--c-shadow': grade.shadow,
        '--c-a':      grade.a,
        '--c-b':      grade.b,
      } as CSSProperties)
    : {};

  return (
    <div className={`still ${className}`} style={{ ...gradeVars, ...style }}>
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 1,
          }}
        />
      )}
      {ken && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'inherit',
            animation: 'kenburns 18s var(--ease-soft) infinite alternate',
            zIndex: 1,
          }}
        />
      )}
      {children}
    </div>
  );
}
