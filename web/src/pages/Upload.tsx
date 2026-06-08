import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  completeUpload,
  getUploadStatus,
  initUpload,
  putFileToStorage,
  type AssetStatus,
} from '../api/upload';
import { Icon } from '../components/ui/Icon.tsx';
import { useAuth } from '../hooks/useAuth';

type Step = 'form' | 'uploading' | 'processing' | 'done' | 'error';

interface FormState {
  name: string;
  synopsis: string;
  year: string;
  file: File | null;
}

const CURRENT_YEAR = new Date().getFullYear();

const fieldLabel: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
  marginBottom: 7,
  display: 'block',
};

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
  width: '100%',
  transition: 'border-color .25s, box-shadow .25s',
};

const statusLabel: Record<AssetStatus, string> = {
  queued:     'Queued — waiting for a worker…',
  processing: 'Transcoding — building HLS renditions…',
  ready:      'Ready',
  failed:     'Failed',
};

export default function Upload() {
  const { isAuthenticated, isAdmin, initialized, accessToken } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]           = useState<Step>('form');
  const [form, setForm]           = useState<FormState>({ name: '', synopsis: '', year: String(CURRENT_YEAR), file: null });
  const [uploadPct, setUploadPct] = useState(0);
  const [status, setStatus]       = useState<AssetStatus | null>(null);
  const [readyAssetId, setReadyAssetId] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [dragOver, setDragOver]   = useState(false);

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wait for session restore, then enforce admin-only access.
  useEffect(() => {
    if (!initialized) return;
    if (!isAuthenticated) { void navigate('/login', { replace: true }); return; }
    if (!isAdmin) { void navigate('/', { replace: true }); }
  }, [initialized, isAuthenticated, isAdmin, navigate]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const setFile = (file: File | null) => setForm((f) => ({ ...f, file }));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('video/')) setFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.file || !accessToken) return;

    setError(null);
    setStep('uploading');
    setUploadPct(0);

    try {
      const init = await initUpload(
        {
          name:        form.name.trim(),
          synopsis:    form.synopsis.trim(),
          year:        parseInt(form.year, 10),
          filename:    form.file.name,
          contentType: form.file.type || 'video/mp4',
        },
        accessToken,
      );

      await putFileToStorage(init.putUrl, form.file, (frac) => {
        setUploadPct(Math.round(frac * 100));
      });

      await completeUpload(init.assetId, accessToken);

      setStep('processing');
      setStatus('queued');

      pollRef.current = setInterval(async () => {
        try {
          const s = await getUploadStatus(init.assetId, accessToken);
          setStatus(s.status);
          if (s.status === 'ready') {
            clearInterval(pollRef.current!);
            setReadyAssetId(init.assetId);
            setStep('done');
          } else if (s.status === 'failed') {
            clearInterval(pollRef.current!);
            setError('Transcoding failed. Check worker logs for details.');
            setStep('error');
          }
        } catch { /* transient poll error — keep trying */ }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 84 }}>
      <div className="grain" aria-hidden="true" />

      <div
        className="screen-anim"
        style={{
          padding: 'clamp(48px,7vh,80px) var(--page-x) clamp(80px,12vh,140px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Header */}
        <div style={{ width: '100%', maxWidth: 560, marginBottom: 40 }}>
          <p className="kicker" style={{ marginBottom: 16 }}>
            <Link to="/" style={{ color: 'inherit', opacity: 0.7 }}>Home</Link>
            <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
            Upload
          </p>
          <h1 className="display display--xl" style={{ fontSize: 'clamp(32px,5vw,64px)', textTransform: 'uppercase' }}>
            Add a title
          </h1>
        </div>

        {/* Card */}
        <div
          style={{
            width: '100%',
            maxWidth: 560,
            background: 'rgba(22,23,27,0.9)',
            backdropFilter: 'blur(28px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
            border: '1px solid var(--hairline)',
            borderRadius: 24,
            padding: 'clamp(32px,5vh,48px) clamp(28px,5vw,44px)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
          }}
        >

          {/* ── FORM ── */}
          {step === 'form' && (
            <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Title */}
              <label>
                <span style={fieldLabel}>Title name</span>
                <input
                  required
                  style={inputStyle}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Big Buck Bunny"
                />
              </label>

              {/* Synopsis */}
              <label>
                <span style={fieldLabel}>Synopsis</span>
                <textarea
                  required
                  rows={3}
                  style={{ ...inputStyle, height: 'auto', padding: '12px 16px', resize: 'none', lineHeight: 1.5 }}
                  value={form.synopsis}
                  onChange={(e) => setForm((f) => ({ ...f, synopsis: e.target.value }))}
                  placeholder="Short description of the title"
                />
              </label>

              {/* Year */}
              <label>
                <span style={fieldLabel}>Year</span>
                <input
                  required
                  type="number"
                  min={1888}
                  max={CURRENT_YEAR + 1}
                  style={{ ...inputStyle, width: 120 }}
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                />
              </label>

              {/* File drop zone */}
              <div>
                <span style={fieldLabel}>Video file</span>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    borderRadius: 14,
                    border: `2px dashed ${dragOver ? 'var(--accent-line)' : form.file ? 'rgba(255,255,255,0.18)' : 'var(--hairline)'}`,
                    background: dragOver ? 'var(--accent-soft)' : form.file ? 'rgba(255,255,255,0.04)' : 'transparent',
                    padding: '28px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'border-color .25s, background .25s',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {form.file ? (
                    <>
                      <div style={{ color: 'var(--accent)', marginBottom: 8 }}>
                        <Icon name="check" size={28} />
                      </div>
                      <p style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                        {form.file.name}
                      </p>
                      <p className="kicker" style={{ color: 'var(--text-faint)' }}>
                        {(form.file.size / 1024 / 1024).toFixed(1)} MB · click to change
                      </p>
                    </>
                  ) : (
                    <>
                      <div style={{ color: 'var(--text-faint)', marginBottom: 12 }}>
                        <Icon name="play" size={28} />
                      </div>
                      <p style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
                        Drop a video here or click to browse
                      </p>
                      <p className="kicker" style={{ color: 'var(--text-faint)' }}>MP4 · MKV · MOV</p>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <p style={{
                  fontSize: 13.5, color: '#e07070',
                  background: 'rgba(200,80,80,0.10)',
                  border: '1px solid rgba(200,80,80,0.22)',
                  borderRadius: 10, padding: '10px 14px', lineHeight: 1.4,
                }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!form.file}
                className="btn btn--play"
                style={{
                  marginTop: 8,
                  width: '100%',
                  justifyContent: 'center',
                  height: 50,
                  borderRadius: 12,
                  fontSize: 14.5,
                  opacity: form.file ? 1 : 0.4,
                  cursor: form.file ? 'pointer' : 'not-allowed',
                }}
              >
                Upload &amp; transcode
              </button>
            </form>
          )}

          {/* ── UPLOADING ── */}
          {step === 'uploading' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p className="kicker" style={{ marginBottom: 24 }}>Uploading to storage</p>
              <div style={{
                width: '100%', height: 4, borderRadius: 99,
                background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 14,
              }}>
                <div style={{
                  width: `${uploadPct}%`, height: '100%',
                  background: 'var(--accent)', borderRadius: 99,
                  transition: 'width .3s var(--ease)',
                }} />
              </div>
              <p className="display" style={{ fontSize: 48, letterSpacing: '-0.05em', color: 'var(--text)' }}>
                {uploadPct}<span style={{ fontSize: 24, color: 'var(--text-dim)' }}>%</span>
              </p>
            </div>
          )}

          {/* ── PROCESSING ── */}
          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
                <span style={{
                  width: 56, height: 56, borderRadius: 99,
                  border: '3px solid rgba(255,255,255,0.10)',
                  borderTopColor: 'var(--accent)',
                  animation: 'spin 1s linear infinite', display: 'block',
                }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
              <p className="display" style={{ fontSize: 22, marginBottom: 10 }}>
                {status ? statusLabel[status] : 'Processing…'}
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-faint)', lineHeight: 1.5 }}>
                This may take a few minutes.<br />You can leave this tab open.
              </p>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 99,
                background: 'rgba(227,189,118,0.12)',
                border: '1px solid var(--accent-line)',
                display: 'grid', placeItems: 'center',
                margin: '0 auto 24px',
                color: 'var(--accent)',
              }}>
                <Icon name="check" size={28} />
              </div>
              <p className="display" style={{ fontSize: 24, marginBottom: 8 }}>Transcode complete</p>
              <p style={{ fontSize: 14, color: 'var(--text-faint)', marginBottom: 32 }}>
                Your title is ready to stream.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                {readyAssetId && (
                  <button
                    onClick={() => { void navigate(`/watch/${readyAssetId}`); }}
                    className="btn btn--play"
                    style={{ height: 48, paddingInline: 28 }}
                  >
                    <Icon name="play" size={16} /> Play now
                  </button>
                )}
                <button
                  onClick={() => {
                    setStep('form');
                    setForm({ name: '', synopsis: '', year: String(CURRENT_YEAR), file: null });
                    setUploadPct(0);
                    setStatus(null);
                    setReadyAssetId(null);
                  }}
                  className="btn btn--ghost"
                  style={{ height: 48, paddingInline: 24 }}
                >
                  Upload another
                </button>
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === 'error' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p className="display" style={{ fontSize: 22, marginBottom: 12, color: '#e07070' }}>Upload failed</p>
              {error && (
                <p style={{
                  fontSize: 13.5, color: '#e07070',
                  background: 'rgba(200,80,80,0.10)',
                  border: '1px solid rgba(200,80,80,0.22)',
                  borderRadius: 10, padding: '10px 14px',
                  lineHeight: 1.4, marginBottom: 24,
                }}>
                  {error}
                </p>
              )}
              <button
                onClick={() => { setStep('form'); setError(null); }}
                className="btn btn--ghost"
                style={{ height: 48, paddingInline: 24 }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
