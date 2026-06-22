import Hls from 'hls.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './ui/Icon.tsx';

let _savedVolume = 1;

interface PlayerProps {
  masterUrl: string;
  titleName?: string;
  initialTime?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onBack?: () => void;
  refreshPlayback?: () => Promise<void>;
}

function fmt(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return (
    (h ? `${h}:` : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(ss).padStart(2, '0')
  );
}

function Scrubber({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const seek = useCallback(
    (clientX: number) => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      onChange(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
    },
    [onChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const mv = (e: MouseEvent) => seek(e.clientX);
    const up = () => setDragging(false);
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging, seek]);

  return (
    <div
      ref={ref}
      onMouseDown={(e) => {
        setDragging(true);
        seek(e.clientX);
      }}
      style={{
        position: 'relative',
        height: 18,
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'relative',
          height: 3,
          width: '100%',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: 99,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${value * 100}%`,
            background: 'var(--accent)',
            borderRadius: 99,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${value * 100}%`,
            top: '50%',
            width: dragging ? 16 : 12,
            height: dragging ? 16 : 12,
            borderRadius: 99,
            background: '#fff',
            transform: 'translate(-50%,-50%)',
            transition: 'width .2s, height .2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        />
      </div>
    </div>
  );
}

export default function Player({
  masterUrl,
  titleName,
  initialTime,
  onTimeUpdate,
  onBack,
  refreshPlayback,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showUI, setShowUI] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(_savedVolume);
  const [qualityLevels, setQualityLevels] = useState<{ height: number; bitrate: number }[]>([]);
  const [qualityIdx, setQualityIdx] = useState(-1);
  const [showQuality, setShowQuality] = useState(false);

  const bumpUI = useCallback(() => {
    setShowUI(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowUI(false), 2800);
  }, []);

  useEffect(() => {
    bumpUI();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [bumpUI]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  const handleSeek = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    video.currentTime = v * video.duration;
    setProgress(v);
  }, []);

  const handleFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const applyQuality = useCallback((idx: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = idx;
      setQualityIdx(idx);
    }
    setShowQuality(false);
  }, []);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const video = videoRef.current;
      if (!video) return;

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          if (video.paused) video.play().catch(() => {});
          else video.pause();
          bumpUI();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          bumpUI();
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
          bumpUI();
          break;
        case 'ArrowUp':
          e.preventDefault();
          {
            const v = Math.min(1, video.volume + 0.1);
            video.volume = v;
            setVolume(v);
            _savedVolume = v;
          }
          bumpUI();
          break;
        case 'ArrowDown':
          e.preventDefault();
          {
            const v = Math.max(0, video.volume - 0.1);
            video.volume = v;
            setVolume(v);
            _savedVolume = v;
          }
          bumpUI();
          break;
        case 'KeyM':
          e.preventDefault();
          video.muted = !video.muted;
          setMuted(video.muted);
          bumpUI();
          break;
        case 'KeyF':
          e.preventDefault();
          handleFullscreen();
          break;
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [bumpUI, handleFullscreen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = _savedVolume;
    video.muted = false;
    setVolume(_savedVolume);
    setMuted(false);

    const onTime = () => {
      if (video.duration) setProgress(video.currentTime / video.duration);
      if (onTimeUpdate) onTimeUpdate(video.currentTime);
    };
    const onDuration = () => setDuration(video.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWait = () => setBuffering(true);
    const onCanPlay = () => setBuffering(false);
    const onVolumeChange = () => {
      const nowMuted = video.muted || video.volume === 0;
      setMuted(nowMuted);
      if (!nowMuted) {
        setVolume(video.volume);
        _savedVolume = video.volume;
      }
    };

    const addListeners = () => {
      video.addEventListener('timeupdate', onTime);
      video.addEventListener('durationchange', onDuration);
      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('waiting', onWait);
      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('volumechange', onVolumeChange);
    };
    const removeListeners = () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWait);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('volumechange', onVolumeChange);
    };

    addListeners();

    if (Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        xhrSetup: (xhr) => {
          xhr.withCredentials = true;
        },
      });
      hlsRef.current = hls;
      hls.loadSource(masterUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setQualityLevels(hls.levels.map((l) => ({ height: l.height, bitrate: l.bitrate })));
        setQualityIdx(-1);
        if (initialTime && initialTime > 5) video.currentTime = initialTime;
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, () => {
        if (!hls.autoLevelEnabled) setQualityIdx(hls.currentLevel);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (
          data.fatal &&
          data.type === Hls.ErrorTypes.NETWORK_ERROR &&
          (data.response?.code === 401 || data.response?.code === 403) &&
          refreshPlayback &&
          !refreshingRef.current
        ) {
          refreshingRef.current = true;
          refreshPlayback()
            .then(() => {
              hls.startLoad();
            })
            .catch(() => {})
            .finally(() => {
              refreshingRef.current = false;
            });
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
        removeListeners();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = masterUrl;
      video.addEventListener('loadedmetadata', () => {
        if (initialTime && initialTime > 5) video.currentTime = initialTime;
      });
      video.play().catch(() => {});
    }

    return removeListeners;
  }, [masterUrl, initialTime, onTimeUpdate, refreshPlayback]);

  const qualityLabel =
    qualityIdx === -1
      ? 'Auto'
      : qualityLevels[qualityIdx]
        ? `${qualityLevels[qualityIdx].height}p`
        : 'Auto';

  const autoDetail =
    qualityIdx === -1 &&
    hlsRef.current &&
    hlsRef.current.currentLevel >= 0 &&
    qualityLevels[hlsRef.current.currentLevel]
      ? ` (${qualityLevels[hlsRef.current.currentLevel].height}p)`
      : '';

  const chromeTrans = `opacity .5s var(--ease), transform .5s var(--ease)`;

  return (
    <div
      onMouseMove={bumpUI}
      onClick={() => {
        bumpUI();
        setShowQuality(false);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 500,
        cursor: showUI ? 'default' : 'none',
        fontFamily: 'var(--sans)',
      }}
    >
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
        playsInline
      />

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(120% 100% at 50% 50%, transparent 55%, rgba(0,0,0,0.5))',
          pointerEvents: 'none',
        }}
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          bumpUI();
          togglePlay();
        }}
        aria-label={playing ? 'Pause' : 'Play'}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {buffering ? (
          <span
            style={{
              width: 92,
              height: 92,
              borderRadius: 99,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.28)',
              display: 'grid',
              placeItems: 'center',
              opacity: showUI ? 1 : 0,
              transition: chromeTrans,
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 99,
                border: '3px solid rgba(255,255,255,0.4)',
                borderTopColor: 'var(--accent)',
                animation: 'spin 1s linear infinite',
              }}
            />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </span>
        ) : (
          <span
            style={{
              width: 92,
              height: 92,
              borderRadius: 99,
              background: 'rgba(0,0,0,0.58)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.30)',
              display: 'grid',
              placeItems: 'center',
              opacity: showUI ? 1 : 0,
              transform: showUI ? 'scale(1)' : 'scale(0.9)',
              transition: chromeTrans,
            }}
          >
            <Icon name={playing ? 'pause' : 'play'} size={34} />
          </span>
        )}
      </button>

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: 'clamp(20px,4vh,32px) var(--page-x)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 60%, transparent 100%)',
          opacity: showUI ? 1 : 0,
          transform: showUI ? 'none' : 'translateY(-10px)',
          transition: chromeTrans,
          pointerEvents: showUI ? 'auto' : 'none',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onBack) onBack();
          }}
          className="btn btn--icon"
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            borderColor: 'rgba(255,255,255,0.30)',
          }}
        >
          <Icon name="back" size={18} />
        </button>
        <div style={{ textAlign: 'center' }}>
          {titleName && (
            <div
              className="display"
              style={{ fontSize: 16, letterSpacing: '-0.03em', textTransform: 'uppercase' }}
            >
              {titleName}
            </div>
          )}
        </div>
        <button
          className="btn btn--icon"
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            borderColor: 'rgba(255,255,255,0.30)',
          }}
          aria-label="Closed captions"
        >
          <Icon name="cc" size={18} />
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 'clamp(60px,10vh,80px) var(--page-x) clamp(24px,5vh,40px)',
          background:
            'linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 55%, transparent 100%)',
          opacity: showUI ? 1 : 0,
          transform: showUI ? 'none' : 'translateY(10px)',
          transition: chromeTrans,
          pointerEvents: showUI ? 'auto' : 'none',
        }}
      >
        <Scrubber value={progress} onChange={handleSeek} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              style={{ color: 'var(--text)' }}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              <Icon name={playing ? 'pause' : 'play'} size={24} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              style={{ color: muted ? 'rgba(255,255,255,0.35)' : 'var(--text-dim)' }}
              aria-label={muted ? 'Unmute' : 'Mute'}
              title={`Volume: ${Math.round(volume * 100)}%`}
            >
              <Icon name="sound" size={22} />
            </button>
            <span
              style={{
                fontSize: 13.5,
                color: 'var(--text-dim)',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {fmt(progress * (duration || 0))}{' '}
              <span style={{ color: 'var(--text-ghost)' }}>/ {fmt(duration)}</span>
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              color: 'var(--text-dim)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {qualityLevels.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowQuality((s) => !s)}
                  style={{
                    color: showQuality ? 'var(--accent)' : 'inherit',
                    fontSize: 12.5,
                    fontWeight: 700,
                    minWidth: 38,
                    textAlign: 'center',
                    letterSpacing: '-0.01em',
                    transition: 'color .2s',
                  }}
                  aria-label="Quality"
                  title="Video quality"
                >
                  {qualityLabel}
                </button>

                {showQuality && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 12px)',
                      right: 0,
                      background: 'rgba(16,17,21,0.97)',
                      backdropFilter: 'blur(28px)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: 14,
                      padding: '8px 0',
                      minWidth: 128,
                      zIndex: 10,
                      boxShadow: '0 20px 48px rgba(0,0,0,0.7)',
                    }}
                  >
                    <button
                      onClick={() => applyQuality(-1)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 18px',
                        fontSize: 14,
                        fontWeight: qualityIdx === -1 ? 700 : 400,
                        color: qualityIdx === -1 ? 'var(--accent)' : 'var(--text)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'var(--sans)',
                      }}
                    >
                      Auto{autoDetail}
                    </button>

                    {[...qualityLevels].map((l, i) => {
                      const active = qualityIdx === i;
                      return (
                        <button
                          key={i}
                          onClick={() => applyQuality(i)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 18px',
                            fontSize: 14,
                            fontWeight: active ? 700 : 400,
                            color: active ? 'var(--accent)' : 'var(--text)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'var(--sans)',
                          }}
                        >
                          {l.height}p{l.height >= 1080 ? ' HD' : ''}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <button style={{ color: 'inherit' }} aria-label="Captions">
              <Icon name="cc" size={20} />
            </button>
            <button style={{ color: 'inherit' }} onClick={handleFullscreen} aria-label="Fullscreen">
              <Icon name="full" size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
