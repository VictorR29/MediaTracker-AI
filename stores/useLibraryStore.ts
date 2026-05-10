import { create } from 'zustand';
import { MediaItem } from '../types';
import { saveMediaItem, getLibrary, deleteMediaItem, clearLibrary as clearLib } from '../services/storage';
import { FilterState } from '../components/LibraryFilters';

interface LibraryState {
  library: MediaItem[];
  filters: FilterState;
  isRestoring: boolean;
  loadLibrary: () => Promise<void>;
  addItem: (item: MediaItem) => Promise<void>;
  updateItem: (item: MediaItem) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearLibrary: () => Promise<void>;
  setFilters: (filters: FilterState | ((prev: FilterState) => FilterState)) => void;
  setRestoring: (v: boolean) => void;
  importItems: (items: MediaItem[], existingIds: Set<string>) => Promise<number>;
  getDisplayedLibrary: (view: string) => MediaItem[];
  getAvailableGenres: () => string[];
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  library: [],
  filters: {
    query: '',
    type: 'All',
    status: 'All',
    rating: 'All',
    genre: 'All',
    sortBy: 'updated',
    onlyFavorites: false
  },
  isRestoring: false,

  loadLibrary: async () => {
    const items = await getLibrary();
    set({ library: items });
  },

  addItem: async (item: MediaItem) => {
    await saveMediaItem(item);
    set(state => ({ library: [item, ...state.library] }));
  },

  updateItem: async (item: MediaItem) => {
    await saveMediaItem(item);
    set(state => {
      const exists = state.library.find(i => i.id === item.id);
      if (!exists) {
        return { library: [item, ...state.library] };
      }
      return { library: state.library.map(i => i.id === item.id ? item : i) };
    });
  },

  removeItem: async (id: string) => {
    await deleteMediaItem(id);
    set(state => ({ library: state.library.filter(i => i.id !== id) }));
  },

  clearLibrary: async () => {
    await clearLib();
    set({ library: [] });
  },

  setFilters: (filters) => {
    set(state => ({
      filters: typeof filters === 'function' ? filters(state.filters) : filters
    }));
  },

  setRestoring: (v) => set({ isRestoring: v }),

  importItems: async (items: MediaItem[], existingIds: Set<string>) => {
    let count = 0;
    for (const item of items) {
      if (!existingIds.has(item.id)) {
        await saveMediaItem(item);
        count++;
      }
    }
    await get().loadLibrary();
    return count;
  },

  getDisplayedLibrary: (view: string) => {
    const { library, filters } = get();
    let filtered = [...library];

    if (view === 'upcoming') {
      return filtered
        .filter(item =>
          item.trackingData.status === 'Planeado / Pendiente' ||
          (item.trackingData.status === 'En Pausa' && item.trackingData.scheduledReturnDate)
        )
        .sort((a, b) => {
          const dateA = a.trackingData.nextReleaseDate || a.trackingData.scheduledReturnDate || '9999';
          const dateB = b.trackingData.nextReleaseDate || b.trackingData.scheduledReturnDate || '9999';
          return dateA.localeCompare(dateB);
        });
    }

    if (filters.query) {
      const q = filters.query.toLowerCase();
      filtered = filtered.filter(i => i.aiData.title.toLowerCase().includes(q));
    }
    if (filters.type !== 'All') {
      filtered = filtered.filter(i => i.aiData.mediaType === filters.type);
    }
    if (filters.status !== 'All') {
      filtered = filtered.filter(i => i.trackingData.status === filters.status);
    }
    if (filters.rating !== 'All') {
      filtered = filtered.filter(i => i.trackingData.rating === filters.rating);
    }
    if (filters.genre !== 'All') {
      filtered = filtered.filter(i => (i.aiData.genres || []).some(g => g.toLowerCase() === filters.genre.toLowerCase()));
    }
    if (filters.onlyFavorites) {
      filtered = filtered.filter(i => i.trackingData.is_favorite);
    }

    return filtered.sort((a, b) => {
      if (filters.sortBy === 'title') return a.aiData.title.localeCompare(b.aiData.title);
      if (filters.sortBy === 'progress') {
        const progA = a.trackingData.totalEpisodesInSeason ? (a.trackingData.watchedEpisodes / a.trackingData.totalEpisodesInSeason) : 0;
        const progB = b.trackingData.totalEpisodesInSeason ? (b.trackingData.watchedEpisodes / b.trackingData.totalEpisodesInSeason) : 0;
        return progB - progA;
      }
      return (b.lastInteraction || b.createdAt) - (a.lastInteraction || a.createdAt);
    });
  },

  getAvailableGenres: () => {
    const { library } = get();
    return Array.from(new Set(library.flatMap(i => i.aiData.genres || []).map(g => g.toLowerCase())));
  },
}));
