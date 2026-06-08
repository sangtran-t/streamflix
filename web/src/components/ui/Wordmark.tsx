interface WordmarkProps {
  small?: boolean;
}

export function Wordmark({ small = false }: WordmarkProps) {
  const sq = small ? 8 : 10;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span
        aria-hidden="true"
        style={{
          width: sq,
          height: sq,
          borderRadius: 2.5,
          background: 'var(--accent)',
          boxShadow: '0 0 16px var(--accent-line)',
          transform: 'rotate(45deg)',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: small ? 16 : 19,
          letterSpacing: '-0.03em',
          color: 'var(--text)',
        }}
      >
        streamflix
      </span>
    </span>
  );
}
