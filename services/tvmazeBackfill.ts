import type { MediaItem } from '../types';
import type { BackfillSummary } from './anilistBackfill';
import { TvmazeError, applyTvmazeMetadata, fetchTvmazeShow, searchTvmazeShow } from './tvmazeService';
import type { TvmazeMatch } from './tvmazeService';

/**
 * Same envelope as the AniList run so the settings modal can render either one
 * with the same progress and summary treatment. `skipped` has no equivalent
 * here — TVmaze metadata is either missing or already stored — and stays 0.
 */
export type TvmazeBackfillSummary = BackfillSummary;

export interface TvmazeBackfillDeps {
  resolve: (title: string) => Promise<TvmazeMatch | null>;
  fetchDetail: (id: number) => Promise<TvmazeMatch | null>;
}

export interface RunTvmazeBackfillOptions {
  items: MediaItem[];
  persist: (item: MediaItem) => Promise<void> | void;
  /**
   * Reads the CURRENT version of an item before writing it back. The store
   * passes a live lookup so a long run cannot overwrite edits made meanwhile or
   * resurrect an item the user deleted.
   */
  read?: (itemId: string) => MediaItem | undefined;
  onProgress?: (summary: TvmazeBackfillSummary, current?: string) => void;
  shouldStop?: () => boolean;
  deps?: Partial<TvmazeBackfillDeps>; // defaults to the real service functions
}

/** Consecutive request failures that abort the run instead of hammering the API. */
const MAX_CONSECUTIVE_FAILURES = 3;

const defaultDeps: TvmazeBackfillDeps = {
  resolve: searchTvmazeShow,
  fetchDetail: fetchTvmazeShow,
};

const isRateLimit = (error: unknown): boolean => error instanceof TvmazeError && error.status === 429;

const hasCover = (item: MediaItem): boolean => {
  const cover = item.aiData.coverImage;
  return typeof cover === 'string' && cover.trim().length > 0;
};

/**
 * Series whose metadata is still missing and that the user still cares about.
 * A discarded work is never worth a request, and a user's cover — uploaded or
 * remote — is never a reason to touch the item at all.
 */
const isCandidate = (item: MediaItem): boolean =>
  item.aiData.mediaType === 'Serie' &&
  item.trackingData.status !== 'Descartado' &&
  item.aiData.tvmaze?.id === undefined &&
  !hasCover(item);

/**
 * Hydrates the library's Series from TVmaze without ever throwing.
 *
 * Metadata only: the run never reorders, drops or recommends anything. A title
 * TVmaze does not know is counted as failed, but a miss is not treated as an
 * outage — only real request errors feed the consecutive-failure breaker, so a
 * library full of obscure series can still finish.
 */
export async function runTvmazeBackfill(options: RunTvmazeBackfillOptions): Promise<TvmazeBackfillSummary> {
  const { items, persist, onProgress, shouldStop } = options;
  const deps: TvmazeBackfillDeps = { ...defaultDeps, ...options.deps };

  /** Writes made during this run, so a second read sees them without a live store. */
  const written = new Map<string, MediaItem>();
  const liveRead = options.read;
  const read = (itemId: string): MediaItem | undefined =>
    liveRead ? liveRead(itemId) : written.get(itemId) ?? items.find(item => item.id === itemId);

  const summary: TvmazeBackfillSummary = {
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

  /** A single failed write must not abort a run that already hydrated dozens of items. */
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

    let consecutiveFailures = 0;

    for (const item of candidates) {
      if (abortsOnStop()) return summary;

      // The run outlives the capture: re-read before spending a request so an
      // item hydrated or given a cover in the meantime is left alone.
      const before = read(item.id);
      if (!before) {
        summary.done += 1;
        notify();
        continue;
      }
      if (before.aiData.tvmaze?.id !== undefined || hasCover(before)) {
        summary.done += 1;
        notify(before.aiData.title);
        continue;
      }

      notify(before.aiData.title);

      let match: TvmazeMatch | null = null;
      let requestFailed = false;

      try {
        match = await deps.resolve(before.aiData.title);
      } catch (error) {
        if (isRateLimit(error)) {
          summary.aborted = true;
          summary.abortReason = 'rate_limit';
          return summary;
        }
        requestFailed = true;
        match = null;
      }

      if (requestFailed) {
        summary.failed += 1;
        consecutiveFailures += 1;
      } else if (!match) {
        // TVmaze does not know this title. A miss is a real outcome, not an
        // outage: it counts as failed but never trips the breaker.
        summary.failed += 1;
        consecutiveFailures = 0;
      } else {
        let detail: TvmazeMatch | null = null;
        try {
          detail = await deps.fetchDetail(match.id);
        } catch (error) {
          if (isRateLimit(error)) {
            summary.aborted = true;
            summary.abortReason = 'rate_limit';
            return summary;
          }
          // The identity and the cover are already in hand: keep them instead
          // of discarding a valid match over a missing episode list.
          detail = null;
        }

        // Re-read once more: the item may have changed while the second
        // request was in flight, and `applyTvmazeMetadata` is fill-only anyway.
        const base = read(item.id);
        if (!base) {
          summary.done += 1;
          notify();
          continue;
        }

        const hydrated: MediaItem = {
          ...base,
          aiData: applyTvmazeMetadata(base.aiData, detail ?? match, { overwrite: false }),
        };
        if (await save(hydrated)) {
          summary.matched += 1;
          consecutiveFailures = 0;
        } else {
          summary.failed += 1;
          consecutiveFailures += 1;
        }
      }

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        summary.aborted = true;
        summary.abortReason = 'too_many_failures';
        return summary;
      }

      summary.done += 1;
      notify(item.aiData.title);
    }

    return summary;
  } catch {
    return summary;
  }
}
