import type { AniListAiringSnapshot, AniListData, MediaItem } from '../types';
import {
  AniListError,
  applyAiringSnapshots,
  applyMatchResult,
  fetchAiringSnapshots,
  isAiringSnapshotFresh,
  resolveAniListMatch,
} from './anilistService';
import type { AiringDetails, MatchResult } from './anilistService';

export interface BackfillSummary {
  total: number;
  done: number;
  skipped: number; // fresh snapshot already
  matched: number; // identity resolved and/or snapshot refreshed
  unmatched: number; // no confident match
  failed: number;
  aborted: boolean;
  abortReason?: 'cancelled' | 'rate_limit' | 'too_many_failures';
}

export interface BackfillDeps {
  resolve: (item: MediaItem) => Promise<MatchResult>;
  fetchSnapshots: (ids: number[]) => Promise<Map<number, AiringDetails>>;
  isFresh: (snapshot: AniListAiringSnapshot | undefined, now?: number) => boolean;
}

export interface RunBackfillOptions {
  items: MediaItem[];
  persist: (item: MediaItem) => Promise<void> | void;
  /**
   * Reads the CURRENT version of an item before writing it back.
   *
   * A run can last over a minute and `persist` upserts, so writing the snapshot
   * taken when the run started would overwrite edits made meanwhile and even
   * resurrect an item the user deleted. The store passes a live lookup; the
   * default falls back to the starting snapshot for tests and one-shot callers.
   */
  read?: (itemId: string) => MediaItem | undefined;
  onProgress?: (summary: BackfillSummary, current?: string) => void;
  shouldStop?: () => boolean;
  deps?: Partial<BackfillDeps>; // defaults to the real service functions
  now?: () => number; // defaults to Date.now
}

/** Consecutive phase 2 failures that abort the run instead of hammering the API. */
const MAX_CONSECUTIVE_FAILURES = 3;

const defaultDeps: BackfillDeps = {
  resolve: resolveAniListMatch,
  fetchSnapshots: fetchAiringSnapshots,
  isFresh: isAiringSnapshotFresh,
};

const isRateLimit = (error: unknown): boolean =>
  error instanceof AniListError && error.kind === 'rate_limit';

const isCandidate = (item: MediaItem): boolean =>
  item.aiData.mediaType === 'Anime' && item.trackingData.status !== 'Descartado';

/**
 * Brings the whole library in line with AniList without ever throwing.
 *
 * The run is split in three phases so every outbound request is paid once:
 * 1. One batch call refreshes every stale linked item.
 * 2. Unlinked items are resolved one by one (identity persists before any
 *    snapshot request, so a network failure cannot lose a match).
 * 3. One batch call loads snapshots for the ids resolved in phase 2.
 */
