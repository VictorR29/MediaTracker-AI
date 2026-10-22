import { create } from 'zustand';
import { runCharacterImageBackfill } from '../services/characterImageBackfill';
import type { CharacterImageBackfillSummary } from '../services/characterImageBackfill';
import { useLibraryStore } from './useLibraryStore';

/**
 * Cancellation lives outside the store: `runCharacterImageBackfill` polls it
 * through `shouldStop`, and it must survive re-renders without being state.
 */
let stopRequested = false;

interface CharacterImageBackfillState {
  summary: CharacterImageBackfillSummary | null;
  isRunning: boolean;
  current: string | null;
  start: () => Promise<void>;
  cancel: () => void;
}

export const useCharacterImageBackfillStore = create<CharacterImageBackfillState>((set, get) => ({
  summary: null,
  isRunning: false,
  current: null,

  start: async () => {
    if (get().isRunning) return;

    stopRequested = false;
    set({ isRunning: true, current: null });

    try {
      const summary = await runCharacterImageBackfill({
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
