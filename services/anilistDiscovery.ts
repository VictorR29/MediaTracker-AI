import { postGraphQL } from './anilistService';

/**
 * Canonical AniList genre enum. `genre_in` rejects anything outside this list,
 * so every free-text genre is filtered against it before it reaches a query.
 */
export const ANILIST_GENRES: readonly string[] = Object.freeze([
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
]);

export interface DiscoveryCandidate {
  anilistId: number;
  title: string;
  alternateTitle?: string;
  coverImage?: string;
  color?: string;
  genres: string[];
  format?: string;
  episodes?: number;
  status?: string;
  seasonYear?: number;
  synopsis: string;
  recommendedBy: string[];
  votes: number;
  popularity: number;
}

export interface DiscoveryRequest {
  seeds: { anilistId: number; title: string }[];
  fallbackGenres: string[];
  excludeAniListIds: number[];
  excludeTitles: string[];
  moodGenres?: string[];
  limit?: number;
  /**
   * Page of the popularity-sorted genre pool. Seed recommendations are always
   * read from their first page; this only moves the pool underneath, which is
   * how a deck asks for genuinely new cards once it ran out.
   */
  page?: number;
}

// --- Tuning -------------------------------------------------------------------

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;
const THIN_POOL_THRESHOLD = 12;
// Ten per seed: five left the probe with fourteen cards, and the deck reveals
// twenty at a time, so a short pool would strand the "more" action.
const RECOMMENDATIONS_PER_SEED = 10;
const SYNOPSIS_MAX_LENGTH = 700;

// --- GraphQL shapes -----------------------------------------------------------

interface DiscoveryTitleNode {
  romaji?: string | null;
  english?: string | null;
}

interface DiscoveryMediaNode {
  id?: number | null;
  title?: DiscoveryTitleNode | null;
  coverImage?: { large?: string | null; color?: string | null } | null;
  genres?: string[] | null;
  format?: string | null;
  episodes?: number | null;
  status?: string | null;
  seasonYear?: number | null;
  description?: string | null;
  popularity?: number | null;
  isAdult?: boolean | null;
}

interface RecommendationNode {
  rating?: number | null;
  mediaRecommendation?: DiscoveryMediaNode | null;
}

interface SeedMediaNode extends DiscoveryMediaNode {
  recommendations?: { nodes?: (RecommendationNode | null)[] | null } | null;
}

interface SeedsPageResponse {
  Page?: { media?: (SeedMediaNode | null)[] | null } | null;
}

interface GenrePageResponse {
  Page?: { media?: (DiscoveryMediaNode | null)[] | null } | null;
}

const DISCOVERY_MEDIA_FIELDS = `
  id
  title { romaji english }
  coverImage { large color }
  genres
  format
  episodes
  status
  seasonYear
  description
  popularity
  isAdult
`;

const SEEDS_QUERY = `
query ($seedIds: [Int], $perSeed: Int) {
  Page(perPage: $perSeed) {
    media(id_in: $seedIds, type: ANIME) {
      id
      title { romaji english }
      recommendations(perPage: ${RECOMMENDATIONS_PER_SEED}, sort: RATING_DESC) {
        nodes {
          rating
          mediaRecommendation { ${DISCOVERY_MEDIA_FIELDS} }
        }
      }
    }
  }
}`;

/**
 * `format_not` takes a single MediaFormat enum in the live schema, not a list:
 * `format_not: [MUSIC]` is rejected with a validation error.
 */
const buildGenrePoolQuery = (withGenres: boolean): string => `
query (${withGenres ? '$genres: [String], ' : ''}$excluded: [Int], $perPage: Int, $page: Int) {
  Page(page: $page, perPage: $perPage) {
    media(
      type: ANIME,
      ${withGenres ? 'genre_in: $genres,' : ''}
      id_not_in: $excluded,
      isAdult: false,
      format_not: MUSIC,
      sort: [POPULARITY_DESC]
    ) {
      ${DISCOVERY_MEDIA_FIELDS}
    }
  }
}`;

// --- Pure helpers -------------------------------------------------------------

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const toPositiveId = (value: unknown): number | null => {
  if (!isFiniteNumber(value)) return null;
  const id = Math.trunc(value);
  return id > 0 ? id : null;
};

const clampLimit = (value?: number): number => {
  if (!isFiniteNumber(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value)));
};

const clampPage = (value?: number): number => {
  if (!isFiniteNumber(value)) return 1;
  return Math.max(1, Math.trunc(value));
};

