import Hls from 'hls.js';
import { useEffect, useRef } from 'react';

interface PlayerProps {
  masterUrl: string;
}

/**
 * HLS player component backed by hls.js.
 *
 * The sf_play cookie is already set on the /hls/:assetId path before this
 * component mounts (the Watch page calls /api/playback/:assetId/url first).
 * Segment requests from hls.js go to the same origin so the browser sends the
 * cookie automatically — no xhrSetup credential injection needed.
 */
export default function Player({ masterUrl }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        // Surface debug events to the browser console in dev.
        debug: false,
        // Re-request the playback URL on 401/403 from the edge.
        // Phase 3 can wire autoStartLoad + fragLoadPolicy for a proper refresh.
        xhrSetup: (xhr) => {
          xhr.withCredentials = true;
        },
      });
      hlsRef.current = hls;
      hls.loadSource(masterUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          // Autoplay may be blocked by browser policy; user can click play.
        });
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = masterUrl;
      video.play().catch(() => {});
    }
  }, [masterUrl]);

  return (
    <video
      ref={videoRef}
      className="w-full aspect-video bg-black rounded-lg"
      controls
      playsInline
    />
  );
}
