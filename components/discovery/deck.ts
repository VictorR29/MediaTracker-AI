import type { DiscoveryCandidate } from '../../services/anilistDiscovery';
import type { TvmazeMatch } from '../../services/tvmazeService';
import type { MediaItem } from '../../types';
import type { AiDeckCard, AniListDeckCard } from './types';

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

/**
 * Spanish mood label (as shown in MOOD_OPTIONS) to canonical AniList community
 * tags. Verified against the live `MediaTagCollection` (428 names): every value
 * here exists in AniList's catalog. Unlike MOOD_GENRES these are never sent to
 * AniList — `tag_in` is AND, not OR — they only score the pool locally.
 */
export const MOOD_TAGS: Record<string, readonly string[]> = {
  // No "Philosophy" here on purpose: it is carried by ~31% of popular anime, so
  // it barely discriminates and surfaced cozy titles as mind-bending. It stays
  // in the reflective mood, where it actually means something.
  'Quiero algo que me vuele la cabeza': [
    'Denpa',
    'Time Loop',
    'Time Manipulation',
    'Alternate Universe',
    'Memory Manipulation',
    'Dissociative Identities',
  ],
  'Algo ligero para ver sin pensar': ['Iyashikei', 'Episodic', 'Slapstick', 'Parody', 'Surreal Comedy'],
  'Busco una historia que me rompa el corazón': [
    'Tragedy',
    'Unrequited Love',
    'Coming of Age',
    'Family Life',
    'Found Family',
  ],
  'Necesito adrenalina pura y emoción': ['Guns', 'Swordplay', 'Martial Arts', 'Battle Royale', 'Survival', 'Espionage'],
  'Algo que me transporte a otro mundo': ['Isekai', 'Magic', 'Fairy Tale', 'Virtual World', 'Space', 'Mythology'],
  'Quiero aprender o reflexionar sobre la vida': [
    'Philosophy',
    'Coming of Age',
    'Educational',
    'Family Life',
    'Iyashikei',
    'Religion',
  ],
  'Quiero sentir tensión y un poco de miedo': [
    'Cosmic Horror',
    'Body Horror',
    'Death Game',
    'Ghost',
    'Survival',
    'Conspiracy',
  ],
  'Algo crudo, oscuro y realista': ['Noir', 'Crime', 'Yakuza', 'Drugs', 'Mafia', 'Psychosexual'],
};

const FORMAT_LABELS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV corto',
  MOVIE: 'Película',
  OVA: 'OVA',
  ONA: 'ONA',
  SPECIAL: 'Especial',
  // AniList has no MANHWA format: a MANGA entry in this deck is Korean-only, so
  // the label is accurate rather than a guess at every manga's origin.
  MANGA: 'Manhwa',
};

/** Canonical AniList genres for a mood label; an empty list for "no mood". */
export function getMoodGenres(label: string | null | undefined): string[] {
  if (typeof label !== 'string') return [];
  const genres = MOOD_GENRES[label];
  return genres ? [...genres] : [];
}

/** Canonical AniList tags for a mood label; an empty list for "no mood". */
export function getMoodTags(label: string | null | undefined): string[] {
  if (typeof label !== 'string') return [];
  const tags = MOOD_TAGS[label];
  return tags ? [...tags] : [];
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
  // Manga reports chapters and leaves `episodes` null; chapters win when both
  // are present, because that is the unit the reader actually counts.
  if (typeof card.chapters === 'number' && Number.isFinite(card.chapters) && card.chapters > 0) {
    parts.push(`${card.chapters} caps`);
  } else if (typeof card.episodes === 'number' && Number.isFinite(card.episodes) && card.episodes > 0) {
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
    // MANGA in this engine always means the KR-only manhwa pool.
    mediaType: candidate.format === 'MANGA' ? 'Manhwa' : 'Anime',
    synopsis: candidate.synopsis,
    // A curated reason explains the mood; the fan-credit line is the fallback.
    reason: candidate.reason ?? formatReason(candidate.recommendedBy),
    coverImage: candidate.coverImage,
    color: candidate.color,
    genres: [...candidate.genres],
    format: candidate.format,
    episodes: candidate.episodes,
    chapters: candidate.chapters,
    seasonYear: candidate.seasonYear,
    status: candidate.status,
  };
}

/**
 * "5 Temporadas · 43 Caps" for a hydrated Serie, degrading to "43 Caps" when the
 * season count is unknown and to an empty string when there is no episode count.
 */
