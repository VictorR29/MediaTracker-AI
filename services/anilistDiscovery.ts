import { postGraphQL } from './anilistService';
import { curateCandidates } from './discoveryCuration';

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

export interface DiscoveryCandidateTag {
  name: string;
  rank: number;
}

export interface DiscoveryCandidate {
  anilistId: number;
  title: string;
  alternateTitle?: string;
  coverImage?: string;
  color?: string;
  genres: string[];
  /** Community tags with their 0-100 confidence rank. Never empty-undefined. */
  tags: DiscoveryCandidateTag[];
  format?: string;
  episodes?: number;
  status?: string;
  seasonYear?: number;
  synopsis: string;
  recommendedBy: string[];
  votes: number;
  popularity: number;
  /** Spanish reason written by the opt-in curation pass. */
  reason?: string;
}

export interface DiscoveryRequest {
  seeds: { anilistId: number; title: string }[];
  fallbackGenres: string[];
  excludeAniListIds: number[];
  excludeTitles: string[];
  moodGenres?: string[];
  /**
   * Tags that express the selected mood. Scored locally; never sent to AniList.
   */
  moodTags?: string[];
  /**
   * Opt-in Gemini curation of the pool. Adds one deliberately blocking round
   * trip so the deck is already ordered when the first card renders.
   */
  curation?: { apiKey: string; moodLabel?: string; maxItems?: number };
  limit?: number;
  /**
   * Page of the popularity-sorted genre pool. Seed recommendations are always
   * read from their first page; this only moves the pool underneath, which is
   * how a deck asks for genuinely new cards once it ran out.
   */
  page?: number;
  /**
   * Oldest acceptable release year. Omitted means no year filter.
   */
  minYear?: number;
  /**
   * When true, an entry that has a PREQUEL of format TV, TV_SHORT or ONA is
   * dropped: it is a later season, not the first entry of its franchise.
   * Opt-in, because it costs one extra request.
   */
  collapseSeasons?: boolean;
}

// --- Tuning -------------------------------------------------------------------

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;
const THIN_POOL_THRESHOLD = 12;
// Ten per seed: five left the probe with fourteen cards, and the deck reveals
// twenty at a time, so a short pool would strand the "more" action.
const RECOMMENDATIONS_PER_SEED = 10;
const SYNOPSIS_MAX_LENGTH = 700;

// --- Curation tuning ----------------------------------------------------------

/** Curation needs a pool to choose from; below this the local order is used. */
const MIN_CURATION_POOL_SIZE = 8;
/** Default curated size: one generation feeds two reveal batches (20 per batch). */
const DEFAULT_CURATION_MAX_ITEMS = 40;
const MIN_CURATION_MAX_ITEMS = 8;
const MAX_CURATION_MAX_ITEMS = 40;

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
  tags?: { name?: string | null; rank?: number | null }[] | null;
  format?: string | null;
  episodes?: number | null;
  status?: string | null;
  seasonYear?: number | null;
  /** Movies carry no `seasonYear`, but always carry a partial start date. */
  startDate?: { year?: number | null } | null;
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

interface RelationEdgeNode {
  relationType?: string | null;
  node?: { id?: number | null; format?: string | null } | null;
}

interface RelationsMediaNode {
  id?: number | null;
  relations?: { edges?: (RelationEdgeNode | null)[] | null } | null;
}

interface RelationsPageResponse {
  Page?: { media?: (RelationsMediaNode | null)[] | null } | null;
}

const DISCOVERY_MEDIA_FIELDS = `
  id
  title { romaji english }
  coverImage { large color }
  genres
  tags { name rank }
  format
  episodes
  status
  seasonYear
  startDate { year }
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
 *
 * The year filter uses `startDate_greater` (FuzzyDateInt). `seasonYear_greater`
 * does not exist in the schema and AniList answers 400 for it.
 */
const buildGenrePoolQuery = (withGenres: boolean, withMinDate: boolean): string => `
query (${withGenres ? '$genres: [String], ' : ''}${withMinDate ? '$minDate: FuzzyDateInt, ' : ''}$excluded: [Int], $perPage: Int, $page: Int) {
  Page(page: $page, perPage: $perPage) {
    media(
      type: ANIME,
      ${withGenres ? 'genre_in: $genres,' : ''}
      ${withMinDate ? 'startDate_greater: $minDate,' : ''}
      id_not_in: $excluded,
      isAdult: false,
      format_not: MUSIC,
      sort: [POPULARITY_DESC]
    ) {
      ${DISCOVERY_MEDIA_FIELDS}
    }
  }
}`;

/**
 * One batched lookup for the whole deck. A nested relations walk was measured
 * slower and did not reach the franchise root, so this only looks one level
 * deep: enough to tell "has a previous season" from "is the first entry".
 */
const RELATIONS_QUERY = `
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      relations {
        edges {
          relationType
          node { id format }
        }
      }
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

