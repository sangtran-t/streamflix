import { type TitleSummary } from '../api/catalog';

export function coverImage(t: TitleSummary): string | null {
  return t.posterImageUrl ?? t.heroImageUrl;
}

export function backdropImage(t: TitleSummary): string | null {
  return t.heroImageUrl ?? t.posterImageUrl;
}