/** Lowercase, strip diacritics, collapse non-alphanumerics to one space, trim. */
const normalizeTitle = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const CANONICAL_GENRE_BY_KEY = new Map(ANILIST_GENRES.map(genre => [normalizeTitle(genre), genre]));

/** Keeps only values that map to an AniList genre, deduped and canonically spelled. */
const canonicalizeGenres = (values: readonly string[] | undefined): string[] => {
  const genres: string[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(values)) return genres;

  for (const value of values) {
    if (typeof value !== 'string') continue;
    const canonical = CANONICAL_GENRE_BY_KEY.get(normalizeTitle(value));
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    genres.push(canonical);
  }

  return genres;
};

interface PickedTitle {
  title: string;
  alternateTitle?: string;
}

const pickTitle = (node: DiscoveryMediaNode): PickedTitle | null => {
  const english = node.title?.english?.trim() ?? '';
  const romaji = node.title?.romaji?.trim() ?? '';

  if (english && romaji && english !== romaji) {
    return { title: english, alternateTitle: romaji };
  }

  const title = english || romaji;
  return title ? { title } : null;
};

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  amp: '&',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  mdash: '\u2014',
  ndash: '\u2013',
  rsquo: '\u2019',
  lsquo: '\u2018',
  ldquo: '\u201c',
  rdquo: '\u201d',
  hellip: '\u2026',
};

/** Single pass, so `&amp;lt;` decodes to `&lt;` and never to a tag. */
const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match: string, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }

    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });

/** Plain-text synopsis: tags removed, entities decoded, source credit cut. */
const toSynopsis = (description?: string | null): string => {
  if (typeof description !== 'string' || !description) return '';

  const withoutBreaks = description
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p\s*>/gi, ' ');

  const withoutTags = withoutBreaks.replace(/<[^>]*>/g, ' ');
  const decoded = decodeEntities(withoutTags);

  const sourceIndex = decoded.toLowerCase().indexOf('(source:');
  const withoutSource = sourceIndex === -1 ? decoded : decoded.slice(0, sourceIndex);

  const collapsed = withoutSource.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= SYNOPSIS_MAX_LENGTH) return collapsed;

  return collapsed.slice(0, SYNOPSIS_MAX_LENGTH).trimEnd();
};

// --- Aggregation --------------------------------------------------------------

interface AggregatedEntry {
  node: DiscoveryMediaNode;
  votes: number;
  recommendedBy: string[];
}

const hasRecommendedBy = (entry: AggregatedEntry, seedTitle: string): boolean => {
  const key = normalizeTitle(seedTitle);
  return entry.recommendedBy.some(title => normalizeTitle(title) === key);
};

const mergeSeedPool = (
  pool: Map<number, AggregatedEntry>,
  media: (SeedMediaNode | null)[],
): void => {
  for (const seed of media) {
    if (!seed) continue;
    if (toPositiveId(seed.id) === null) continue;

    // Only the seed node's own title earns the credit; the request title may be stale.
    const seedTitle = pickTitle(seed)?.title ?? '';
    const nodes = seed.recommendations?.nodes;
    if (!Array.isArray(nodes)) continue;

    for (const recommendation of nodes) {
      if (!recommendation) continue;

      const node = recommendation.mediaRecommendation;
      const id = toPositiveId(node?.id);
      if (!node || id === null) continue;

      const rating = isFiniteNumber(recommendation.rating) ? recommendation.rating : 0;
      const existing = pool.get(id);

      if (!existing) {
        pool.set(id, {
          node,
          votes: rating,
          recommendedBy: seedTitle ? [seedTitle] : [],
        });
        continue;
      }

      existing.votes += rating;
      if (seedTitle && !hasRecommendedBy(existing, seedTitle)) {
        existing.recommendedBy.push(seedTitle);
      }
    }
  }
};

const mergeGenrePool = (
  pool: Map<number, AggregatedEntry>,
  media: (DiscoveryMediaNode | null)[],
): void => {
  for (const node of media) {
    const id = toPositiveId(node?.id);
    if (!node || id === null) continue;
    // Seed entries win: they already carry votes and recommendedBy.
    if (pool.has(id)) continue;

    pool.set(id, { node, votes: 0, recommendedBy: [] });
  }
};

