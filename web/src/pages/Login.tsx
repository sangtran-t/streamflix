import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';

export default function Login() {
  const navigate = useNavigate();
  const { login, register, isAuthenticated, initialized } = useAuth();

  // Redirect already-authenticated users away immediately.
  useEffect(() => {
    if (initialized && isAuthenticated) {
      void navigate('/', { replace: true });
    }
  }, [initialized, isAuthenticated, navigate]);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
      void navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px var(--page-x)',
        fontFamily: 'var(--sans)',
      }}
    >
      {/* Background grain */}
      <div className="grain" aria-hidden="true" />

      {/* Ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(60% 60% at 50% 40%, rgba(227,189,118,0.06) 0%, transparent 70%)',
        }}
      />

      <div
        className="screen-anim"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          background: 'rgba(22,23,27,0.9)',
          backdropFilter: 'blur(28px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
          border: '1px solid var(--hairline)',
          borderRadius: 24,
          padding: 'clamp(32px,5vh,48px) clamp(28px,5vw,44px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
        }}
      >
        {/* Wordmark */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <span
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 26,
              letterSpacing: '-0.04em',
              color: 'var(--text)',
            }}
          >
            stream<span style={{ color: 'var(--accent)' }}>flix</span>
          </span>
        </div>

        {/* Mode toggle */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
            padding: 4,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            marginBottom: 32,
          }}
        >
          {(['login', 'register'] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                style={{
                  padding: '9px 0',
                  borderRadius: 9,
                  fontSize: 13.5,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  fontFamily: 'var(--sans)',
                  color: active ? 'var(--text)' : 'var(--text-dim)',
                  background: active ? 'rgba(255,255,255,0.09)' : 'none',
                  border: active ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                  transition: 'background .3s var(--ease), color .3s, border-color .3s',
                  cursor: 'pointer',
                }}
              >
                {m === 'login' ? 'Sign in' : 'Register'}
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {mode === 'register' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                Display name
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Your name"
                style={inputStyle}
              />
            </label>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              style={inputStyle}
            />
          </label>

          {error && (
            <p
              style={{
                fontSize: 13.5,
                color: '#e07070',
                background: 'rgba(200,80,80,0.10)',
                border: '1px solid rgba(200,80,80,0.22)',
                borderRadius: 10,
                padding: '10px 14px',
                lineHeight: 1.4,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              height: 48,
              borderRadius: 12,
              background: loading
                ? 'rgba(227,189,118,0.5)'
                : 'var(--accent)',
              color: '#16171b',
              fontFamily: 'var(--sans)',
              fontWeight: 700,
              fontSize: 14.5,
              letterSpacing: '-0.01em',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background .3s var(--ease), transform .2s',
            }}
            onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#edd08c'; }}
            onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; }}
          >
            {loading
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        {/* Toggle hint */}
        <p
          style={{
            marginTop: 24,
            textAlign: 'center',
            fontSize: 13.5,
            color: 'var(--text-faint)',
          }}
        >
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
            style={{
              color: 'var(--accent)',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--sans)',
              fontSize: 'inherit',
              padding: 0,
            }}
          >
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  height: 46,
  padding: '0 16px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--hairline)',
  color: 'var(--text)',
  fontFamily: 'var(--sans)',
  fontSize: 14.5,
  outline: 'none',
  transition: 'border-color .25s, box-shadow .25s',
  width: '100%',
};
