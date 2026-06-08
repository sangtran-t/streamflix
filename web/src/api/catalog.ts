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

export interface HomeRow {
  title: string;
  items: TitleSummary[];
}

export interface HomeResponse {
  hero: TitleSummary | null;
  rows: HomeRow[];
}

export async function getHome(accessToken?: string | null): Promise<HomeResponse> {
  const res = await fetch('/api/v1/catalog/home', {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error(`Home fetch failed: ${res.status}`);
  return res.json() as Promise<HomeResponse>;
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
