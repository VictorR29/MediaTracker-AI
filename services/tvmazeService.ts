import type { AIWorkData } from '../types';

export const TVMAZE_API_BASE = 'https://api.tvmaze.com';

const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_THROTTLE_MS = 500;
/**
 * TVmaze allows at least 20 requests per 10s per IP and answers 429 when the
 * bucket is empty. One retry after this pause is enough to ride out a burst.
 */
const RATE_LIMIT_BACKOFF_MS = 1_500;

export class TvmazeError extends Error {
  /** HTTP status when the failure came from the response, omitted otherwise. */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'TvmazeError';
    this.status = status;
  }
}

export interface TvmazeMatch {
  id: number;
  name: string;
  language?: string;
  premiered?: string;
  ended?: string;
  /** Already translated to the app's Spanish labels; unknown values are dropped. */
  status?: string;
  genres: string[];
  rating?: number;
  image?: string;
  synopsis?: string;
  network?: string;
  country?: string;
  totalEpisodes?: number;
  seasons?: number;
  /** Episodes in season 1 only. Used to seed a new item's current-season capacity. */
  firstSeasonEpisodes?: number;
}

export interface TvmazeCharacter {
  id: number;
  name: string;
  /** The actor playing the character. TVmaze always pairs the two. */
  actor?: string;
  image?: string;
}

// --- Throttle -----------------------------------------------------------------

/**
 * Same serialized queue as `anilistService`: every outbound request waits for
 * the previous one, with a minimum interval between starts. TVmaze is cheap but
 * rate limited, and a discovery deck asks for several shows in a row.
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

/** Test-only: override the minimum interval between requests (production default is 500ms). */
export function __setTvmazeThrottleForTests(ms: number): void {
  throttleIntervalMs = Number.isFinite(ms) && ms >= 0 ? ms : DEFAULT_THROTTLE_MS;
}

/** Test-only: restore the production interval and forget the last request timestamp. */
export function __resetTvmazeThrottleForTests(): void {
  throttleIntervalMs = DEFAULT_THROTTLE_MS;
  lastRequestStartedAt = 0;
}

// --- Cache --------------------------------------------------------------------

/**
 * Session caches. A discovery deck re-reads the same titles on every render
 * cycle and every regeneration, so a repeated lookup must cost zero requests.
 * `search` also caches a miss: "not on TVmaze" is a valid session answer.
 */
const searchCache = new Map<string, TvmazeMatch | null>();
const showCache = new Map<number, TvmazeMatch>();
const castCache = new Map<number, TvmazeCharacter[]>();

/** Test-only: forget every cached search, show and cast. */
export function __clearTvmazeCacheForTests(): void {
  searchCache.clear();
  showCache.clear();
  castCache.clear();
}

// --- Payload shapes -----------------------------------------------------------

interface TvmazeImageNode {
  medium?: string | null;
  original?: string | null;
}

interface TvmazeNetworkNode {
  name?: string | null;
  country?: { name?: string | null } | null;
}

interface TvmazeEpisodeNode {
  season?: number | null;
}

interface TvmazeShowNode {
  id?: number | null;
  name?: string | null;
  language?: string | null;
  premiered?: string | null;
  ended?: string | null;
  status?: string | null;
  genres?: string[] | null;
  rating?: { average?: number | null } | null;
  network?: TvmazeNetworkNode | null;
  webChannel?: TvmazeNetworkNode | null;
  image?: TvmazeImageNode | null;
  summary?: string | null;
  _embedded?: { episodes?: (TvmazeEpisodeNode | null)[] | null } | null;
}

interface TvmazeSearchEntry {
  score?: number | null;
  show?: TvmazeShowNode | null;
}

interface TvmazeCastNode {
  person?: { id?: number | null; name?: string | null; image?: TvmazeImageNode | null } | null;
  character?: { id?: number | null; name?: string | null; image?: TvmazeImageNode | null } | null;
}

