/**
 * Upload Dashboard
 *
 * Two-panel layout:
 *   Left  — Add new upload form (title, synopsis, year, file drag-drop)
 *   Right — Live queue showing all uploads with phase-aware progress
 *
 * Uploads run in the background via UploadQueueContext.
 * User can navigate away and return to check status.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUploadQueue } from '../hooks/useUploadQueue';
import { Icon } from '../components/ui/Icon.tsx';
import { UploadQueueItem } from '../components/ui/UploadQueueItem.tsx';
import { UploadModal } from '../components/ui/UploadModal.tsx';
import { useAuth } from '../hooks/useAuth';

type FilterType = 'all' | 'active' | 'done' | 'error';

function EmptyQueue({ onAddClick }: { onAddClick: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
        textAlign: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: 'var(--accent-soft)',
          border: '1px solid var(--accent-line)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--accent)',
          marginBottom: 8,
          boxShadow: '0 12px 32px rgba(227, 189, 118, 0.15)',
        }}
      >
        <Icon name="upload" size={32} stroke={1.5} />
      </div>
      <p
        style={{
          fontFamily: 'var(--display)',
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: '-0.02em',
          color: 'var(--text)',
        }}
      >
        Your queue is empty
      </p>
      <p style={{ fontSize: 14, color: 'var(--text-faint)', lineHeight: 1.5, maxWidth: 280 }}>
        Ready to stream? Add a new video file to start the transcoding process.
      </p>
      
      <button
        onClick={onAddClick}
        className="btn btn--play"
        style={{
          marginTop: 12,
          height: 48,
          padding: '0 32px',
          borderRadius: 12,
          fontSize: 15,
          gap: 10,
        }}
      >
        <Icon name="plus" size={16} stroke={2} />
        Upload Video
      </button>
    </div>
  );
}

export default function Upload() {
  const { isAuthenticated, isAdmin, initialized, accessToken } = useAuth();
  const navigate = useNavigate();
  const { items, remove, retry, resumePolling } = useUploadQueue();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // ── Auth guard & polling resume ───────────────────────────────────────────
  useEffect(() => {
    if (!initialized) return;
    if (!isAuthenticated) void navigate('/login', { replace: true });
    else if (!isAdmin) void navigate('/', { replace: true });
    else if (accessToken) resumePolling(accessToken);
  }, [initialized, isAuthenticated, isAdmin, navigate, accessToken, resumePolling]);

  // Derive stats
  const activeCount = items.filter(
    (it) => it.phase === 'uploading' || it.phase === 'processing',
  ).length;

  // Filtering & Pagination
  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') return items;
    if (statusFilter === 'active') return items.filter((it) => it.phase === 'uploading' || it.phase === 'processing');
    return items.filter((it) => it.phase === statusFilter);
  }, [items, statusFilter]);

  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, currentPage]);

  const handleFilterChange = (filter: FilterType) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 84 }}>
      <div className="grain" aria-hidden="true" />

      <div
        className="screen-anim"
        style={{
          padding: 'clamp(40px,6vh,72px) var(--page-x) clamp(64px,10vh,120px)',
          maxWidth: 1024,
          margin: '0 auto',
        }}
      >
        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <p className="kicker" style={{ marginBottom: 14 }}>
            <Link to="/" style={{ color: 'inherit', opacity: 0.7 }}>
              Home
            </Link>
            <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
            Upload
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <h1
                  className="display display--xl"
                  style={{ fontSize: 'clamp(28px,4vw,42px)', textTransform: 'uppercase', lineHeight: 1 }}
                >
                  Upload Dashboard
                </h1>
                {activeCount > 0 && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '5px 14px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--accent)',
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent-line)',
                      animation: 'pulse-badge 2s ease-in-out infinite',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        animation: 'pulse-dot 1.4s ease-in-out infinite',
                      }}
                    />
                    {activeCount} in progress
                  </span>
                )}
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-faint)', marginTop: 12, lineHeight: 1.5 }}>
                Add videos to the queue — they upload and transcode in the background.
                <br />
                You can navigate away and return to check progress anytime.
              </p>
            </div>
          </div>
        </div>

        {/* ── Dashboard Layout ─────────────────────────────────────────────── */}
        <div>
          {/* ── Queue dashboard ───────────────────────────────────── */}
          <div>
            {/* Queue header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2
                  style={{
                    fontFamily: 'var(--display)',
                    fontWeight: 700,
                    fontSize: 20,
                    letterSpacing: '-0.03em',
                    color: 'var(--text)',
                    lineHeight: 1,
                  }}
                >
                  Queue
                </h2>
                {items.length > 0 && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 22,
                      height: 22,
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid var(--hairline)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-dim)',
                      padding: '0 6px',
                    }}
                  >
                    {items.length}
                  </span>
                )}
              </div>

              {/* Stats bar & Add button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                {items.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 12, border: '1px solid var(--hairline)' }}>
                    {[
                      { id: 'all', count: items.length, label: 'All', color: 'var(--text)' },
                      {
                        id: 'active',
                        count: items.filter((it) => it.phase === 'uploading' || it.phase === 'processing').length,
                        label: 'Active',
                        color: 'var(--accent)',
                      },
                      {
                        id: 'done',
                        count: items.filter((it) => it.phase === 'done').length,
                        label: 'Done',
                        color: '#7dcea0',
                      },
                      {
                        id: 'error',
                        count: items.filter((it) => it.phase === 'error').length,
                        label: 'Failed',
                        color: '#e07070',
                      },
                    ].map((s) => {
                      const isActiveTab = statusFilter === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => handleFilterChange(s.id as FilterType)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: isActiveTab ? 'rgba(255,255,255,0.1)' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'background 0.2s, color 0.2s',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--display)',
                              fontSize: 15,
                              fontWeight: 700,
                              color: isActiveTab ? s.color : 'var(--text-faint)',
                              lineHeight: 1,
                            }}
                          >
                            {s.count}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: isActiveTab ? 'var(--text)' : 'var(--text-ghost)',
                              fontWeight: 600,
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {s.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="btn btn--play"
                  style={{
                    height: 38,
                    padding: '0 18px',
                    borderRadius: 999,
                    fontSize: 14,
                    gap: 6,
                  }}
                >
                  <Icon name="plus" size={16} stroke={2.5} />
                  Add
                </button>
              </div>
            </div>

            {/* Queue container */}
            <div
              style={{
                background: 'rgba(22,23,27,0.75)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid var(--hairline)',
                borderRadius: 42,
                overflow: 'hidden',
                minHeight: 220,
                boxShadow: '0 16px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              {filteredItems.length === 0 ? (
                items.length === 0 ? (
                  <EmptyQueue onAddClick={() => setIsModalOpen(true)} />
                ) : (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>
                    <p>No videos match this filter.</p>
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 10 }}>
                  {paginatedItems.map((item) => (
                    <UploadQueueItem
                      key={item.id}
                      item={item}
                      onRemove={remove}
                      onRetry={(id) => {
                        if (accessToken) retry(id, accessToken);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: '0 8px' }}>
                <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>
                  Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, filteredItems.length)} of {filteredItems.length}
                </span>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn btn--ghost"
                    style={{ height: 32, padding: '0 12px', fontSize: 13, borderRadius: 8, opacity: currentPage === 1 ? 0.3 : 1 }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn btn--ghost"
                    style={{ height: 32, padding: '0 12px', fontSize: 13, borderRadius: 8, opacity: currentPage === totalPages ? 0.3 : 1 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Info footer */}
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-faint)',
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon name="info" size={13} />
              Uploads continue in the background. Navigate freely and return to check status.
            </p>
          </div>
        </div>
      </div>
      {isModalOpen && <UploadModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