const formatSerieTotalContent = (detail: TvmazeMatch | null): string => {
  const totalEpisodes = detail?.totalEpisodes;
  if (typeof totalEpisodes !== 'number' || !Number.isFinite(totalEpisodes) || totalEpisodes <= 0) {
    return '';
  }

  const seasons = detail?.seasons;
  const episodesLabel = `${totalEpisodes} Caps`;

  if (typeof seasons !== 'number' || !Number.isFinite(seasons) || seasons <= 0) {
    return episodesLabel;
  }

  const seasonsLabel = seasons === 1 ? '1 Temporada' : `${seasons} Temporadas`;
  return `${seasonsLabel} · ${episodesLabel}`;
};

/**
 * Gemini Serie deck card + optional TVmaze detail → library item.
 *
 * Kept pure for the same reason as `buildDiscoveryItem`: the add path must be
 * testable without React. The synopsis always comes from Gemini (Spanish), never
 * from TVmaze, whose `summary` is English only.
 */
export function buildSerieItem(
  card: AiDeckCard,
  detail: TvmazeMatch | null,
  { id = Date.now().toString(), now = Date.now() }: { id?: string; now?: number } = {},
): MediaItem {
  // A card the deck hydrated still has to work when its detail fetch failed:
  // the item is built from whatever the card itself carries.
  const tvmazeId = card.tvmazeId;

  return {
    id,
    aiData: {
      title: card.title,
      mediaType: 'Serie',
      synopsis: card.synopsis,
      genres: [...(card.genres ?? [])],
      status: card.status ?? '',
      totalContent: formatSerieTotalContent(detail),
      coverDescription: '',
      releaseDate: detail?.premiered,
      endDate: detail?.ended,
      sourceUrls: [],
      primaryColor: '#c084fc',
      coverImage: card.coverImage,
      ...(typeof tvmazeId === 'number' && Number.isFinite(tvmazeId) ? { tvmaze: { id: tvmazeId } } : {}),
    },
    trackingData: {
      status: 'Sin empezar',
      currentSeason: 1,
      totalSeasons: detail?.seasons ?? 1,
      watchedEpisodes: 0,
      // Season 1 only: `totalEpisodes` is the whole show and would make the
      // progress bar start at a fraction of the first season.
      totalEpisodesInSeason: detail?.firstSeasonEpisodes ?? 0,
      emotionalTags: [],
      favoriteCharacters: [],
      rating: '',
      comment: '',
    },
    createdAt: now,
  };
}

/**
 * AniList deck card → library item. Kept pure so the add path is testable: the
 * media type and the chapter/episode split used to live inline in App.tsx, where
 * a manhwa was silently stored as an Anime.
 */
export function buildDiscoveryItem(
  card: AniListDeckCard,
  { id = Date.now().toString(), now = Date.now() }: { id?: string; now?: number } = {},
): MediaItem {
  const isMovie = card.format === 'MOVIE';
  const isManhwa = card.mediaType === 'Manhwa';

  return {
    id,
    aiData: {
      title: card.title,
      mediaType: card.mediaType,
      synopsis: card.synopsis,
      genres: [...card.genres],
      status: card.status === 'RELEASING' ? 'En emisión' : card.status === 'FINISHED' ? 'Finalizado' : '',
      totalContent: isManhwa
        ? (card.chapters ? `${card.chapters} Capítulos` : '')
        : (card.episodes ? `${card.episodes} episodios` : ''),
      coverDescription: '',
      releaseDate: card.seasonYear ? String(card.seasonYear) : undefined,
      sourceUrls: [],
      primaryColor: card.color ?? '#c084fc',
      coverImage: card.coverImage,
      anilist: {
        id: card.anilistId,
        matchedTitle: card.title,
        matchedBy: 'manual',
        confidence: 'manual',
        resolvedAt: now,
        genres: [...card.genres],
      },
    },
    trackingData: {
      status: 'Sin empezar',
      currentSeason: isMovie ? 0 : 1,
      totalSeasons: isMovie ? 0 : 1,
      watchedEpisodes: 0,
      totalEpisodesInSeason: isMovie ? 0 : (isManhwa ? (card.chapters ?? 0) : (card.episodes ?? 0)),
      emotionalTags: [],
      favoriteCharacters: [],
      rating: '',
      comment: '',
    },
    createdAt: now,
  };
}
