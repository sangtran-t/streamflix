/**
 * UploadQueueItem — Single row in the upload dashboard queue.
 *
 * Renders differently based on the item's current phase:
 * - uploading:  animated progress bar + percentage
 * - processing: pulsing transcode status chip
 * - done:       success state + Play Now link
 * - error:      error message + Retry / Remove actions
 */


import { useEffect, useState } from 'react';
import { type QueueItem, type UploadPhase } from '../../hooks/useUploadQueue';
import { Icon } from './Icon';

// ─── Format Utils ─────────────────────────────────────────────────────────────
function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true }).format(new Date(timestamp));
}

function formatDuration(ms: number) {
  if (ms < 0) return '0s';
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function LiveDuration({ start, end }: { start: number; end?: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (end) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [end]);

  const ms = (end || now) - start;
  return <>{formatDuration(ms)}</>;
}

interface Props {
  item: QueueItem;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

// ─── Phase label & color helpers ─────────────────────────────────────────────

const phaseConfig: Record<
  UploadPhase,
  { label: string; color: string; bg: string; border: string }
> = {
  queued: {
    label: 'Queued',
    color: 'var(--text-dim)',
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.10)',
  },
  uploading: {
    label: 'Uploading',
    color: '#7ab8f5',
    bg: 'rgba(100,160,240,0.10)',
    border: 'rgba(100,160,240,0.25)',
  },
  processing: {
    label: 'Transcoding',
    color: 'var(--accent)',
    bg: 'var(--accent-soft)',
    border: 'var(--accent-line)',
  },
  done: {
    label: 'Ready',
    color: '#7dcea0',
    bg: 'rgba(80,190,120,0.10)',
    border: 'rgba(80,190,120,0.25)',
  },
  error: {
    label: 'Failed',
    color: '#e07070',
    bg: 'rgba(200,80,80,0.10)',
    border: 'rgba(200,80,80,0.22)',
  },
};



function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function PhaseBadge({ phase }: { phase: UploadPhase }) {
  const cfg = phaseConfig[phase];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {phase === 'processing' && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: cfg.color,
            animation: 'pulse-dot 1.4s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
      )}
      {cfg.label}
    </span>
  );
}



// ─── Film icon placeholder ────────────────────────────────────────────────────

