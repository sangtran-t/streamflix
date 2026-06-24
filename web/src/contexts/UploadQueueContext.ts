import { createContext, useContext } from 'react';
import type { AssetStatus } from '../api/upload';

export type UploadPhase = 'queued' | 'uploading' | 'processing' | 'done' | 'error';

export interface QueueItem {
  id: string;
  name: string;
  synopsis: string;
  year: number;
  filename: string;
  contentType: string;
  /** File object — only available in the current session (not persisted) */
  file?: File;
  phase: UploadPhase;
  uploadPct: number;
  assetId?: string;
  transcodeStatus?: AssetStatus;
  error?: string;
  addedAt: number; // timestamp ms
  finishedAt?: number; // timestamp ms when done or error
}

export interface UploadQueueContextValue {
  items: QueueItem[];
  /** Number of items actively in-flight (uploading or processing) */
  activeCount: number;
  enqueue: (
    fields: { name: string; synopsis: string; year: number; file: File },
    accessToken: string,
  ) => string;
  remove: (id: string) => void;
  retry: (id: string, accessToken: string) => void;
  resumePolling: (accessToken: string) => void;
}

export const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

export function useUploadQueue(): UploadQueueContextValue {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) throw new Error('useUploadQueue must be used within UploadQueueProvider');
  return ctx;
}