export async function runAniListBackfill(options: RunBackfillOptions): Promise<BackfillSummary> {
  const { items, persist, onProgress, shouldStop, now = Date.now } = options;
  const deps: BackfillDeps = { ...defaultDeps, ...options.deps };

  /**
   * Writes made during this run. Without an external live reader, phase 3 would
   * read the pre-run snapshot and could never see the identity phase 2 just
   * persisted; with one, the store's live version always wins.
   */
  const written = new Map<string, MediaItem>();
  const liveRead = options.read;
  const read = (itemId: string): MediaItem | undefined =>
    liveRead ? liveRead(itemId) : written.get(itemId) ?? items.find(item => item.id === itemId);

  const summary: BackfillSummary = {
    total: 0,
    done: 0,
    skipped: 0,
    matched: 0,
    unmatched: 0,
    failed: 0,
    aborted: false,
  };

  const notify = (current?: string): void => {
    // A copy is mandatory: React/Zustand compare references on every update.
    onProgress?.({ ...summary }, current);
  };

  /**
   * A single failed write must not abort a run that already matched dozens of
   * items: the caller only learns the count.
   */
  const save = async (item: MediaItem): Promise<boolean> => {
    try {
      await persist(item);
      written.set(item.id, item);
      return true;
    } catch {
      return false;
    }
  };

  const abortsOnStop = (): boolean => {
    if (!shouldStop?.()) return false;
    summary.aborted = true;
    summary.abortReason = 'cancelled';
    return true;
  };

  try {
    const candidates = items.filter(isCandidate);
    summary.total = candidates.length;
    notify();

    const fresh: MediaItem[] = [];
    const staleLinked: MediaItem[] = [];
    const unlinked: MediaItem[] = [];
    const nowTs = now();

    for (const item of candidates) {
      const anilist = item.aiData.anilist;
      if (anilist?.airing && deps.isFresh(anilist.airing, nowTs)) fresh.push(item);
      else if (anilist) staleLinked.push(item);
      else unlinked.push(item);
    }

    // --- Phase 0: already fresh --------------------------------------------
    for (const item of fresh) {
      summary.skipped += 1;
      summary.done += 1;
      notify(item.aiData.title);
    }

    // --- Phase 1: refresh stale links in a single batch ---------------------
    if (staleLinked.length > 0) {
      if (abortsOnStop()) return summary;

      const ids = Array.from(new Set(staleLinked.map(item => item.aiData.anilist!.id)));

      try {
        const snapshots = await deps.fetchSnapshots(ids);

        for (const item of staleLinked) {
          const base = read(item.id);
          if (!base) {
            // Deleted while the run was in flight: never write it back.
            summary.done += 1;
            notify();
            continue;
          }

          const mediaId = base.aiData.anilist?.id;
          if (mediaId === undefined || !snapshots.has(mediaId)) {
            // AniList no longer returns this id: the link is dangling, not fresh.
            summary.failed += 1;
            summary.done += 1;
            notify(base.aiData.title);
            continue;
          }

          const updated = applyAiringSnapshots(base, snapshots);
          if (await save(updated)) summary.matched += 1;
          else summary.failed += 1;
          summary.done += 1;
          notify(updated.aiData.title);
        }
      } catch (error) {
        if (isRateLimit(error)) {
          summary.aborted = true;
          summary.abortReason = 'rate_limit';
          return summary;
        }
        summary.failed += staleLinked.length;
        summary.done += staleLinked.length;
        notify();
      }
    }

    // --- Phase 2: resolve unlinked items one by one -------------------------
    /** AniList media id -> local item id, for the users resolved below. */
    const matchedById = new Map<number, string>();
    let consecutiveFailures = 0;

    for (const item of unlinked) {
      if (abortsOnStop()) return summary;

      // The run outlives the capture: re-read before spending a request so an
      // item deleted or linked manually in the meantime is left alone.
      const before = read(item.id);
      if (!before) {
        summary.done += 1;
        notify();
        continue;
      }
      if (before.aiData.anilist) {
        summary.done += 1;
        notify(before.aiData.title);
        continue;
      }

      notify(before.aiData.title);

      let match: AniListData | undefined;
      let outcome: 'matched' | 'unmatched' | 'failed' | 'rate_limit' = 'unmatched';

      try {
        const result = await deps.resolve(before);
        if (result.status === 'matched' && result.match) {
          match = result.match;
          outcome = 'matched';
        }
      } catch (error) {
        outcome = isRateLimit(error) ? 'rate_limit' : 'failed';
      }

      if (outcome === 'rate_limit') {
        summary.aborted = true;
        summary.abortReason = 'rate_limit';
        return summary;
      }

      if (outcome === 'matched' && match) {
        const base = read(item.id);
        if (!base) {
          // Deleted while the request was in flight.
          summary.done += 1;
          notify();
          continue;
        }

        // The identity is persisted before any snapshot request, so a failure
        // in phase 3 cannot lose the match.
        const stored = await save(applyMatchResult(base, { status: 'matched', match }));

        if (stored) {
          matchedById.set(match.id, item.id);
          summary.matched += 1;
          consecutiveFailures = 0;
        } else {
          summary.failed += 1;
          consecutiveFailures += 1;
        }
      } else if (outcome === 'unmatched') {
        summary.unmatched += 1;
        consecutiveFailures = 0;
      } else {
        summary.failed += 1;
        consecutiveFailures += 1;
      }

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        summary.aborted = true;
        summary.abortReason = 'too_many_failures';
        return summary;
      }

      summary.done += 1;
      notify(item.aiData.title);
    }

    // --- Phase 3: one batch snapshot call for the ids matched above ---------
    if (matchedById.size > 0) {
      const matchedIds = Array.from(matchedById.keys());

      try {
        const snapshots = await deps.fetchSnapshots(matchedIds);

        for (const [mediaId, itemId] of matchedById) {
          // Only ids AniList actually returned can be applied.
          if (!snapshots.has(mediaId)) continue;

          // Read the live item: it already carries the identity persisted in
          // phase 2, and skips a manual re-link made while the run was in flight.
          const base = read(itemId);
          if (!base || base.aiData.anilist?.id !== mediaId) continue;

          if (!(await save(applyAiringSnapshots(base, snapshots)))) summary.failed += 1;
        }
      } catch (error) {
        if (isRateLimit(error)) {
          summary.aborted = true;
          summary.abortReason = 'rate_limit';
          return summary;
        }
        // The identity is already persisted; only the volatile cache is missing.
        summary.failed += matchedById.size;
      }
    }

    return summary;
  } catch {
    return summary;
  }
}
