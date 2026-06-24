import React, { useRef, useState } from 'react';
import { useUploadQueue } from '../../contexts/UploadQueueContext.ts';
import { useAuth } from '../../hooks/useAuth';
import { Icon } from './Icon';

interface UploadModalProps {
  onClose: () => void;
}

interface FormState {
  name: string;
  synopsis: string;
  year: string;
  file: File | null;
}

const CURRENT_YEAR = new Date().getFullYear();

const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
  marginBottom: 6,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  height: 44,
  padding: '0 14px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--hairline)',
  color: 'var(--text)',
  fontFamily: 'var(--sans)',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  transition: 'border-color .25s, box-shadow .25s',
};

export function UploadModal({ onClose }: UploadModalProps) {
  const { accessToken } = useAuth();
  const { enqueue } = useUploadQueue();
  
  const [form, setForm] = useState<FormState>({
    name: '',
    synopsis: '',
    year: String(CURRENT_YEAR),
    file: null,
  });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setFile = (file: File | null) => setForm((f) => ({ ...f, file }));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('video/')) setFile(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.file || !accessToken) return;

    enqueue(
      {
        name: form.name.trim(),
        synopsis: form.synopsis.trim(),
        year: parseInt(form.year, 10),
        file: form.file,
      },
      accessToken,
    );
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'fade-in 0.3s ease-out forwards',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'rgba(22,23,27,0.90)',
          backdropFilter: 'blur(28px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
          border: '1px solid var(--hairline)',
          borderRadius: 20,
          padding: '32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
          animation: 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--text-faint)',
            cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget).style.background = 'rgba(255,255,255,0.1)';
            (e.currentTarget).style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget).style.background = 'rgba(255,255,255,0.05)';
            (e.currentTarget).style.color = 'var(--text-faint)';
          }}
        >
          <Icon name="close" size={16} />
        </button>

        {/* ── FORM STATE ──────────────────────────────────────────────────────── */}
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-line)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--accent)',
                  flexShrink: 0,
                }}
              >
                <Icon name="upload" size={15} stroke={2} />
              </div>
              <div>
                <p
                  style={{
                    fontFamily: 'var(--display)',
                    fontWeight: 700,
                    fontSize: 18,
                    letterSpacing: '-0.02em',
                    color: 'var(--text)',
                    lineHeight: 1.1,
                  }}
                >
                  Add to queue
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                  Upload starts immediately
                </p>
              </div>
            </div>

            <form
              id="upload-form"
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <label htmlFor="upload-title">
                <span style={fieldLabel}>Title name</span>
                <input
                  id="upload-title"
                  required
                  style={inputStyle}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Big Buck Bunny"
                  onFocus={(e) => {
                    (e.target).style.borderColor = 'var(--accent-line)';
                    (e.target).style.boxShadow =
                      '0 0 0 3px var(--accent-soft)';
                  }}
                  onBlur={(e) => {
                    (e.target).style.borderColor = 'var(--hairline)';
                    (e.target).style.boxShadow = 'none';
                  }}
                />
              </label>

              <label htmlFor="upload-synopsis">
                <span style={fieldLabel}>Synopsis</span>
                <textarea
                  id="upload-synopsis"
                  required
                  rows={3}
                  style={{
                    ...inputStyle,
                    height: 'auto',
                    padding: '10px 14px',
                    resize: 'none',
                    lineHeight: 1.5,
                  }}
                  value={form.synopsis}
                  onChange={(e) => setForm((f) => ({ ...f, synopsis: e.target.value }))}
                  placeholder="Short description of the title"
                  onFocus={(e) => {
                    (e.target).style.borderColor = 'var(--accent-line)';
                    (e.target).style.boxShadow =
                      '0 0 0 3px var(--accent-soft)';
                  }}
                  onBlur={(e) => {
                    (e.target).style.borderColor = 'var(--hairline)';
                    (e.target).style.boxShadow = 'none';
                  }}
                />
              </label>

              <label htmlFor="upload-year">
                <span style={fieldLabel}>Year</span>
                <input
                  id="upload-year"
                  required
                  type="number"
                  min={1888}
                  max={CURRENT_YEAR + 1}
                  style={{ ...inputStyle, width: 110 }}
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                  onFocus={(e) => {
                    (e.target).style.borderColor = 'var(--accent-line)';
                    (e.target).style.boxShadow =
                      '0 0 0 3px var(--accent-soft)';
                  }}
                  onBlur={(e) => {
                    (e.target).style.borderColor = 'var(--hairline)';
                    (e.target).style.boxShadow = 'none';
                  }}
                />
              </label>

              {/* File drop zone */}
              <div>
                <span style={fieldLabel}>Video file</span>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Click or drag a video file here"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    borderRadius: 12,
                    border: `2px dashed ${
                      dragOver
                        ? 'var(--accent-line)'
                        : form.file
                          ? 'rgba(255,255,255,0.18)'
                          : 'var(--hairline)'
                    }`,
                    background: dragOver
                      ? 'var(--accent-soft)'
                      : form.file
                        ? 'rgba(255,255,255,0.03)'
                        : 'transparent',
                    padding: '22px 16px',
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
                      <div style={{ color: 'var(--accent)', marginBottom: 6 }}>
                        <Icon name="check" size={22} />
                      </div>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                        {form.file.name}
                      </p>
                      <p className="kicker" style={{ color: 'var(--text-faint)' }}>
                        {(form.file.size / 1024 / 1024).toFixed(1)} MB · click to change
                      </p>
                    </>
                  ) : (
                    <>
                      <div style={{ color: 'var(--text-faint)', marginBottom: 10 }}>
                        <Icon name="upload" size={24} stroke={1.4} />
                      </div>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 5 }}>
                        Drop a video or click to browse
                      </p>
                      <p className="kicker" style={{ color: 'var(--text-faint)' }}>
                        MP4 · MKV · MOV
                      </p>
                    </>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!form.file}
                className="btn btn--play"
                style={{
                  marginTop: 4,
                  width: '100%',
                  justifyContent: 'center',
                  height: 46,
                  borderRadius: 10,
                  fontSize: 14,
                  gap: 8,
                  opacity: form.file ? 1 : 0.35,
                  cursor: form.file ? 'pointer' : 'not-allowed',
                }}
              >
                <Icon name="upload" size={15} stroke={2} style={{ color: 'inherit' }} />
                Add to queue
              </button>
            </form>
          </>
      </div>
    </div>
  );
}

