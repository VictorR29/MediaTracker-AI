import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../types';
import {
  AniListError,
  applyAiringSnapshots,
  applyMatchResult,
  fetchAiringSnapshots,
  isAiringSnapshotFresh,
  resolveAniListMatch,
} from '../services/anilistService';

export type AiringLoadState = 'idle' | 'loading' | 'ready' | 'unmatched' | 'error';

export interface UseAiringSnapshotArgs {
  item: MediaItem;
  enabled: boolean;
  onUpdate: (item: MediaItem) => void;
}

export interface UseAiringSnapshotResult {
  state: AiringLoadState;
  refresh: () => void;
}

/**
 * Resolves the AniList identity of an item (once) and keeps its airing snapshot
 * warm for the current session.
 *
 * - The match is persisted as soon as it is found, even if the snapshot request fails.
 * - The block renders the snapshot from the persisted item, so this hook only
 *   owns the load state; there is no local copy that could go stale.
 * - `item` and `onUpdate` are read through refs so a parent re-render cannot
 *   retrigger the effect; only the explicit dependency list below can.
 * - `refresh()` bumps an attempt counter to retry after an error.
 */
export function useAiringSnapshot(
  item: MediaItem,
  { enabled, onUpdate }: Omit<UseAiringSnapshotArgs, 'item'>,
): UseAiringSnapshotResult {
  const [state, setState] = useState<AiringLoadState>('idle');
  const [attempt, setAttempt] = useState(0);

  const itemRef = useRef(item);
  const onUpdateRef = useRef(onUpdate);
  itemRef.current = item;
  onUpdateRef.current = onUpdate;

  const inFlightRef = useRef(false);

  const refresh = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Keep the last known state: the block is not rendered on other tabs and
      // re-entering Progreso should paint instantly instead of flashing a skeleton.
      return;
    }

    // One run per item at a time; released by the cleanup below.
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    let cancelled = false;

    const run = async (): Promise<void> => {
      const current = itemRef.current;
      const existing = current.aiData.anilist;

      if (isAiringSnapshotFresh(existing?.airing)) {
        setState('ready');
        return;
      }

      setState('loading');

      let working = current;

      if (!existing) {
        const result = await resolveAniListMatch(working);
        if (cancelled) return;

        if (result.status !== 'matched' || !result.match) {
          setState('unmatched');
          return;
        }

        working = applyMatchResult(working, result);
        // Persist the identity immediately so a failed snapshot does not lose the match.
        onUpdateRef.current(working);
      }

      const anilist = working.aiData.anilist;
      if (!anilist) {
        setState('unmatched');
        return;
      }

      const snapshots = await fetchAiringSnapshots([anilist.id]);
      if (cancelled) return;

      const withSnapshot = applyAiringSnapshots(working, snapshots);
      onUpdateRef.current(withSnapshot);
      setState('ready');
    };

    void run().catch((error: unknown) => {
      if (cancelled) return;

      const reason = error instanceof AniListError ? `${error.name}: ${error.message}` : error;
      console.error('Failed to load the AniList airing snapshot', reason);

      setState('error');
    });

    return () => {
      cancelled = true;
      inFlightRef.current = false;
    };
    // `item` is read through a ref on purpose. Persisting the match mid-run updates
    // `item.aiData.anilist`, so depending on it would cancel this run and repeat the
    // same batch request. Freshness is re-checked on every run instead.
  }, [enabled, item.id, attempt]);

  return { state, refresh };
}