function FilmThumb({ phase }: { phase: UploadPhase }) {
  const cfg = phaseConfig[phase];
  return (
    <div
      style={{
        width: 52,
        height: 52,
        borderRadius: 16,
        flexShrink: 0,
        alignSelf: 'center',
        display: 'grid',
        placeItems: 'center',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        transition: 'background 0.3s, border-color 0.3s, color 0.3s',
      }}
    >
      <Icon name="film" size={22} stroke={1.4} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UploadQueueItem({ item, onRemove, onRetry }: Props) {

  const isActive = item.phase === 'uploading' || item.phase === 'processing';
  const isDismissable = item.phase === 'done' || item.phase === 'error';

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: 16,
        borderRadius: 32,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--hairline-soft)',
        transition: 'background 0.25s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      {/* Shimmer for active items */}
      {isActive && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(227,189,118,0.03) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2.5s linear infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Film icon */}
      <FilmThumb phase={item.phase} />

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '60%',
            }}
          >
            {item.name}
          </span>
          <PhaseBadge phase={item.phase} />
        </div>

        {/* Filename & Time Metadata */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px 16px',
            fontSize: 12,
            color: 'var(--text-faint)',
            marginBottom: 12,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.filename}
            {item.file && <span style={{ color: 'var(--text-ghost)' }}>· {formatBytes(item.file.size)}</span>}
          </span>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-ghost)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} title="Started at">
              <Icon name="clock" size={12} /> {formatTime(item.addedAt)}
            </span>
            {item.finishedAt && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} title="Finished at">
                <Icon name={item.phase === 'error' ? 'close' : 'check'} size={12} /> {formatTime(item.finishedAt)}
              </span>
            )}
            {isActive && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)' }} title="Duration">
                <Icon name="info" size={11} /> <LiveDuration start={item.addedAt} end={item.finishedAt} />
              </span>
            )}
          </div>
        </div>

        {/* Phase-specific Horizontal Timeline */}
        <HorizontalTimeline 
          phase={item.phase} 
          uploadPct={item.uploadPct} 
          error={item.error} 
          transcodeStatus={item.transcodeStatus}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        {item.phase === 'error' && (
          <button
            onClick={() => onRetry(item.id)}
            className="btn btn--ghost"
            style={{ padding: '0 16px', height: 32, fontSize: 12, borderRadius: 999 }}
          >
            <Icon name="refresh" size={14} /> Retry
          </button>
        )}
        {isDismissable && (
          <button
            onClick={() => onRemove(item.id)}
            className="btn btn--ghost"
            style={{
              height: 34,
              width: 34,
              padding: 0,
              borderRadius: 999,
              justifyContent: 'center',
              color: 'var(--text-faint)',
            }}
            aria-label={`Remove ${item.name} from queue`}
          >
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Horizontal Timeline ────────────────────────────────────────────────────────

function HorizontalTimeline({ 
  phase, 
  uploadPct, 
  error,
  transcodeStatus
}: { 
  phase: UploadPhase; 
  uploadPct: number; 
  error?: string;
  transcodeStatus?: string;
}) {
  const isQueued = phase === 'queued';
  const isUploading = phase === 'uploading';
  const isProcessing = phase === 'processing';
  const isDone = phase === 'done';
  const isError = phase === 'error';

  // Determine which step failed based on whether transcodeStatus is set
  const failedAtUpload = isError && !transcodeStatus;
  const failedAtTranscode = isError && !!transcodeStatus;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 20, width: '100%' }}>
      <TimelineStep 
        label="Queued" 
        isActive={isQueued} 
        isDone={!isQueued} 
      />
      <TimelineLine isDone={!isQueued && !failedAtUpload} />
      
      <TimelineStep 
        label={failedAtUpload ? (error || 'Upload Failed') : isUploading ? `Uploading ${uploadPct}%` : 'Uploaded'} 
        isActive={isUploading || failedAtUpload} 
        isDone={isProcessing || isDone || failedAtTranscode} 
        isError={failedAtUpload}
        pct={isUploading ? uploadPct : undefined}
      />
      <TimelineLine isDone={isProcessing || isDone || failedAtTranscode} />
      
      <TimelineStep 
        label={failedAtTranscode ? (error || 'Transcode Failed') : "Transcoding"} 
        isActive={isProcessing || failedAtTranscode} 
        isDone={isDone} 
        isError={failedAtTranscode}
        pulse={isProcessing}
      />
      <TimelineLine isDone={isDone} />
      
      <TimelineStep 
        label={isDone ? 'Ready' : 'Pending'} 
        isActive={isDone} 
        isDone={isDone} 
      />
    </div>
  );
}

function TimelineStep({ label, isActive, isDone, isError, pulse, pct }: any) {
  const color = isError ? '#e07070' : isDone ? '#7dcea0' : isActive ? 'var(--accent)' : 'var(--text-faint)';
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: isDone ? color : isActive ? color : 'transparent',
            border: `1.5px solid ${isDone || isActive ? color : 'rgba(255,255,255,0.2)'}`,
            display: 'grid',
            placeItems: 'center',
            color: '#111',
            boxShadow: pulse ? `0 0 0 4px rgba(227, 189, 118, 0.15)` : 'none',
            zIndex: 1,
          }}
        >
          {isDone && !isError && <Icon name="check" size={10} stroke={3} />}
          {isError && <Icon name="close" size={10} stroke={3} />}
        </div>
        <span
          title={label}
          style={{
            fontSize: 12,
            fontWeight: isActive || isDone ? 600 : 500,
            color: isActive || isDone ? 'var(--text)' : 'var(--text-faint)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 180,
          }}
        >
          {label}
        </span>
      </div>
      
      {/* Mini Progress Bar for active step */}
      {pct !== undefined && isActive && (
        <div style={{ position: 'absolute', top: 22, left: 22, right: 0, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.2s ease-out' }} />
        </div>
      )}
    </div>
  );
}

function TimelineLine({ isDone }: { isDone: boolean }) {
  return (
    <div style={{ 
      flex: 1, 
      minWidth: 16,
      height: 2, 
      background: isDone ? '#7dcea0' : 'rgba(255,255,255,0.08)', 
      margin: '0 12px',
      marginTop: 6, // Aligns with the 14px circle (14/2 - 2/2 = 6)
      borderRadius: 2,
      transition: 'background 0.3s'
    }} />
  );
}
