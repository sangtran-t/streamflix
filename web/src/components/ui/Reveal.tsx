import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Reveal-on-scroll: opacity 0→1 + translateY(22px→0) over 1.1s.
 * Always reveals via a failsafe timeout so content never stays hidden.
 * Respects prefers-reduced-motion via CSS.
 */
export function Reveal({ children, delay = 0, className = '', style = {}, as: Tag = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const show = () => setTimeout(() => el.classList.add('in'), delay);

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.95) {
      show();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { show(); io.unobserve(el); }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);

    // Failsafe: never leave content hidden
    const ff = setTimeout(() => el.classList.add('in'), 900 + delay);
    return () => { io.disconnect(); clearTimeout(ff); };
  }, [delay]);

  // @ts-expect-error -- polymorphic ref
  return <Tag ref={ref} className={`reveal ${className}`} style={style}>{children}</Tag>;
}