const toCandidate = (entry: AggregatedEntry): DiscoveryCandidate | null => {
  const node = entry.node;
  const id = toPositiveId(node.id);
  if (id === null) return null;
  // Adult entries are never a valid suggestion for this library.
  if (node.isAdult === true) return null;

  const picked = pickTitle(node);
  if (!picked) return null;

  return {
    anilistId: id,
    title: picked.title,
    alternateTitle: picked.alternateTitle,
    coverImage: node.coverImage?.large ?? undefined,
    color: node.coverImage?.color ?? undefined,
    genres: Array.isArray(node.genres)
      ? node.genres.filter((genre): genre is string => typeof genre === 'string' && genre.length > 0)
      : [],
    format: node.format ?? undefined,
    episodes: isFiniteNumber(node.episodes) ? node.episodes : undefined,
    status: node.status ?? undefined,
    seasonYear: isFiniteNumber(node.seasonYear) ? node.seasonYear : undefined,
    synopsis: toSynopsis(node.description),
    recommendedBy: [...entry.recommendedBy],
    votes: entry.votes,
    popularity: isFiniteNumber(node.popularity) ? node.popularity : 0,
  };
};

const isExcluded = (
  candidate: DiscoveryCandidate,
  excludedIds: Set<number>,
  excludedTitles: Set<string>,
): boolean => {
  if (excludedIds.has(candidate.anilistId)) return true;

  const primary = normalizeTitle(candidate.title);
  if (primary && excludedTitles.has(primary)) return true;

  const alternate = candidate.alternateTitle ? normalizeTitle(candidate.alternateTitle) : '';
  return alternate.length > 0 && excludedTitles.has(alternate);
};

const hasMoodMatch = (genres: string[], moodKeys: Set<string>): boolean =>
  moodKeys.size > 0 && genres.some(genre => moodKeys.has(normalizeTitle(genre)));

// --- Request normalization ----------------------------------------------------

interface NormalizedRequest {
  seeds: { anilistId: number; title: string }[];
  fallbackGenres: string[];
  moodGenres: string[];
  excludeIds: number[];
  excludeTitles: string[];
  limit: number;
  page: number;
}

const normalizeSeeds = (seeds: DiscoveryRequest['seeds']): { anilistId: number; title: string }[] => {
  const unique: { anilistId: number; title: string }[] = [];
  const seen = new Set<number>();
  if (!Array.isArray(seeds)) return unique;

  for (const seed of seeds) {
    if (!seed) continue;
    const id = toPositiveId(seed.anilistId);
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    unique.push({ anilistId: id, title: typeof seed.title === 'string' ? seed.title.trim() : '' });
  }

  return unique;
};

const uniqueSortedIds = (ids: readonly number[] | undefined): number[] => {
  const unique = new Set<number>();
  if (!Array.isArray(ids)) return [];

  for (const id of ids) {
    const value = toPositiveId(id);
    if (value !== null) unique.add(value);
  }

  return [...unique].sort((a, b) => a - b);
};

const uniqueNormalizedTitles = (titles: readonly string[] | undefined): string[] => {
  const unique = new Set<string>();
  if (!Array.isArray(titles)) return [];

  for (const title of titles) {
    if (typeof title !== 'string') continue;
    const normalized = normalizeTitle(title);
    if (normalized) unique.add(normalized);
  }

  return [...unique].sort();
};

const normalizeRequest = (request: DiscoveryRequest): NormalizedRequest => {
  const seeds = normalizeSeeds(request.seeds);
  return {
    seeds,
    fallbackGenres: canonicalizeGenres(request.fallbackGenres),
    moodGenres: canonicalizeGenres(request.moodGenres),
    excludeIds: uniqueSortedIds(request.excludeAniListIds),
    excludeTitles: uniqueNormalizedTitles(request.excludeTitles),
    limit: clampLimit(request.limit),
    page: clampPage(request.page),
  };
};

const buildCacheKey = (request: NormalizedRequest): string =>
  JSON.stringify({
    seeds: [...request.seeds]
      .map(seed => [seed.anilistId, seed.title] as const)
      .sort((a, b) => a[0] - b[0]),
    fallbackGenres: [...request.fallbackGenres].sort(),
    moodGenres: [...request.moodGenres].sort(),
    excludeIds: request.excludeIds,
    excludeTitles: request.excludeTitles,
    limit: request.limit,
    page: request.page,
  });

// --- Cache --------------------------------------------------------------------

const discoveryCache = new Map<string, DiscoveryCandidate[]>();

