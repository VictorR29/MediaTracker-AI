import { useEffect, useRef } from 'react';
import type { MediaItem } from '../types';
import { refreshStaleAiring } from '../services/anilistAutoRefresh';
import { applyAiringSnapshots } from '../services/anilistService';
import { saveMediaItem } from '../services/storage';
import { useAniListBackfillStore } from '../stores/useAniListBackfillStore';
import { useLibraryStore } from '../stores/useLibraryStore';

/**
 * Refreshes the airing snapshots of stale linked anime once per mount.
 *
 * - Silent by contract: no toast, no spinner, and no console output. A failure
 *   simply leaves the previous snapshots untouched.
 * - The manual backfill owns the API while it runs, so this path defers to it.
 * - Persistence happens before the single store write, so a reload can never
 *   show a snapshot that was never stored.
 */
export function useAiringAutoRefresh(enabled: boolean): void {
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;

    const run = async (): Promise<void> => {
      try {
        if (useAniListBackfillStore.getState().isRunning) return;

        const { updated, snapshots } = await refreshStaleAiring({
          items: useLibraryStore.getState().library,
        });

        if (updated.length === 0) return;

        // Re-read the live library before writing: the batch took seconds, and
        // the plan was built from the library as it was before the request. Only
        // the airing fields change, so applying them over the current item keeps
        // any edit made meanwhile and skips works deleted in the window.
        const liveById = new Map(useLibraryStore.getState().library.map(item => [item.id, item]));
        const toSave: MediaItem[] = [];
        for (const planned of updated) {
          const current = liveById.get(planned.id);
          if (!current) continue;

          const merged = applyAiringSnapshots(current, snapshots);
          if (merged !== current) toSave.push(merged);
        }

        if (toSave.length === 0) return;

        await Promise.allSettled(toSave.map(item => saveMediaItem(item)));

        // The mount is gone: writing now would touch a store nobody is rendering.
        if (cancelledRef.current) return;

        // One update for the whole run: N writes would re-render the grid N times.
        const byId = new Map(toSave.map(item => [item.id, item]));
        useLibraryStore.setState(state => ({
          library: state.library.map(item => byId.get(item.id) ?? item),
        }));
      } catch {
        // Intentionally silent.
      }
    };

    void run();

    return () => {
      cancelledRef.current = true;
    };
  }, [enabled]);
}
