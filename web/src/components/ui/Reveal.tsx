import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  as?: keyof JSX.IntrinsicElements;
}

export function Reveal({
  children,
  delay = 0,
  className = '',
  style = {},
  as: Tag = 'div',
}: RevealProps) {
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
          if (e.isIntersecting) {
            show();
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);

    const ff = setTimeout(() => el.classList.add('in'), 900 + delay);
    return () => {
      io.disconnect();
      clearTimeout(ff);
    };
  }, [delay]);

  const Element = Tag as 'div';
  return (
    <Element
      ref={ref as unknown as React.RefObject<HTMLDivElement>}
      className={`reveal ${className}`}
      style={style}
    >
      {children}
    </Element>
  );
}
