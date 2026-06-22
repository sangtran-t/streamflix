export interface InitUploadRequest {
  name: string;
  synopsis: string;
  year: number;
  filename: string;
  contentType: string;
}

export interface InitUploadResponse {
  assetId: string;
  putUrl: string;
  expiresAt: string;
}

export type AssetStatus = 'queued' | 'processing' | 'ready' | 'failed';

export interface UploadStatusResponse {
  status: AssetStatus;
  progress: number | null;
}

export async function initUpload(
  body: InitUploadRequest,
  accessToken: string,
): Promise<InitUploadResponse> {
  const res = await fetch('/api/v1/uploads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`initUpload failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<InitUploadResponse>;
}

export function putFileToStorage(
  putUrl: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', putUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`PUT to storage failed: HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('PUT to storage: network error'));
    xhr.send(file);
  });
}

export async function completeUpload(assetId: string, accessToken: string): Promise<void> {
  const res = await fetch(`/api/v1/uploads/${assetId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status !== 202) {
    const text = await res.text().catch(() => '');
    throw new Error(`completeUpload failed (${res.status}): ${text}`);
  }
}

export async function getUploadStatus(
  assetId: string,
  accessToken: string,
): Promise<UploadStatusResponse> {
  const res = await fetch(`/api/v1/uploads/${assetId}/status`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`getUploadStatus failed (${res.status})`);
  }
  return res.json() as Promise<UploadStatusResponse>;
}
