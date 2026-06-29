/**
 * useUploadQueue — Global async upload queue
 *
 * Manages multiple concurrent uploads (upload → transcode polling).
 * State persists across navigation via App-level context.
 * Metadata (excluding file binary) is saved to localStorage so the
 * queue survives hard refreshes for completed/processing items.
 */

import { useCallback, useEffect, useReducer, useRef, type ReactNode } from 'react';
import {
  completeUpload,
  getUploadStatus,
  initUpload,
  putFileToStorage,
  type AssetStatus,
} from '../../api/upload';

import {
  UploadQueueContext,
  type QueueItem,
  type UploadPhase,
} from '../../contexts/UploadQueueContext.ts';

// ─── Types ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'ADD'; item: QueueItem }
  | { type: 'SET_PHASE'; id: string; phase: UploadPhase; error?: string }
  | { type: 'SET_UPLOAD_PCT'; id: string; pct: number }
  | { type: 'SET_ASSET_ID'; id: string; assetId: string }
  | { type: 'SET_TRANSCODE_STATUS'; id: string; status: AssetStatus }
  | { type: 'REMOVE'; id: string }
  | { type: 'LOAD_PERSISTED'; items: QueueItem[] };

interface UploadQueueState {
  items: QueueItem[];
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state: UploadQueueState, action: Action): UploadQueueState {
  switch (action.type) {
    case 'ADD':
      return { items: [action.item, ...state.items] };

    case 'SET_PHASE':
      return {
        items: state.items.map((it) => {
          if (it.id === action.id) {
            const isFinished = action.phase === 'done' || action.phase === 'error';
            return {
              ...it,
              phase: action.phase,
              error: action.error,
              ...(isFinished && !it.finishedAt ? { finishedAt: Date.now() } : {}),
            };
          }
          return it;
        }),
      };

    case 'SET_UPLOAD_PCT':
      return {
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, uploadPct: action.pct } : it,
        ),
      };

    case 'SET_ASSET_ID':
      return {
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, assetId: action.assetId } : it,
        ),
      };

    case 'SET_TRANSCODE_STATUS':
      return {
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, transcodeStatus: action.status } : it,
        ),
      };

    case 'REMOVE':
      return { items: state.items.filter((it) => it.id !== action.id) };

    case 'LOAD_PERSISTED':
      return { items: action.items };

    default:
      return state;
  }
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = 'streamflix_upload_queue_v1';

type PersistedItem = Omit<QueueItem, 'file'>;

function loadFromStorage(): QueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedItem[];
    // Items that were mid-upload when the page was closed → mark as error
    return parsed.map((it) =>
      it.phase === 'uploading' || it.phase === 'queued'
        ? { ...it, phase: 'error', error: 'Upload interrupted — please retry.' }
        : it,
    );
  } catch {
    return [];
  }
}

