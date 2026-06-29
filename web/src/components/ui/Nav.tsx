import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon.tsx';
import { useAuth } from '../../hooks/useAuth.ts';
import { useUploadQueue } from '../../contexts/UploadQueueContext.ts';
import { Wordmark } from './Wordmark.tsx';

interface NavProps {
  userInitial?: string | null;
}

const TABS = [
  { id: 'home', label: 'Tonight', path: '/' },
  { id: 'browse', label: 'Browse', path: '/browse' },
  { id: 'search', label: 'Search', path: '/search' },
] as const;

export function Nav({ userInitial }: NavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, isAdmin } = useAuth();
  const { activeCount } = useUploadQueue();
  const [scrolled, setScrolled] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [ind, setInd] = useState({ left: 0, width: 0, on: false });
  const measured = useRef(false);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleLogout = () => {
    setShowMenu(false);
    void logout().then(() => {
      void navigate('/');
    });
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const activeTab = TABS.find((t) => {
    if (t.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(t.path);
  });

  useLayoutEffect(() => {
    const measure = () => {
      const el = activeTab && btnRefs.current[activeTab.id];
      if (el) {
        setInd({ left: el.offsetLeft, width: el.offsetWidth, on: true });
        measured.current = true;
      } else {
        setInd((s) => ({ ...s, on: false }));
      }
    };
    measure();
    void document.fonts.ready.then(measure);
  }, [activeTab, location.pathname]);

  if (location.pathname.startsWith('/watch/')) return null;

  return (
    <nav
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: 1440,
        zIndex: 200,

        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '0 20px',
        height: 68,

        borderRadius: 18,
        background: 'rgba(22, 23, 27, 0.88)',
        backdropFilter: 'blur(28px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
        border: '1px solid rgba(255,255,255,0.09)',

        boxShadow: scrolled
          ? '0 16px 56px rgba(0,0,0,0.64), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 4px 20px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.05)',

        transition: 'box-shadow .5s var(--ease)',
      }}
    >
      <Link to="/" style={{ justifySelf: 'start' }}>
        <Wordmark />
      </Link>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: 4,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: ind.left,
            width: ind.width,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.13)',
            opacity: ind.on ? 1 : 0,
            transition: measured.current
              ? 'left .5s var(--ease), width .5s var(--ease), opacity .3s'
              : 'opacity .3s',
            pointerEvents: 'none',
          }}
        />
        {TABS.map((tab) => {
          const active = activeTab?.id === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                btnRefs.current[tab.id] = el;
              }}
              onClick={() => {
                void navigate(tab.path);
              }}
              style={{
                position: 'relative',
                zIndex: 1,
                padding: '8px 18px',
                borderRadius: 999,
                fontSize: 13.5,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: active ? 'var(--text)' : 'var(--text-dim)',
                transition: 'color .35s var(--ease)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--sans)',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        style={{ justifySelf: 'end', minWidth: 72, display: 'flex', justifyContent: 'flex-end' }}
      >
        {userInitial !== null &&
          (userInitial ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowMenu((s) => !s)}
                aria-label="Account menu"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'linear-gradient(140deg,#473827,#1a150e)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--display)',
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  outline: showMenu ? '2px solid rgba(255,255,255,0.18)' : 'none',
                  outlineOffset: 2,
                  transition: 'outline .15s',
                }}
              >
                {userInitial}
              </button>

              {showMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    right: 0,
                    background: 'rgba(22,23,27,0.97)',
                    backdropFilter: 'blur(28px)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 14,
                    padding: '6px 0',
                    minWidth: 160,
                    zIndex: 300,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
                  }}
                >
                  {isAdmin && (
                    <Link
                      to="/admin/upload"
                      onClick={() => setShowMenu(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '11px 18px',
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--text-dim)',
                        transition: 'color .2s',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = 'var(--text)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)';
                      }}
                    >
                      <Icon name="upload" size={14} />
                      Upload
                      {activeCount > 0 && (
                        <span
                          style={{
                            marginLeft: 'auto',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 20,
                            height: 20,
                            borderRadius: 999,
                            background: 'var(--accent-soft)',
                            border: '1px solid var(--accent-line)',
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: 'var(--accent)',
                            padding: '0 5px',
                          }}
                        >
                          {activeCount}
                        </span>
                      )}
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      textAlign: 'left',
                      padding: '11px 18px',
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--text-dim)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--sans)',
                      transition: 'color .2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)';
                    }}
                  >
                    <Icon name="close" size={14} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              style={{
                padding: '7px 16px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.12)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text)',
                letterSpacing: '-0.01em',
                transition: 'background .3s var(--ease), border-color .3s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              Sign in
            </Link>
          ))}
      </div>
    </nav>
  );
}
