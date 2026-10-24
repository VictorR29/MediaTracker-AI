import type { MediaItem } from '../types';

/**
 * ManhwaWeb is an unofficial, no-auth API used only as an OPTIONAL external
 * link target. It is never a discovery source: nothing here feeds the AniList
 * engine, and nothing is fetched unless the user asks for it.
 *
 * Verified facts: the API answers CORS `*`, so the browser can call it directly;
 * the series page lives at `https://manhwaweb.com/manhwa/<slug>`.
 */
export const MANHWAWEB_API_BASE = 'https://api.manhwaweb.com';
export const MANHWAWEB_SITE_BASE = 'https://manhwaweb.com';

/** Title of the custom link this integration writes into the library item. */
export const MANHWAWEB_READ_LINK_TITLE = 'Leer en ManhwaWeb';

const DEFAULT_SEARCH_LIMIT = 8;

export interface ManhwaWebCandidate {
  slug: string;
  /** Canonical (usually English) title, i.e. `the_real_name`. */
  title: string;
  /** `name_esp`, present only when it differs from `title`. */
  spanishTitle?: string;
  coverImage?: string;
  chapters?: number;
  status?: string;
}

export interface ManhwaWebDetail extends ManhwaWebCandidate {
  synopsis?: string;
  genres: string[];
  authors: string[];
  readUrl: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toNonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const toFiniteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * `tipo=manhwa` and `erotico=no` are non-negotiable: this app never links adult
 * entries, and the endpoint would otherwise mix other formats into the results.
 */
const buildSearchUrl = (query: string): string =>
  `${MANHWAWEB_API_BASE}/manhwa/library?buscar=${encodeURIComponent(query)}` +
  '&tipo=manhwa&erotico=no&estado=&demografia=&order_item=popularidad&order_dir=desc&page=0&generes=';

const buildDetailUrl = (slug: string): string =>
  `${MANHWAWEB_API_BASE}/manhwa/see/${encodeURIComponent(slug)}`;

const buildReadUrl = (slug: string): string =>
  `${MANHWAWEB_SITE_BASE}/manhwa/${encodeURIComponent(slug)}`;

/** Shared field mapping; returns null when the entry has no usable identity. */
const mapCandidate = (raw: unknown, fallbackSlug?: string): ManhwaWebCandidate | null => {
  if (!isRecord(raw)) return null;

  // `real_id` wins: some entries carry an unrelated `_id` (verified live: the
  // detail endpoint 404s on it), while `real_id` always resolves both on the
  // API and on the site.
  const slug =
    toNonEmptyString(raw.real_id) ?? toNonEmptyString(raw._id) ?? toNonEmptyString(fallbackSlug);
  const title =
    toNonEmptyString(raw.the_real_name) ??
    toNonEmptyString(raw.name_esp) ??
    toNonEmptyString(raw.name_raw);
  if (!slug || !title) return null;

  const spanish = toNonEmptyString(raw.name_esp);
  const spanishTitle = spanish && spanish !== title ? spanish : undefined;

  return {
    slug,
    title,
    spanishTitle,
    coverImage: toNonEmptyString(raw._imagen),
    chapters: toFiniteNumber(raw._numero_cap),
    status: toNonEmptyString(raw._status),
  };
};

/**
 * Maps one index entry. Every adult entry is dropped defensively, even though
 * the request already filters them, and malformed entries are ignored.
 */
const toCandidate = (raw: unknown): ManhwaWebCandidate | null => {
  if (!isRecord(raw)) return null;
  if (raw._erotico !== 'no') return null;
  return mapCandidate(raw);
};

/** `_categoris` is an array of single-key objects; only the labels matter. */
const toGenres = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];

  const genres: string[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    for (const value of Object.values(entry)) {
      const label = toNonEmptyString(value);
      if (label) genres.push(label);
    }
  }
  return genres;
};

const toAuthors = (raw: unknown): string[] => {
  if (!isRecord(raw) || !Array.isArray(raw.autores)) return [];

  const authors: string[] = [];
  for (const entry of raw.autores) {
    const author = toNonEmptyString(entry);
    if (author) authors.push(author);
  }
  return authors;
};

const clampLimit = (limit: number): number =>
  Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : DEFAULT_SEARCH_LIMIT;

/**
 * Searches ManhwaWeb's manhwa catalog. An empty query never reaches the
 * network, and a single malformed entry never breaks the whole list.
 */
export async function searchManhwaWeb(
  query: string,
  limit: number = DEFAULT_SEARCH_LIMIT,
): Promise<ManhwaWebCandidate[]> {
  const search = typeof query === 'string' ? query.trim() : '';
  if (!search) return [];

  const response = await fetch(buildSearchUrl(search), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`ManhwaWeb search failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const data = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];

  const candidates: ManhwaWebCandidate[] = [];
  for (const raw of data) {
    const candidate = toCandidate(raw);
    if (candidate) candidates.push(candidate);
  }

  return candidates.slice(0, clampLimit(limit));
}

/** Full detail for one series, including the Spanish synopsis and the read URL. */
export async function fetchManhwaWebDetail(slug: string): Promise<ManhwaWebDetail> {
  const cleanSlug = typeof slug === 'string' ? slug.trim() : '';
  if (!cleanSlug) throw new Error('ManhwaWeb detail requires a slug');

  const response = await fetch(buildDetailUrl(cleanSlug), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`ManhwaWeb detail failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const raw = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  if (!isRecord(raw)) throw new Error('ManhwaWeb returned an unreadable payload');

  const candidate = mapCandidate(raw, cleanSlug);
  const title = candidate?.title ?? cleanSlug;

  return {
    slug: cleanSlug,
    title,
    spanishTitle: candidate?.spanishTitle,
    coverImage: candidate?.coverImage,
    chapters: candidate?.chapters,
    status: candidate?.status,
    synopsis: toNonEmptyString(raw._sinopsis),
    genres: toGenres(raw._categoris),
    authors: toAuthors(raw._extras),
    readUrl: buildReadUrl(cleanSlug),
  };
}

/**
 * Pure, idempotent link attach:
 * - appends the read link only when that exact URL is not already present;
 * - fills an empty synopsis with the Spanish one, never overwriting the user's;
 * - leaves title, cover, genres and every AniList field untouched.
 *
 * `id`/`now` are injectable so callers and tests can stay deterministic.
 */
export function applyManhwaWebLink(
  item: MediaItem,
  detail: ManhwaWebDetail,
  { id, now }: { id?: string; now?: number } = {},
): MediaItem {
  const readUrl = detail.readUrl;
  if (!readUrl) return item;

  const timestamp = now ?? Date.now();
  const existingLinks = item.trackingData.customLinks ?? [];
  const alreadyLinked = existingLinks.some(link => link.url === readUrl);
  const customLinks = alreadyLinked
    ? existingLinks
    : [
        ...existingLinks,
        {
          id: id ?? timestamp.toString(),
          url: readUrl,
          title: MANHWAWEB_READ_LINK_TITLE,
        },
      ];

  const synopsis = detail.synopsis?.trim();
  const currentSynopsis = item.aiData.synopsis;
  const shouldFillSynopsis = !!synopsis && !currentSynopsis?.trim();

  return {
    ...item,
    aiData: shouldFillSynopsis
      ? { ...item.aiData, synopsis: detail.synopsis as string }
      : item.aiData,
    trackingData: { ...item.trackingData, customLinks },
  };
}
