import type {
  AniListAiringSnapshot,
  AniListData,
  AniListMediaStatus,
  AniListSequel,
  MediaItem,
} from '../types';

export const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
export const AIRING_TTL_MS = 3 * 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_THROTTLE_MS = 2_000;
const MAX_PAGE_SIZE = 50;
const SEARCH_PAGE_SIZE = 6;
const MATCH_THRESHOLD = 50;
const CANDIDATE_LIMIT = 5;

export type AniListErrorKind = 'network' | 'timeout' | 'http' | 'graphql' | 'rate_limit';

export class AniListError extends Error {
  readonly kind: AniListErrorKind;
  readonly status?: number;

  constructor(kind: AniListErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'AniListError';
    this.kind = kind;
    this.status = status;
  }
}

export interface AniListCandidate {
  id: number;
  romaji: string;
  english?: string;
  native?: string;
  synonyms: string[];
  format?: string;
  seasonYear?: number;
  episodes?: number | null;
  status: AniListMediaStatus;
  coverImage?: string;
  isAdult: boolean;
  /** Canonical AniList genres (English enum values). */
  genres: string[];
}

export interface MatchResult {
  status: 'matched' | 'ambiguous' | 'not_found';
  match?: AniListData;
  candidates?: AniListCandidate[];
}

// --- Throttle -----------------------------------------------------------------

/**
 * All outbound requests share one serialized queue with a minimum interval
 * between requests. AniList is currently limited to ~30 requests/minute, so a
 * burst trips the limiter and poisons the whole feature for a while.
 */
let throttleIntervalMs = DEFAULT_THROTTLE_MS;
let requestChain: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const waitForSlot = async (): Promise<void> => {
  if (throttleIntervalMs > 0 && lastRequestStartedAt > 0) {
    const remaining = throttleIntervalMs - (Date.now() - lastRequestStartedAt);
    if (remaining > 0) await sleep(remaining);
  }
  lastRequestStartedAt = Date.now();
};

const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const run = requestChain.then(async () => {
    await waitForSlot();
    return task();
  });
  // Swallow rejections on the chain itself so one failure cannot stall the queue.
  requestChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

/** Test-only: override the minimum interval between requests (production default is 2000ms). */
export function __setThrottleForTests(ms: number): void {
  throttleIntervalMs = Number.isFinite(ms) && ms >= 0 ? ms : DEFAULT_THROTTLE_MS;
}

/** Test-only: restore the production interval and forget the last request timestamp. */
export function __resetThrottleForTests(): void {
  throttleIntervalMs = DEFAULT_THROTTLE_MS;
  lastRequestStartedAt = 0;
}

// --- GraphQL transport --------------------------------------------------------

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message?: string }[];
}

interface MediaTitleNode {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

interface PartialDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

interface RelationNode {
  id?: number | null;
  type?: string | null;
  format?: string | null;
  status?: AniListMediaStatus | null;
  episodes?: number | null;
  seasonYear?: number | null;
  isAdult?: boolean | null;
  startDate?: PartialDate | null;
  title?: MediaTitleNode | null;
  nextAiringEpisode?: { episode?: number | null; airingAt?: number | null } | null;
}

interface RelationEdge {
  relationType?: string | null;
  node?: RelationNode | null;
}

interface MediaNode {
  id: number;
  title?: MediaTitleNode | null;
  synonyms?: string[] | null;
  format?: string | null;
  seasonYear?: number | null;
  episodes?: number | null;
  status?: AniListMediaStatus | null;
  isAdult?: boolean | null;
  coverImage?: { medium?: string | null; large?: string | null } | null;
  genres?: string[] | null;
  nextAiringEpisode?: { episode?: number | null; airingAt?: number | null } | null;
  relations?: { edges?: (RelationEdge | null)[] | null } | null;
}

interface PageResponse {
  Page?: { media?: (MediaNode | null)[] | null } | null;
}

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError';

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

async function postGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  return enqueue(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      let response: Response;
      try {
        response = await fetch(ANILIST_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw new AniListError('timeout', 'AniList request timed out');
        }
        throw new AniListError('network', `AniList request failed: ${errorMessage(error)}`);
      }

      if (response.status === 429) {
        throw new AniListError('rate_limit', 'AniList rate limit reached', 429);
      }

      if (!response.ok) {
        throw new AniListError('http', `AniList request failed with status ${response.status}`, response.status);
      }

      let payload: GraphQLResponse<T>;
      try {
        payload = await response.json();
      } catch (error) {
        throw new AniListError('graphql', `AniList returned an unreadable payload: ${errorMessage(error)}`);
      }

      if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
        throw new AniListError('graphql', payload.errors[0]?.message ?? 'AniList returned a GraphQL error');
      }