/** Curated deck size: 8 is the floor, 40 the ceiling (two reveal batches). */
const clampCurationMaxItems = (value?: number): number => {
  if (!isFiniteNumber(value)) return DEFAULT_CURATION_MAX_ITEMS;
  return Math.min(MAX_CURATION_MAX_ITEMS, Math.max(MIN_CURATION_MAX_ITEMS, Math.trunc(value)));
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

/**
 * Release year for the card meta line. `seasonYear` is null for movies, so the
 * partial start date is the fallback; without it a film would lose its year.
 */
const toReleaseYear = (node: DiscoveryMediaNode): number | undefined => {
  if (isFiniteNumber(node.seasonYear)) return node.seasonYear;
  if (isFiniteNumber(node.startDate?.year)) return node.startDate.year;
  return undefined;
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
    tags: normalizeTags(node.tags),
    format: node.format ?? undefined,
    episodes: isFiniteNumber(node.episodes) ? node.episodes : undefined,
    status: node.status ?? undefined,
    seasonYear: toReleaseYear(node),
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

const TAG_RANK_MAX = 100;

/**
 * A candidate's tags, cleaned: a name must be a non-empty string and a rank must
 * be a finite number clamped to 0-100. Anything else is dropped, and a missing
 * `tags` field is simply an empty list — never a crash and never a filter.
 */
const normalizeTags = (tags: DiscoveryMediaNode['tags']): DiscoveryCandidateTag[] => {
  if (!Array.isArray(tags)) return [];

  const clean: DiscoveryCandidateTag[] = [];
  for (const tag of tags) {
    const name = typeof tag?.name === 'string' ? tag.name.trim() : '';
    if (!name) continue;
    if (!isFiniteNumber(tag?.rank)) continue;
    clean.push({ name, rank: Math.min(TAG_RANK_MAX, Math.max(0, tag.rank)) });
  }

  return clean;
};

/**
 * Sum of the community ranks of the mood's tags that this candidate carries.
 * A mood tag absent from the candidate contributes nothing; the result is 0 for
 * an unrelated title, and 0 is a valid score that never drops the candidate.
 */
const scoreMoodTags = (tags: DiscoveryCandidateTag[], moodTagKeys: Set<string>): number => {
  if (moodTagKeys.size === 0) return 0;

  let score = 0;
  for (const tag of tags) {
    if (moodTagKeys.has(tag.name)) score += tag.rank;
  }

  return score;
};

// --- Request normalization ----------------------------------------------------

interface NormalizedRequest {
  seeds: { anilistId: number; title: string }[];
  fallbackGenres: string[];
  moodGenres: string[];
  moodTags: string[];
  /** Spanish mood label for curation; never part of any outbound AniList call. */
  moodLabel?: string;
  /** True when a Gemini key was supplied. The key itself never reaches the cache key. */
  curationRequested: boolean;
  excludeIds: number[];
  excludeTitles: string[];
  limit: number;
  page: number;
  minYear?: number;
  collapseSeasons: boolean;
}

const MIN_ACCEPTABLE_YEAR = 1950;

/**
 * A non-finite or absurd year is dropped instead of clamped: a caller asking for
 * 1200 or 3000 has a bug, and the safe behavior is "no year filter".
 */
const sanitizeMinYear = (value?: number): number | undefined => {
  if (!isFiniteNumber(value)) return undefined;
  const year = Math.trunc(value);
  const maxYear = new Date().getFullYear() + 2;
  return year >= MIN_ACCEPTABLE_YEAR && year <= maxYear ? year : undefined;
};

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

/**
 * Tags are canonical AniList names, matched verbatim against what a candidate
 * carries, so they are only trimmed and deduped here — never title-normalized.
 */
const uniqueTags = (tags: readonly string[] | undefined): string[] => {
  const unique = new Set<string>();
  if (!Array.isArray(tags)) return [];

  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const trimmed = tag.trim();
    if (trimmed) unique.add(trimmed);
  }

  return [...unique].sort();
};

const normalizeMoodLabel = (label?: string): string | undefined => {
  if (typeof label !== 'string') return undefined;
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeRequest = (request: DiscoveryRequest): NormalizedRequest => ({
  seeds: normalizeSeeds(request.seeds),
  fallbackGenres: canonicalizeGenres(request.fallbackGenres),
  moodGenres: canonicalizeGenres(request.moodGenres),
  moodTags: uniqueTags(request.moodTags),
  moodLabel: normalizeMoodLabel(request.curation?.moodLabel),
  curationRequested:
    typeof request.curation?.apiKey === 'string' && request.curation.apiKey.trim().length > 0,
  excludeIds: uniqueSortedIds(request.excludeAniListIds),
  excludeTitles: uniqueNormalizedTitles(request.excludeTitles),
  limit: clampLimit(request.limit),
  page: clampPage(request.page),
  minYear: sanitizeMinYear(request.minYear),
  collapseSeasons: request.collapseSeasons === true,
});

const buildCacheKey = (request: NormalizedRequest): string =>
  JSON.stringify({
    seeds: [...request.seeds]
      .map(seed => [seed.anilistId, seed.title] as const)
      .sort((a, b) => a[0] - b[0]),
    fallbackGenres: [...request.fallbackGenres].sort(),
    moodGenres: [...request.moodGenres].sort(),
    // Sorted so a differently ordered mood tag list still shares one cache entry.
    moodTags: [...request.moodTags].sort(),
    moodLabel: request.moodLabel ?? null,
    curationRequested: request.curationRequested,
    excludeIds: request.excludeIds,
    excludeTitles: request.excludeTitles,
    limit: request.limit,
    page: request.page,
    minYear: request.minYear ?? null,
    collapseSeasons: request.collapseSeasons,
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
  tags: candidate.tags.map(tag => ({ ...tag })),
  recommendedBy: [...candidate.recommendedBy],
});

/**
 * Turns the aggregated pool into the deck: unusable entries are dropped, the
 * user's own library is subtracted, and what survives is ordered by mood tag
 * score, then by the genre-mood match, then by cross-seed consensus, then by
 * votes.
 *
 * A candidate with no year at all is kept: unknown is not old, and dropping it
 * would silently lose entries the API simply did not date. A candidate that
 * matches none of the mood tags is kept too, with a score of 0: scoring only
 * orders the deck, it never filters it.
 */
const rankCandidates = (
  pool: Map<number, AggregatedEntry>,
  excludedIds: Set<number>,
  excludedTitles: Set<string>,
  moodKeys: Set<string>,
  moodTagKeys: Set<string>,
  limit: number,
  minYear?: number,
): DiscoveryCandidate[] =>
  [...pool.values()]
    .map(toCandidate)
    .filter((candidate): candidate is DiscoveryCandidate => candidate !== null)
    .filter(candidate => !isExcluded(candidate, excludedIds, excludedTitles))
    .filter(candidate => minYear === undefined || candidate.seasonYear === undefined || candidate.seasonYear >= minYear)
    .map(candidate => ({
      candidate,
      mood: hasMoodMatch(candidate.genres, moodKeys),
      moodScore: scoreMoodTags(candidate.tags, moodTagKeys),
    }))
    .sort(
      (a, b) =>
        b.moodScore - a.moodScore ||
        Number(b.mood) - Number(a.mood) ||
        b.candidate.recommendedBy.length - a.candidate.recommendedBy.length ||
        b.candidate.votes - a.candidate.votes ||
        b.candidate.popularity - a.candidate.popularity ||
        // Final tiebreaker keeps the deck deterministic across identical fetches.
        a.candidate.anilistId - b.candidate.anilistId,
    )
    .slice(0, limit)
    .map(entry => entry.candidate);

/** Prequel formats that make an entry a continuation rather than a franchise start. */
const COLLAPSIBLE_PREQUEL_FORMATS = new Set(['TV', 'TV_SHORT', 'ONA']);

/**
 * Drops later seasons by asking AniList for the relations of the whole deck in
 * one request. An entry whose PREQUEL is a TV/TV_SHORT/ONA title is a
 * continuation; title heuristics ("Season N", "Part N") are not reliable, since
 * arcs such as "Entertainment District Arc" are later seasons without the word.
 *
 * Later entries are dropped, never replaced by their first season: resolving the
 * true root needs a chain walk (a nested relations query was measured slower and
 * did not reach it), and when the root is already in the user's library the
 * correct outcome is to show nothing from that franchise anyway. The genre pool
 * then offers other first entries.
 *
 * Any failure returns the input unchanged on purpose: a relations outage must
 * not empty the deck, and this filter stays non-blocking.
 */
const collapseLaterSeasons = async (candidates: DiscoveryCandidate[]): Promise<DiscoveryCandidate[]> => {
  try {
    if (candidates.length === 0) return candidates;

    const data = await postGraphQL<RelationsPageResponse>(RELATIONS_QUERY, {
      ids: candidates.map(candidate => candidate.anilistId),
    });

    const laterSeasonIds = new Set<number>();

    for (const node of data?.Page?.media ?? []) {
      const id = toPositiveId(node?.id);
      if (id === null) continue;

      const edges = node?.relations?.edges;
      if (!Array.isArray(edges)) continue;

      const hasPrequelSeries = edges.some(edge => {
        if (edge?.relationType !== 'PREQUEL') return false;
        const format = edge.node?.format;
        return typeof format === 'string' && COLLAPSIBLE_PREQUEL_FORMATS.has(format);
      });

      if (hasPrequelSeries) laterSeasonIds.add(id);
    }

    return candidates.filter(candidate => !laterSeasonIds.has(candidate.anilistId));
  } catch {
    return candidates;
  }
};

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

  const { seeds, fallbackGenres, moodGenres, moodTags, excludeIds, excludeTitles, limit, page, minYear, collapseSeasons } =
    normalized;

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
  const moodTagKeys = new Set(moodTags);

  let ranked = rankCandidates(pool, excludedIdSet, excludedTitleSet, moodKeys, moodTagKeys, limit, minYear);

  // The threshold applies to what survives exclusion, not to the raw pool: a
  // healthy seed list can still leave a handful of usable cards once the whole
  // library is subtracted, and a deck that short strands the reveal.
  if (seeds.length === 0 || ranked.length < THIN_POOL_THRESHOLD) {
    const withGenres = fallbackGenres.length > 0;
    const withMinDate = minYear !== undefined;
    const variables: Record<string, unknown> = {
      excluded: excludeIds,
      perPage: limit,
      page,
    };
    // An empty `genre_in` returns an empty page, so the clause is omitted instead.
    if (withGenres) variables.genres = fallbackGenres;
    // `startDate_greater` is exclusive, so the previous year's last day is sent
    // to keep the whole requested year inside the range.
    if (withMinDate) variables.minDate = (minYear - 1) * 10000 + 1231;

    const data = await postGraphQL<GenrePageResponse>(
      buildGenrePoolQuery(withGenres, withMinDate),
      variables,
    );
    mergeGenrePool(pool, data?.Page?.media ?? []);
    ranked = rankCandidates(pool, excludedIdSet, excludedTitleSet, moodKeys, moodTagKeys, limit, minYear);
  }

  // One extra request, and only when asked: the default deck keeps every season.
  if (collapseSeasons && ranked.length > 0) {
    ranked = await collapseLaterSeasons(ranked);
  }

  // Opt-in Gemini curation, after the local order is final. It adds one
  // deliberately blocking round trip so the deck is already ordered when the
  // first card renders. Curation means selection, not decoration: when it
  // succeeds the deck is rebuilt from the curated ids only, in that order, with
  // the Spanish reason attached. When it fails the local order is untouched —
  // this never blocks the deck and never empties it.
  if (normalized.curationRequested && request.curation?.apiKey && ranked.length >= MIN_CURATION_POOL_SIZE) {
    const curated = await curateCandidates({
      apiKey: request.curation.apiKey,
      moodLabel: normalized.moodLabel,
      maxItems: clampCurationMaxItems(request.curation.maxItems),
      candidates: ranked,
    });

    if (curated) {
      const byId = new Map(ranked.map(candidate => [candidate.anilistId, candidate]));
      const selected: DiscoveryCandidate[] = [];
      for (const entry of curated) {
        const candidate = byId.get(entry.anilistId);
        if (!candidate) continue;
        selected.push({ ...candidate, reason: entry.reason });
      }
      if (selected.length > 0) ranked = selected;
    }
  }

  discoveryCache.set(cacheKey, ranked.map(cloneCandidate));
  return ranked.map(cloneCandidate);
}
