import type { DiscoveryCandidate } from '../../services/anilistDiscovery';
import type { AniListDeckCard } from './types';

/**
 * Spanish mood label (as shown in MOOD_OPTIONS) to canonical AniList genres.
 * AniList's `genre_in` only accepts its own enum, so every value here must come
 * from ANILIST_GENRES.
 */
export const MOOD_GENRES: Record<string, readonly string[]> = {
  'Quiero algo que me vuele la cabeza': ['Mystery', 'Psychological', 'Thriller'],
  'Algo ligero para ver sin pensar': ['Comedy', 'Slice of Life'],
  'Busco una historia que me rompa el corazón': ['Drama', 'Romance'],
  'Necesito adrenalina pura y emoción': ['Action', 'Thriller'],
  'Algo que me transporte a otro mundo': ['Fantasy', 'Sci-Fi', 'Adventure'],
  'Quiero aprender o reflexionar sobre la vida': ['Slice of Life', 'Drama', 'Psychological'],
  'Quiero sentir tensión y un poco de miedo': ['Horror', 'Thriller', 'Mystery'],
  'Algo crudo, oscuro y realista': ['Drama', 'Thriller', 'Psychological'],
};

const FORMAT_LABELS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV corto',
  MOVIE: 'Película',
  OVA: 'OVA',
  ONA: 'ONA',
  SPECIAL: 'Especial',
};

/** Canonical AniList genres for a mood label; an empty list for "no mood". */
export function getMoodGenres(label: string | null | undefined): string[] {
  if (typeof label !== 'string') return [];
  const genres = MOOD_GENRES[label];
  return genres ? [...genres] : [];
}

/** "Recomendada por fans de X", with at most two named sources. */
export function formatReason(recommendedBy: string[]): string {
  const names = Array.isArray(recommendedBy)
    ? recommendedBy.filter(name => typeof name === 'string' && name.trim().length > 0)
    : [];

  if (names.length === 0) return '';
  if (names.length === 1) return `Recomendada por fans de ${names[0]}`;
  if (names.length === 2) return `Recomendada por fans de ${names[0]} y ${names[1]}`;

  return `Recomendada por fans de ${names[0]}, ${names[1]} y ${names.length - 2} más`;
}

/** "TV · 2013 · 12 eps", dropping whatever the card does not carry. */
export function formatCardMeta(card: AniListDeckCard): string {
  const parts: string[] = [];

  if (card.format) {
    parts.push(FORMAT_LABELS[card.format] ?? card.format);
  }
  if (typeof card.seasonYear === 'number' && Number.isFinite(card.seasonYear)) {
    parts.push(String(card.seasonYear));
  }
  if (typeof card.episodes === 'number' && Number.isFinite(card.episodes) && card.episodes > 0) {
    parts.push(`${card.episodes} eps`);
  }

  return parts.join(' · ');
}

/** Maps an engine candidate onto the deck shape the UI renders. */
export function toAniListDeckCard(candidate: DiscoveryCandidate): AniListDeckCard {
  return {
    kind: 'anilist',
    anilistId: candidate.anilistId,
    title: candidate.title,
    alternateTitle: candidate.alternateTitle,
    mediaType: 'Anime',
    synopsis: candidate.synopsis,
    reason: formatReason(candidate.recommendedBy),
    coverImage: candidate.coverImage,
    color: candidate.color,
    genres: [...candidate.genres],
    format: candidate.format,
    episodes: candidate.episodes,
    seasonYear: candidate.seasonYear,
    status: candidate.status,
  };
}