      if (!payload?.data) {
        throw new AniListError('graphql', 'AniList returned no data');
      }

      return payload.data;
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

// --- Queries ------------------------------------------------------------------

const SEARCH_QUERY = `
query ($search: String, $perPage: Int) {
  Page(perPage: $perPage) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id title { romaji english native } synonyms format seasonYear genres
      startDate { year month day } episodes status isAdult coverImage { medium }
    }
  }
}`;

const BATCH_AIRING_QUERY = `
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id status episodes genres coverImage { large } nextAiringEpisode { episode airingAt timeUntilAiring }
      relations {
        edges {
          relationType
          node { id type format status episodes seasonYear isAdult startDate { year month day } title { romaji english } nextAiringEpisode { episode airingAt } }
        }
      }
    }
  }
}`;

const toCandidate = (node: MediaNode): AniListCandidate => ({
  id: node.id,
  romaji: node.title?.romaji ?? '',
  english: node.title?.english ?? undefined,
  native: node.title?.native ?? undefined,
  synonyms: Array.isArray(node.synonyms) ? node.synonyms : [],
  format: node.format ?? undefined,
  seasonYear: node.seasonYear ?? undefined,
  episodes: node.episodes ?? null,
  // AniList always returns a status; the fallback only guards malformed payloads.
  status: node.status ?? 'FINISHED',
  coverImage: node.coverImage?.medium ?? undefined,
  isAdult: node.isAdult === true,
  genres: Array.isArray(node.genres) ? node.genres : [],
});

export async function searchAniListCandidates(
  search: string,
  perPage: number = SEARCH_PAGE_SIZE,
): Promise<AniListCandidate[]> {
  const data = await postGraphQL<PageResponse>(SEARCH_QUERY, { search, perPage });
  const media = data?.Page?.media ?? [];
  return media.filter((node): node is MediaNode => !!node).map(toCandidate);
}

// --- Matching -----------------------------------------------------------------

/**
 * Lowercase, strip diacritics, collapse every non-alphanumeric run into a
 * single space, then trim.
 */
const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const tokenize = (value: string): string[] => value.split(' ').filter(Boolean);

const tokenJaccard = (query: string, field: string): number => {
  const queryTokens = new Set(tokenize(query));
  const fieldTokens = new Set(tokenize(field));
  if (queryTokens.size === 0 || fieldTokens.size === 0) return 0;

  let intersection = 0;
  queryTokens.forEach(token => {
    if (fieldTokens.has(token)) intersection += 1;
  });

  const union = queryTokens.size + fieldTokens.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

const scoreNormalizedPair = (query: string, field: string): number => {
  if (!query || !field) return 0;
  if (query === field) return 100;

  const [shorter, longer] = query.length <= field.length ? [query, field] : [field, query];
  if (longer.includes(shorter) && tokenize(shorter).length >= 3) return 80;

  const jaccard = tokenJaccard(query, field);
  if (jaccard >= 0.75) return 70;
  if (jaccard >= 0.5) return 50;
  return 0;
};

function scoreCandidate(candidate: AniListCandidate, query: string): number {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;

  const fields = [candidate.romaji, candidate.english, candidate.native, ...candidate.synonyms].filter(
    (field): field is string => typeof field === 'string' && field.length > 0,
  );

  let best = 0;
  for (const field of fields) {
    const score = scoreNormalizedPair(normalizedQuery, normalize(field));
    if (score > best) best = score;
  }
  return best;
}

const SEASON_PATTERNS: RegExp[] = [
  /\b(\d+)(?:st|nd|rd|th)\s+season\b/i,
  /\bseason\s+(\d+)\b/i,
  /\bpart\s+(\d+)\b/i,
  /\bcour\s+(\d+)\b/i,
];

const parseSeasonNumber = (title: string): number | undefined => {
  for (const pattern of SEASON_PATTERNS) {
    const match = title.match(pattern);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return undefined;
};

/**
 * Best-effort season inference.
 * - An explicit numeric suffix ("Season 2", "2nd Season", "Part 3", "Cour 2") wins.
 * - A matched title with no suffix is the base entry, i.e. season 1.
 * - "Final Season" carries no number, so it stays unknown (`undefined`).
 * Never throws.
 */
function inferSeason(matchedTitle: string | undefined, baseTitle: string | undefined): number | undefined {
  try {
    const matched = matchedTitle ?? '';
    const explicitSeason = parseSeasonNumber(matched);
    if (explicitSeason !== undefined) return explicitSeason;

    const normalizedMatched = normalize(matched);
    if (!normalizedMatched) return undefined;

    const normalizedBase = normalize(baseTitle ?? '');
    if (!normalizedBase || normalizedMatched === normalizedBase) return 1;

    return undefined;
  } catch {
    return undefined;
  }
}

const sortScored = (
  entries: { candidate: AniListCandidate; score: number }[],
): { candidate: AniListCandidate; score: number }[] =>
  [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.candidate.seasonYear ?? 0) - (a.candidate.seasonYear ?? 0);
  });

interface QuerySource {
  text: string;
  source: 'title' | 'originalTitle';
}

const buildQuerySources = (item: MediaItem): QuerySource[] => {
  const sources: QuerySource[] = [];
  const seen = new Set<string>();

  const push = (value: unknown, source: QuerySource['source']): void => {
    if (typeof value !== 'string') return;
    const text = value.trim();
    if (!text) return;
    const key = normalize(text) || text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    sources.push({ text, source });
  };

  push(item.aiData?.title, 'title');
  push(item.aiData?.originalTitle, 'originalTitle');
  return sources;
};

export async function resolveAniListMatch(item: MediaItem): Promise<MatchResult> {
  const sources = buildQuerySources(item);
  let sawAnyCandidate = false;
  let lastCandidates: AniListCandidate[] | undefined;
  let fallbackCandidates: AniListCandidate[] | undefined;

  for (const { text, source } of sources) {
    const fetched = await searchAniListCandidates(text);
    // Adult entries are never valid matches for a personal library.
    const usable = fetched.filter(candidate => !candidate.isAdult);
    if (usable.length === 0) continue;

    sawAnyCandidate = true;
    lastCandidates = usable;

    const scored = sortScored(
      usable
        .map(candidate => ({ candidate, score: scoreCandidate(candidate, text) }))
        .filter(entry => entry.score >= MATCH_THRESHOLD),
    );

    if (scored.length === 0) {
      // Nothing cleared the threshold, so this source was noise. Keep its best
      // candidates as a fallback, but still try the next source (originalTitle)
      // before giving up: AniList returns unrelated entries for unknown titles.
      fallbackCandidates = usable.slice(0, CANDIDATE_LIMIT);
      continue;
    }

    const topScore = scored[0].score;
    const topBucket = scored.filter(entry => entry.score === topScore);

    let winner = topBucket[0].candidate;
    if (topBucket.length > 1) {
      // The airing season is the one that matters when several entries tie.
      const releasing = topBucket.filter(entry => entry.candidate.status === 'RELEASING');
      if (releasing.length !== 1) {
        return {
          status: 'ambiguous',
          candidates: scored.slice(0, CANDIDATE_LIMIT).map(entry => entry.candidate),
        };
      }
      winner = releasing[0].candidate;
    }

    const matchedTitle = winner.romaji || winner.english || winner.native || text;
    const match: AniListData = {
      id: winner.id,
      season: inferSeason(winner.romaji || winner.english, text),
      matchedTitle,
      matchedBy: source,
      confidence: topScore === 100 ? 'exact' : 'high',
      resolvedAt: Date.now(),
      genres: winner.genres,
    };

    return { status: 'matched', match };
  }

  if (!sawAnyCandidate) {
    return { status: 'not_found' };
  }

  return { status: 'not_found', candidates: fallbackCandidates ?? lastCandidates?.slice(0, CANDIDATE_LIMIT) };
}

// --- Airing snapshots ---------------------------------------------------------

const chunkIds = (ids: number[], size: number): number[][] => {
  const chunks: number[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Partial AniList date -> "YYYY-MM-DD" | "YYYY-MM" | "YYYY" | null.
 * A day without a month (or a month without a year) cannot be rendered, so it
 * falls back to the most precise complete prefix instead of guessing.
 */
const formatStartDate = (startDate?: PartialDate | null): string | null => {
  const year = startDate?.year;
  if (!isFiniteNumber(year)) return null;

  const paddedYear = String(year).padStart(4, '0');
  const month = startDate?.month;
  if (!isFiniteNumber(month)) return paddedYear;

  const paddedMonth = String(month).padStart(2, '0');
  const day = startDate?.day;
  if (!isFiniteNumber(day)) return `${paddedYear}-${paddedMonth}`;

  return `${paddedYear}-${paddedMonth}-${String(day).padStart(2, '0')}`;
};

/**
 * Direct SEQUEL entries that are worth surfacing next to the matched season:
 * a currently airing season wins over every announced one, adult entries and
 * movies are excluded because they are not "the next season" of a series.
 */
const collectSequelCandidates = (mediaId: number, node: MediaNode): RelationNode[] => {
  const edges = node.relations?.edges ?? [];
  const candidates: RelationNode[] = [];

  for (const edge of edges) {
    if (!edge || edge.relationType !== 'SEQUEL') continue;

    const relation = edge.node;
    if (!relation || !isFiniteNumber(relation.id) || relation.id === mediaId) continue;
    if (relation.type !== 'ANIME') continue;
    if (relation.format === 'MOVIE') continue;
    if (relation.isAdult === true) continue;
    if (relation.status !== 'RELEASING' && relation.status !== 'NOT_YET_RELEASED') continue;

    candidates.push(relation);
  }

  return candidates;
};

/** Ascending, with missing values last so an announced date never outranks a known one. */
const compareOptionalAscending = (a: number | null | undefined, b: number | null | undefined): number => {
  const left = isFiniteNumber(a) ? a : Number.POSITIVE_INFINITY;
  const right = isFiniteNumber(b) ? b : Number.POSITIVE_INFINITY;
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const pickSequel = (mediaId: number, node: MediaNode): AniListSequel | undefined => {
  const candidates = collectSequelCandidates(mediaId, node);
  if (candidates.length === 0) return undefined;

  const releasing = candidates.filter(candidate => candidate.status === 'RELEASING');
  const pool = releasing.length > 0 ? releasing : candidates;

  const ranked = [...pool].sort((a, b) => {
    const byAiring = compareOptionalAscending(a.nextAiringEpisode?.airingAt, b.nextAiringEpisode?.airingAt);
    if (byAiring !== 0) return byAiring;

    const byYear = compareOptionalAscending(a.seasonYear, b.seasonYear);
    if (byYear !== 0) return byYear;

    return (a.id as number) - (b.id as number);
  });

  const winner = ranked[0];
  const title = winner.title?.romaji || winner.title?.english || '';
  const status = winner.status;

  // `collectSequelCandidates` already narrowed the status to these two values.
  if (status !== 'RELEASING' && status !== 'NOT_YET_RELEASED') return undefined;

  return {
    id: winner.id as number,
    season: parseSeasonNumber(title),
    title,
    status,
    episodes: winner.episodes ?? null,
    nextEpisode: winner.nextAiringEpisode?.episode ?? undefined,
    nextAiringAt: winner.nextAiringEpisode?.airingAt ?? undefined,
    startDate: formatStartDate(winner.startDate),
  };
};

export interface AiringDetails {
  snapshot: AniListAiringSnapshot;
  sequel?: AniListSequel;
  /** Extra media fields carried by the same response. Absent when not fetched. */
  meta?: { genres: string[]; coverImage?: string };
}

export async function fetchAiringSnapshots(ids: number[]): Promise<Map<number, AiringDetails>> {
  const details = new Map<number, AiringDetails>();
  const uniqueIds = Array.from(new Set(ids.filter(id => Number.isFinite(id))));
  if (uniqueIds.length === 0) return details;

  for (const chunk of chunkIds(uniqueIds, MAX_PAGE_SIZE)) {
    const data = await postGraphQL<PageResponse>(BATCH_AIRING_QUERY, { ids: chunk });
    const fetchedAt = Date.now();

    for (const node of data?.Page?.media ?? []) {
      if (!node || typeof node.id !== 'number') continue;

      const status: AniListMediaStatus = node.status ?? 'FINISHED';
      const snapshot: AniListAiringSnapshot = {
        status,
        isAiring: status === 'RELEASING',
        nextEpisode: node.nextAiringEpisode?.episode ?? undefined,
        nextAiringAt: node.nextAiringEpisode?.airingAt ?? undefined,
        totalEpisodes: node.episodes ?? null,
        fetchedAt,
      };

      const sequel = pickSequel(node.id, node);
      const meta = {
        genres: Array.isArray(node.genres) ? node.genres : [],
        coverImage: node.coverImage?.large ?? undefined,
      };
      // `sequel` is omitted entirely when nothing qualifies, so a refresh can
      // distinguish "no related season" from "not fetched yet".
      details.set(node.id, sequel ? { snapshot, sequel, meta } : { snapshot, meta });
    }
  }

  return details;
}

export function isAiringSnapshotFresh(
  snapshot: AniListAiringSnapshot | undefined,
  now: number = Date.now(),
): boolean {
  return !!snapshot && now - snapshot.fetchedAt < AIRING_TTL_MS;
}

// --- Pure selectors -----------------------------------------------------------

export function applyMatchResult(item: MediaItem, result: MatchResult): MediaItem {
  if (result.status !== 'matched' || !result.match) return item;

  return {
    ...item,
    aiData: {
      ...item.aiData,
      anilist: { ...(item.aiData.anilist ?? {}), ...result.match },
    },
  };
}

export function applyAiringSnapshots(
  item: MediaItem,
  snapshots: Map<number, AiringDetails>,
): MediaItem {
  const existing = item.aiData.anilist;
  if (!existing) return item;

  const details = snapshots.get(existing.id);
  if (!details) return item;

  // The cover is curated by the user and this path runs unattended (daily
  // refresh and library backfill), so it may only ever fill a hole: any
  // non-empty existing value — remote URL or base64 upload — is untouchable.
  const coverImage = item.aiData.coverImage || details.meta?.coverImage;

  return {
    ...item,
    aiData: {
      ...item.aiData,
      coverImage,
      anilist: {
        ...existing,
        airing: details.snapshot,
        // A refresh without meta must never wipe genres stored by a previous one.
        genres: details.meta?.genres ?? existing.genres,
        // Explicit `undefined` drops any persisted sequel so a stale one cannot
        // survive a refresh that found nothing directly related.
        sequel: details.sequel,
      },
    },
  };
}

// --- Manual linking -----------------------------------------------------------

/**
 * Builds a user-chosen identity. Never infers anything but the season from the
 * title: no confidence scoring, no airing snapshot and no sequel. Canonical
 * genres are copied verbatim from the candidate so a fresh link renders correct
 * genres without waiting for the next refresh.
 *
 * `baseTitle` is accepted for call-site symmetry but intentionally unused — a
 * manual link must never fall back to a local title the user did not pick.
 */
export function createManualMatch(candidate: AniListCandidate, baseTitle?: string): AniListData {
  const title = candidate.romaji || candidate.english || '';

  return {
    id: candidate.id,
    season: parseSeasonNumber(title),
    matchedTitle: candidate.romaji || candidate.english || candidate.native || '',
    matchedBy: 'manual',
    confidence: 'manual',
    resolvedAt: Date.now(),
    genres: Array.isArray(candidate.genres) ? candidate.genres : [],
  };
}

/**
 * Replaces the item's AniList identity with the chosen candidate and attaches a
 * fresh snapshot. The identity is kept even when the snapshot request fails, so
 * a network error can never lose the manual link. Never throws.
 */
export async function linkAniListCandidate(
  item: MediaItem,
  candidate: AniListCandidate,
): Promise<MediaItem> {
  // A whole-object replacement drops the previous `airing` and `sequel` instead
  // of merging them, which is exactly what a re-link must do.
  const relinked: MediaItem = {
    ...item,
    aiData: { ...item.aiData, anilist: createManualMatch(candidate) },
  };

  try {
    const snapshots = await fetchAiringSnapshots([candidate.id]);
    return applyAiringSnapshots(relinked, snapshots);
  } catch (error) {
    console.error('Failed to load the AniList snapshot for the manual link', error);
    return relinked;
  }
}

// --- Characters ---------------------------------------------------------------

export interface AniListCharacter {
  id: number;
  name: string;
  nativeName?: string;
  image?: string;
}

interface CharacterNameNode {
  full?: string | null;
  native?: string | null;
}

interface CharacterNode {
  id?: number | null;
  name?: CharacterNameNode | null;
  image?: { large?: string | null } | null;
}

interface MediaCharactersResponse {
  Media?: { characters?: { nodes?: (CharacterNode | null)[] | null } | null } | null;
}

const CHARACTERS_QUERY = `
query ($id: Int, $perPage: Int) {
  Media(id: $id, type: ANIME) {
    characters(perPage: $perPage, sort: [ROLE, RELEVANCE]) {
      nodes { id name { full native } image { large } }
    }
  }
}`;

/**
 * A character list changes far less often than airing data, so a successful
 * response is reused for the rest of the session: reopening the picker costs no
 * request. Failures are never cached.
 */
const characterCache = new Map<string, AniListCharacter[]>();

/** Test-only: forget every cached character list. */
export function __clearCharacterCacheForTests(): void {
  characterCache.clear();
}

const clampCharacterPageSize = (perPage: number): number => {
  if (!Number.isFinite(perPage)) return MAX_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(perPage)));
};

/**
 * Favourite-candidate characters for one AniList media entry, ordered by role
 * and relevance. Requests go through the shared throttled queue like every
 * other AniList call, so a picker open never trips the rate limiter.
 */
export async function fetchMediaCharacters(
  mediaId: number,
  perPage: number = MAX_PAGE_SIZE,
): Promise<AniListCharacter[]> {
  if (!isFiniteNumber(mediaId) || mediaId <= 0) return [];

  const pageSize = clampCharacterPageSize(perPage);
  const cacheKey = `${mediaId}:${pageSize}`;
  const cached = characterCache.get(cacheKey);
  // Copies keep a caller's mutation from corrupting the cache.
  if (cached) return cached.map(character => ({ ...character }));

  const data = await postGraphQL<MediaCharactersResponse>(CHARACTERS_QUERY, {
    id: mediaId,
    perPage: pageSize,
  });
  const nodes = data?.Media?.characters?.nodes ?? [];

  const characters: AniListCharacter[] = [];
  for (const node of nodes) {
    if (!node || !isFiniteNumber(node.id)) continue;

    const name = node.name?.full?.trim();
    if (!name) continue;

    characters.push({
      id: node.id,
      name,
      nativeName: node.name?.native?.trim() || undefined,
      image: node.image?.large || undefined,
    });
  }

  characterCache.set(cacheKey, characters);
  return characters.map(character => ({ ...character }));
}