function saveToStorage(items: QueueItem[]) {
  try {
    // Strip non-serialisable File objects before saving
    const serialisable: PersistedItem[] = items.map(({ file: _file, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialisable));
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });

  // Polling intervals keyed by item id
  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // ── Persistence: load on mount ────────────────────────────────────────────
  useEffect(() => {
    const persisted = loadFromStorage();
    if (persisted.length > 0) {
      dispatch({ type: 'LOAD_PERSISTED', items: persisted });
    }
  }, []);

  // ── Persistence: save on every state change ───────────────────────────────
  useEffect(() => {
    saveToStorage(state.items);
  }, [state.items]);

  // ── Cleanup all polls on unmount ──────────────────────────────────────────
  useEffect(() => {
    const refs = pollRefs.current;
    return () => {
      Object.values(refs).forEach(clearInterval);
    };
  }, []);

  // ── Core upload logic ─────────────────────────────────────────────────────

  const startPolling = useCallback((id: string, assetId: string, accessToken: string) => {
    // Avoid duplicate pollers
    if (pollRefs.current[id]) clearInterval(pollRefs.current[id]);

    pollRefs.current[id] = setInterval(async () => {
      try {
        const s = await getUploadStatus(assetId, accessToken);
        dispatch({ type: 'SET_TRANSCODE_STATUS', id, status: s.status });

        if (s.status === 'ready') {
          clearInterval(pollRefs.current[id]);
          delete pollRefs.current[id];
          dispatch({ type: 'SET_PHASE', id, phase: 'done' });
        } else if (s.status === 'failed') {
          clearInterval(pollRefs.current[id]);
          delete pollRefs.current[id];
          dispatch({
            type: 'SET_PHASE',
            id,
            phase: 'error',
            error: 'Transcoding failed. Check worker logs.',
          });
        }
      } catch {
        // transient error — keep polling
      }
    }, 2500);
  }, []);

  const runUpload = useCallback(
    async (item: QueueItem, accessToken: string) => {
      const { id, name, synopsis, year, filename, contentType, file } = item;
      if (!file) {
        dispatch({ type: 'SET_PHASE', id, phase: 'error', error: 'File not available.' });
        return;
      }

      dispatch({ type: 'SET_PHASE', id, phase: 'uploading' });
      dispatch({ type: 'SET_UPLOAD_PCT', id, pct: 0 });

      try {
        // 1. Init upload → get presigned PUT URL
        const init = await initUpload(
          { name: name.trim(), synopsis: synopsis.trim(), year, filename, contentType },
          accessToken,
        );

        // 2. Stream file to storage with progress
        await putFileToStorage(init.putUrl, file, (frac) => {
          dispatch({ type: 'SET_UPLOAD_PCT', id, pct: Math.round(frac * 100) });
        });

        // 3. Signal server that upload is complete
        await completeUpload(init.assetId, accessToken);

        dispatch({ type: 'SET_ASSET_ID', id, assetId: init.assetId });
        dispatch({ type: 'SET_PHASE', id, phase: 'processing' });
        dispatch({ type: 'SET_TRANSCODE_STATUS', id, status: 'queued' });

        // 4. Poll transcode status
        startPolling(id, init.assetId, accessToken);
      } catch (err) {
        dispatch({
          type: 'SET_PHASE',
          id,
          phase: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [startPolling],
  );

  // ── Public API ────────────────────────────────────────────────────────────

  const enqueue = useCallback(
    (fields: { name: string; synopsis: string; year: number; file: File }, accessToken: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: QueueItem = {
        id,
        name: fields.name,
        synopsis: fields.synopsis,
        year: fields.year,
        filename: fields.file.name,
        contentType: fields.file.type || 'video/mp4',
        file: fields.file,
        phase: 'queued',
        uploadPct: 0,
        addedAt: Date.now(),
      };
      dispatch({ type: 'ADD', item });
      void runUpload(item, accessToken);
      return id;
    },
    [runUpload],
  );

  const remove = useCallback((id: string) => {
    if (pollRefs.current[id]) {
      clearInterval(pollRefs.current[id]);
      delete pollRefs.current[id];
    }
    dispatch({ type: 'REMOVE', id });
  }, []);

  const retry = useCallback(
    (id: string, accessToken: string) => {
      const item = state.items.find((it) => it.id === id);
      if (!item) return;
      if (!item.file) {
        // File is gone (e.g. after page refresh) — can't retry without file
        dispatch({
          type: 'SET_PHASE',
          id,
          phase: 'error',
          error: 'File no longer available. Please re-add the video.',
        });
        return;
      }
      void runUpload(item, accessToken);
    },
    [state.items, runUpload],
  );

  const resumePolling = useCallback(
    (accessToken: string) => {
      const processingItems = state.items.filter((i) => i.phase === 'processing' && i.assetId);
      processingItems.forEach((i) => {
        if (!pollRefs.current[i.id]) {
          startPolling(i.id, i.assetId!, accessToken);
        }
      });
    },
    [state.items, startPolling],
  );

  const activeCount = state.items.filter(
    (it) => it.phase === 'uploading' || it.phase === 'processing',
  ).length;

  return (
    <UploadQueueContext.Provider
      value={{ items: state.items, activeCount, enqueue, remove, retry, resumePolling }}
    >
      {children}
    </UploadQueueContext.Provider>
  );
}