// --- Transport ----------------------------------------------------------------

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError';

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const fetchOnce = async (url: string): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new TvmazeError('TVmaze request timed out');
    }
    throw new TvmazeError(`TVmaze request failed: ${errorMessage(error)}`);
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Single throttled entry point for every TVmaze request. Returns `null` for a
 * 404, which both endpoints use to mean "no such resource" rather than an
 * error. A 429 is retried exactly once; anything else that is not OK throws.
 */
const requestJson = async <T>(url: string): Promise<T | null> =>
  enqueue(async () => {
    let response = await fetchOnce(url);

    if (response.status === 429) {
      // Tests zero the throttle interval; the artificial pause follows it so a
      // suite never waits a real second and a half.
      const backoff = throttleIntervalMs > 0 ? RATE_LIMIT_BACKOFF_MS : 0;
      if (backoff > 0) await sleep(backoff);
      lastRequestStartedAt = Date.now();
      response = await fetchOnce(url);
    }

    if (response.status === 404) return null;

    if (!response.ok) {
      throw new TvmazeError(`TVmaze request failed with status ${response.status}`, response.status);
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new TvmazeError(`TVmaze returned an unreadable payload: ${errorMessage(error)}`);
    }
  });

// --- Normalization ------------------------------------------------------------

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/** TVmaze summaries are HTML. Strip the tags, decode the common entities, collapse whitespace. */
const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, entity => HTML_ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Lowercase, strip diacritics, collapse every non-alphanumeric run into a
 * single space, then trim. Mirrors the AniList matcher so both sources treat
 * "División Palermo" and "division palermo" as the same title.
 */
const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * `/search/shows` always returns its best fuzzy guess, even for nonsense, so a
 * candidate is only usable when its name equals the query or one contains the
 * other. Anything else would paste a stranger's poster onto the user's card.
 */
const isSameTitle = (normalizedQuery: string, normalizedName: string): boolean => {
  if (!normalizedQuery || !normalizedName) return false;
  return (
    normalizedQuery === normalizedName ||
    normalizedQuery.includes(normalizedName) ||
    normalizedName.includes(normalizedQuery)
  );
};

const toFiniteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const nonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Embedded episodes -> season count, total episode count and season-1 episode
 * count. Specials (season 0) are not part of the show's run and would inflate
 * every number.
 */
const deriveEpisodeStats = (
  episodes: (TvmazeEpisodeNode | null)[] | undefined,
): { totalEpisodes?: number; seasons?: number; firstSeasonEpisodes?: number } => {
  if (!Array.isArray(episodes)) return {};

  const seasonNumbers = new Set<number>();
  let totalEpisodes = 0;
  let firstSeasonEpisodes = 0;

  for (const episode of episodes) {
    if (!episode) continue;
    if (episode.season === 0) continue;
    totalEpisodes += 1;
    if (typeof episode.season === 'number' && episode.season > 0) {
      seasonNumbers.add(episode.season);
      if (episode.season === 1) firstSeasonEpisodes += 1;
    }
  }

  return {
    totalEpisodes: totalEpisodes > 0 ? totalEpisodes : undefined,
    seasons: seasonNumbers.size > 0 ? seasonNumbers.size : undefined,
    firstSeasonEpisodes: firstSeasonEpisodes > 0 ? firstSeasonEpisodes : undefined,
  };
};

/**
 * TVmaze answers with an English enum, but the app stores broadcast status in
 * Spanish everywhere else (Gemini writes "En emisión" / "Finalizado", and
 * `deck.ts` translates AniList's `FINISHED`/`RELEASING` the same way). The
 * translation belongs at this boundary so no consumer ever sees the raw value.
 * An unknown value yields `undefined`, which leaves an existing status alone.
 */
const TVMAZE_STATUS_LABELS: Record<string, string> = {
  Running: 'En emisión',
  Ended: 'Finalizado',
  'To Be Determined': 'Por confirmar',
  'In Development': 'En desarrollo',
};

const toStatusLabel = (value: string | null | undefined): string | undefined => {
  const raw = nonEmptyString(value);
  if (!raw) return undefined;
  return TVMAZE_STATUS_LABELS[raw];
};

