import { type CSSProperties } from 'react';

interface IconProps {
  name: keyof typeof paths;
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
}

const paths = {
  play:   <path d="M7 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  pause:  <g><rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/></g>,
  plus:   <g><path d="M12 5v14M5 12h14"/></g>,
  check:  <path d="M5 12.5l4.5 4.5L19 7"/>,
  search: <g><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-3.8-3.8"/></g>,
  arrow:  <path d="M5 12h14M13 6l6 6-6 6"/>,
  back:   <path d="M19 12H5M11 6l-6 6 6 6"/>,
  close:  <path d="M6 6l12 12M18 6L6 18"/>,
  sound:  <g><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9.5a3.5 3.5 0 010 5"/></g>,
  cc:     <g><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M9.5 10.5a2 2 0 100 3M15.5 10.5a2 2 0 100 3"/></g>,
  full:   <path d="M8 4H4v4M16 4h4v4M16 20h4v-4M8 20H4v-4"/>,
  info:   <g><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/></g>,
  star:   <path d="M12 4l2.3 5 5.4.5-4.1 3.6 1.3 5.3L12 17l-4.8 2.4 1.3-5.3-4.1-3.6 5.4-.5z" />,
} as const;

export function Icon({ name, size = 18, stroke = 1.6, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
