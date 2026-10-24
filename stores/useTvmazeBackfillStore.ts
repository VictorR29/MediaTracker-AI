import { create } from 'zustand';
import { runTvmazeBackfill } from '../services/tvmazeBackfill';
import type { TvmazeBackfillSummary } from '../services/tvmazeBackfill';
import { useLibraryStore } from './useLibraryStore';

/**
 * Cancellation lives outside the store: `runTvmazeBackfill` polls it through
 * `shouldStop`, and it must survive re-renders without being part of state.
 */
let stopRequested = false;

interface TvmazeBackfillState {
  summary: TvmazeBackfillSummary | null;
  isRunning: boolean;
  current: string | null;
  start: () => Promise<void>;
  cancel: () => void;
}

export const useTvmazeBackfillStore = create<TvmazeBackfillState>((set, get) => ({
  summary: null,
  isRunning: false,
  current: null,

  start: async () => {
    if (get().isRunning) return;

    stopRequested = false;
    set({ isRunning: true, current: null });

    try {
      const summary = await runTvmazeBackfill({
        // Read the library at call time: the settings modal may hold a stale prop.
        items: useLibraryStore.getState().library,
        persist: item => useLibraryStore.getState().updateItem(item),
        // Live lookup: a long run must not overwrite edits or resurrect items
        // deleted while it was in flight.
        read: itemId => useLibraryStore.getState().library.find(item => item.id === itemId),
        onProgress: (next, current) => set({ summary: next, current: current ?? null }),
        shouldStop: () => stopRequested,
      });
      set({ summary });
    } finally {
      set({ isRunning: false, current: null });
    }
  },

  cancel: () => {
    stopRequested = true;
  },
}));