const toMatch = (show: TvmazeShowNode): TvmazeMatch | null => {
  if (!show || typeof show.id !== 'number' || !Number.isFinite(show.id)) return null;

  const name = nonEmptyString(show.name);
  if (!name) return null;

  // A show is either on a network or on a streaming service; country follows
  // whichever one is present, and the network label prefers the broadcast one.
  const networkNode = show.network ?? show.webChannel ?? null;
  const stats = deriveEpisodeStats(show._embedded?.episodes);

  return {
    id: show.id,
    name,
    language: nonEmptyString(show.language),
    premiered: nonEmptyString(show.premiered),
    ended: nonEmptyString(show.ended),
    status: toStatusLabel(show.status),
    genres: Array.isArray(show.genres) ? show.genres.filter(genre => typeof genre === 'string') : [],
    rating: toFiniteNumber(show.rating?.average),
    image: nonEmptyString(show.image?.original) ?? nonEmptyString(show.image?.medium),
    synopsis: nonEmptyString(show.summary) ? stripHtml(show.summary) || undefined : undefined,
    network: nonEmptyString(networkNode?.name),
    country: nonEmptyString(show.network?.country?.name) ?? nonEmptyString(show.webChannel?.country?.name),
    ...stats,
  };
};

/**
 * Highest-scoring candidate whose name survives the sanity check. A tie keeps
 * the first one TVmaze ranked highest, which is its own relevance order.
 */
const pickBestMatch = (query: string, entries: unknown): TvmazeMatch | null => {
  if (!Array.isArray(entries)) return null;

  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;

  let best: { match: TvmazeMatch; score: number } | null = null;

  for (const entry of entries as (TvmazeSearchEntry | null)[]) {
    if (!entry || typeof entry !== 'object') continue;

    const show = entry.show;
    if (!show) continue;
    if (!isSameTitle(normalizedQuery, normalize(show.name ?? ''))) continue;

    const match = toMatch(show);
    if (!match) continue;

    const score = toFiniteNumber(entry.score) ?? 0;
    if (!best || score > best.score) best = { match, score };
  }

  return best?.match ?? null;
};

// --- Public API ---------------------------------------------------------------

/**
 * One search request. Returns `null` for an empty query (without any request),
 * for a 404 and for an empty result set. Never throws for "not found".
 */
export async function searchTvmazeShow(title: string): Promise<TvmazeMatch | null> {
  const query = typeof title === 'string' ? title.trim() : '';
  if (!query) return null;

  const cacheKey = normalize(query) || query.toLowerCase();
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey) ?? null;

  const payload = await requestJson<TvmazeSearchEntry[]>(
    `${TVMAZE_API_BASE}/search/shows?q=${encodeURIComponent(query)}`,
  );
  const match = pickBestMatch(query, payload ?? []);

  searchCache.set(cacheKey, match);
  return match;
}

/**
 * One request with the full episode list embedded, so `totalEpisodes` and
 * `seasons` are real counts instead of a guess. Successful payloads are cached
 * for the rest of the session; failures are not.
 */
export async function fetchTvmazeShow(id: number): Promise<TvmazeMatch | null> {
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) return null;

  const cached = showCache.get(id);
  if (cached) return cached;

  const payload = await requestJson<TvmazeShowNode>(`${TVMAZE_API_BASE}/shows/${id}?embed[]=episodes`);
  if (!payload) return null;

  const match = toMatch(payload);
  if (!match) return null;

  showCache.set(id, match);
  return match;
}

/**
 * The show's cast: character name, the actor behind it and the character
 * portrait. One request, cached for the session. Returns an empty array for an
 * invalid id, a 404 or a show with no cast.
 */
