import type { MediaItem } from '../types';
import { applyAiringSnapshots, fetchAiringSnapshots, resolveAniListScope } from './anilistService';
import type { AiringDetails } from './anilistService';

export const DEFAULT_AIRING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface RefreshAiringOptions {
  items: MediaItem[];
  /** Data older than this is refreshed. Defaults to DEFAULT_AIRING_MAX_AGE_MS. */
  maxAgeMs?: number;
  /** Unix ms. Defaults to Date.now(). */
  now?: number;
  /** Injected for tests. Defaults to the real service function. */
  fetchSnapshots?: (ids: number[]) => Promise<Map<number, AiringDetails>>;
}

export interface RefreshAiringResult {
  /** Ids actually sent to AniList. Empty when nothing was stale. */
  requestedIds: number[];
  /** Items with a fresh snapshot applied. Empty on failure. */
  updated: MediaItem[];
  /**
   * The raw batch response, so a caller can re-apply it over the LIVE item just
   * before writing. A run lasts seconds and the library may have changed; the
   * `updated` items are built from the pre-request snapshot and must not be
   * written back wholesale.
   */
  snapshots: Map<number, AiringDetails>;
  /** True when the request failed. Never thrown. */
  failed: boolean;
}

/**
 * Only already-linked works AniList covers can be refreshed: resolving identity
 * here would mean one search request per unknown work, which is exactly what
 * this path exists to avoid.
 *
 * A linked manhwa has no `nextAiringEpisode`, but its status, cover and genres
 * still refresh through the same snapshot.
 *
 * A missing `fetchedAt` (or a non-finite one from a malformed payload) counts
 * as stale, because it cannot be proven fresh.
 */
export function isAiringRefreshCandidate(item: MediaItem, now: number, maxAgeMs: number): boolean {
  if (resolveAniListScope(item) === null) return false;
  if (item.trackingData.status === 'Descartado') return false;

  const anilist = item.aiData.anilist;
  if (!anilist) return false;

  const airing = anilist.airing;
  if (!airing) return true;
  if (!Number.isFinite(airing.fetchedAt)) return true;

  // Strictly older only: data exactly at the boundary is still fresh.
  return now - airing.fetchedAt > maxAgeMs;
}

/**
 * Refreshes the airing snapshots of stale, already-linked anime in one batched
 * request (`fetchAiringSnapshots` chunks every 50 ids).
 *
 * It plans every id locally first, so a library whose snapshots are fresh
 * costs zero requests. Never throws: any transport failure is reported as
 * `failed: true` with no updates, leaving the previous data untouched.
 */
export async function refreshStaleAiring(options: RefreshAiringOptions): Promise<RefreshAiringResult> {
  const {
    items,
    maxAgeMs = DEFAULT_AIRING_MAX_AGE_MS,
    now = Date.now(),
    fetchSnapshots = fetchAiringSnapshots,
  } = options;

  const candidates = items.filter(item => isAiringRefreshCandidate(item, now, maxAgeMs));
  if (candidates.length === 0) {
    return { requestedIds: [], updated: [], snapshots: new Map(), failed: false };
  }

  const requestedIds = Array.from(new Set(candidates.map(item => item.aiData.anilist!.id)));

  let snapshots: Map<number, AiringDetails>;
  try {
    snapshots = await fetchSnapshots(requestedIds);
  } catch {
    return { requestedIds, updated: [], snapshots: new Map(), failed: true };
  }

  // Defensive: a malformed dependency result must not throw out of a silent path.
  if (!(snapshots instanceof Map)) {
    return { requestedIds, updated: [], snapshots: new Map(), failed: true };
  }

  const updated: MediaItem[] = [];
  for (const item of candidates) {
    const next = applyAiringSnapshots(item, snapshots);
    // Same reference means AniList returned nothing for this id: skip it rather
    // than pushing an untouched item and triggering a pointless write.
    if (next !== item) updated.push(next);
  }

  return { requestedIds, updated, snapshots, failed: false };
}