/** Test-only: forget every cached deck. */
export function __clearDiscoveryCacheForTests(): void {
  discoveryCache.clear();
}

const cloneCandidate = (candidate: DiscoveryCandidate): DiscoveryCandidate => ({
  ...candidate,
  genres: [...candidate.genres],
  recommendedBy: [...candidate.recommendedBy],
});

/**
 * Turns the aggregated pool into the deck: unusable entries are dropped, the
 * user's own library is subtracted, and what survives is ordered by mood, then
 * by cross-seed consensus, then by votes.
 */
const rankCandidates = (
  pool: Map<number, AggregatedEntry>,
  excludedIds: Set<number>,
  excludedTitles: Set<string>,
  moodKeys: Set<string>,
  limit: number,
): DiscoveryCandidate[] =>
  [...pool.values()]
    .map(toCandidate)
    .filter((candidate): candidate is DiscoveryCandidate => candidate !== null)
    .filter(candidate => !isExcluded(candidate, excludedIds, excludedTitles))
    .map(candidate => ({ candidate, mood: hasMoodMatch(candidate.genres, moodKeys) }))
    .sort(
      (a, b) =>
        Number(b.mood) - Number(a.mood) ||
        b.candidate.recommendedBy.length - a.candidate.recommendedBy.length ||
        b.candidate.votes - a.candidate.votes ||
        b.candidate.popularity - a.candidate.popularity ||
        // Final tiebreaker keeps the deck deterministic across identical fetches.
        a.candidate.anilistId - b.candidate.anilistId,
    )
    .slice(0, limit)
    .map(entry => entry.candidate);

// --- Entry point --------------------------------------------------------------

/**
 * Builds a ranked discovery pool from AniList's own recommendation graph.
 *
 * The seed query asks several library entries at once and aggregates every
 * recommendation by media id, so a title recommended by two seeds outranks one
 * with a single (even higher-voted) backer. When the seed pool is thin — or
 * absent — a popularity-sorted genre pool is merged underneath it.
 *
 * Transport failures are never swallowed: `AniListError` propagates so the
 * caller can decide whether to fall back. Results are cached per normalized
 * request, so repeating an identical discovery costs no request.
 */
export async function fetchDiscoveryDeck(request: DiscoveryRequest): Promise<DiscoveryCandidate[]> {
  const normalized = normalizeRequest(request);
  const cacheKey = buildCacheKey(normalized);

  const cached = discoveryCache.get(cacheKey);
  if (cached) return cached.map(cloneCandidate);

  const { seeds, fallbackGenres, moodGenres, excludeIds, excludeTitles, limit, page } = normalized;

  const pool = new Map<number, AggregatedEntry>();

  // Seed recommendations are not paged, so they are only harvested once: a
  // later page continues the genre pool instead of repeating the same picks.
  if (seeds.length > 0 && page === 1) {
    const data = await postGraphQL<SeedsPageResponse>(SEEDS_QUERY, {
      seedIds: seeds.map(seed => seed.anilistId),
      perSeed: Math.min(MAX_LIMIT, seeds.length),
    });
    mergeSeedPool(pool, data?.Page?.media ?? []);
  }

  const excludedIdSet = new Set(excludeIds);
  const excludedTitleSet = new Set(excludeTitles);
  const moodKeys = new Set(moodGenres.map(normalizeTitle));

  let ranked = rankCandidates(pool, excludedIdSet, excludedTitleSet, moodKeys, limit);

  // The threshold applies to what survives exclusion, not to the raw pool: a
  // healthy seed list can still leave a handful of usable cards once the whole
  // library is subtracted, and a deck that short strands the reveal.
  if (seeds.length === 0 || ranked.length < THIN_POOL_THRESHOLD) {
    const withGenres = fallbackGenres.length > 0;
    const variables: Record<string, unknown> = {
      excluded: excludeIds,
      perPage: limit,
      page,
    };
    // An empty `genre_in` returns an empty page, so the clause is omitted instead.
    if (withGenres) variables.genres = fallbackGenres;

    const data = await postGraphQL<GenrePageResponse>(buildGenrePoolQuery(withGenres), variables);
    mergeGenrePool(pool, data?.Page?.media ?? []);
    ranked = rankCandidates(pool, excludedIdSet, excludedTitleSet, moodKeys, limit);
  }

  discoveryCache.set(cacheKey, ranked.map(cloneCandidate));
  return ranked.map(cloneCandidate);
}