export async function fetchTvmazeCharacters(showId: number): Promise<TvmazeCharacter[]> {
  if (typeof showId !== 'number' || !Number.isFinite(showId) || showId <= 0) return [];

  const cached = castCache.get(showId);
  // Copies keep a caller's mutation from corrupting the cache.
  if (cached) return cached.map(character => ({ ...character }));

  const payload = await requestJson<(TvmazeCastNode | null)[]>(`${TVMAZE_API_BASE}/shows/${showId}/cast`);

  // A 404 is cached as an empty cast: a show without cast does not grow one
  // mid-session, and the picker must not retry on every open.
  const characters: TvmazeCharacter[] = [];
  for (const node of payload ?? []) {
    if (!node) continue;

    const name = nonEmptyString(node.character?.name);
    if (!name) continue;

    // The character id is the identity the picker selects. The actor id is only
    // a fallback for malformed entries where TVmaze dropped the character id.
    const characterId = toFiniteNumber(node.character?.id);
    const id = characterId !== undefined && characterId > 0 ? characterId : toFiniteNumber(node.person?.id);
    if (id === undefined || id <= 0) continue;

    // Prefer the character portrait: the user is picking characters, not actors.
    characters.push({
      id,
      name,
      actor: nonEmptyString(node.person?.name),
      image:
        nonEmptyString(node.character?.image?.original) ??
        nonEmptyString(node.character?.image?.medium) ??
        nonEmptyString(node.person?.image?.original) ??
        nonEmptyString(node.person?.image?.medium),
    });
  }

  castCache.set(showId, characters);
  return characters.map(character => ({ ...character }));
}

// --- Pure projection ----------------------------------------------------------

const isBlank = (value: string | undefined): boolean =>
  typeof value !== 'string' || value.trim().length === 0;

const formatTotalContent = (match: TvmazeMatch): string | undefined => {
  const totalEpisodes = match.totalEpisodes;
  if (typeof totalEpisodes !== 'number' || !Number.isFinite(totalEpisodes) || totalEpisodes <= 0) {
    return undefined;
  }

  const seasons = match.seasons;
  const episodesLabel = `${totalEpisodes} Caps`;

  if (typeof seasons !== 'number' || !Number.isFinite(seasons) || seasons <= 0) {
    // No episode list, so the season count is unknown: claim only what exists.
    return episodesLabel;
  }

  const seasonsLabel = seasons === 1 ? '1 Temporada' : `${seasons} Temporadas`;
  return `${seasonsLabel} · ${episodesLabel}`;
};

/**
 * Fills the factual holes Gemini leaves in a `Serie` without ever deciding what
 * to recommend. Fill-only by default: a user's cover, genres, status, dates and
 * synopsis are never replaced, and `totalContent` is only rewritten when the
 * caller explicitly opts in (the discovery hand-off, where it is invented).
 *
 * Fields TVmaze does not own are copied untouched: `title`, `originalTitle`,
 * `mediaType`, `sourceUrls`, `primaryColor`, `franchise_link`, `coverDescription`
 * and `anilist`.
 */
export function applyTvmazeMetadata(
  aiData: AIWorkData,
  match: TvmazeMatch,
  options: { overwrite?: boolean } = {},
): AIWorkData {
  const next: AIWorkData = { ...aiData, tvmaze: { id: match.id } };

  // The cover is the whole point of this slice, but it may only fill a hole.
  if (isBlank(aiData.coverImage) && match.image) {
    next.coverImage = match.image;
  }

  if ((!Array.isArray(aiData.genres) || aiData.genres.length === 0) && Array.isArray(match.genres) && match.genres.length > 0) {
    next.genres = [...match.genres];
  }

  if ((isBlank(aiData.status) || aiData.status === 'Desconocido') && match.status) {
    next.status = match.status;
  }

  if (isBlank(aiData.releaseDate) && match.premiered) {
    next.releaseDate = match.premiered;
  }

  if (isBlank(aiData.endDate) && match.ended) {
    next.endDate = match.ended;
  }

  // The synopsis is deliberately NOT copied. TVmaze serves `summary` in English
  // only — even for a Spanish show like "El Marginal" — and this app's synopsis
  // is Spanish everywhere else (Gemini writes it, ManhwaWeb supplies it). The
  // deck's translator is keyed by AniList id and never runs for a library item,
  // so an English summary copied here would land untranslated in the library.
  // A missing synopsis is better than one in the wrong language.

  if (options.overwrite === true) {
    const totalContent = formatTotalContent(match);
    if (totalContent) next.totalContent = totalContent;
  }

  return next;
}
