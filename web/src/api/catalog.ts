export type AssetStatus = 'queued' | 'processing' | 'ready' | 'failed';

export interface TitleSummary {
  id: string;
  slug: string;
  name: string;
  synopsis: string;
  year: number;
  runtimeSeconds: number | null;
  heroImageUrl: string | null;
  posterImageUrl: string | null;
  genres: string[];
  assetId: string | null;
  assetStatus: AssetStatus | null;
}

export async function listTitles(): Promise<TitleSummary[]> {
  const res = await fetch('/api/v1/catalog/titles');
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  return res.json() as Promise<TitleSummary[]>;
}

export async function getTitle(slug: string): Promise<TitleSummary> {
  const res = await fetch(`/api/v1/catalog/titles/${slug}`);
  if (!res.ok) throw new Error(`Title fetch failed: ${res.status}`);
  return res.json() as Promise<TitleSummary>;
}
