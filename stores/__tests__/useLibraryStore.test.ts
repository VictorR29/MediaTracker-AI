import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/storage', () => ({
  getLibrary: vi.fn(),
  saveMediaItem: vi.fn(),
  deleteMediaItem: vi.fn(),
  clearLibrary: vi.fn(),
}));

import { useLibraryStore } from '../useLibraryStore';
import { getLibrary } from '../../services/storage';
import { MediaItem } from '../../types';

const mockedGetLibrary = vi.mocked(getLibrary);

const mockItem: MediaItem = {
  id: 'test-1',
  aiData: { title: 'Test Anime', mediaType: 'Anime', synopsis: '', genres: ['Acción'], status: 'Finalizado', totalContent: '', coverDescription: '', coverImage: '', sourceUrls: [], primaryColor: '#c084fc' },
  trackingData: { status: 'Completado', currentSeason: 1, totalSeasons: 1, watchedEpisodes: 12, totalEpisodesInSeason: 12, is_favorite: false, rating: 'Obra Maestra', emotionalTags: [], comment: '', customLinks: [], favoriteCharacters: [], recommendedBy: '' },
  createdAt: 1000,
  lastInteraction: 2000,
};

const mockTropeItem: MediaItem = {
  ...mockItem,
  id: 'test-trope',
  aiData: {
    ...mockItem.aiData,
    title: 'Trope Anime',
    genres: ['Isekai'],
    anilist: {
      id: 21,
      matchedTitle: 'Trope Anime',
      matchedBy: 'manual',
      confidence: 'manual',
      resolvedAt: 1000,
      genres: [],
      tags: [{ name: 'Isekai' }, { name: 'Time Loop' }],
    },
  },
};

describe('useLibraryStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    useLibraryStore.setState({ library: [], loadError: null, filters: { query: '', type: 'All', status: 'All', rating: 'All', genre: 'All', trope: 'All', sortBy: 'updated', onlyFavorites: false } });
  });

  it('starts with empty library', () => {
    expect(useLibraryStore.getState().library).toEqual([]);
    expect(useLibraryStore.getState().loadError).toBeNull();
  });

  it('loadLibrary stores the items and clears loadError', async () => {
    mockedGetLibrary.mockResolvedValue([mockItem]);

    await useLibraryStore.getState().loadLibrary();

    expect(useLibraryStore.getState().library).toEqual([mockItem]);
    expect(useLibraryStore.getState().loadError).toBeNull();
  });

  it('loadLibrary catches an IndexedDB rejection and records loadError', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedGetLibrary.mockRejectedValue(new Error('QuotaExceededError'));

    // Must not reject: the failure is part of the store contract, not the caller's.
    await expect(useLibraryStore.getState().loadLibrary()).resolves.toBeUndefined();

    const state = useLibraryStore.getState();
    expect(state.library).toEqual([]);
    expect(state.loadError).toMatch(/no se pudo cargar tu biblioteca/i);
  });

  it('loadLibrary clears a previous loadError once the load succeeds', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedGetLibrary.mockRejectedValueOnce(new Error('storage denied'));
    await useLibraryStore.getState().loadLibrary();
    expect(useLibraryStore.getState().loadError).not.toBeNull();

    mockedGetLibrary.mockResolvedValueOnce([mockItem]);
    await useLibraryStore.getState().loadLibrary();

    expect(useLibraryStore.getState().loadError).toBeNull();
    expect(useLibraryStore.getState().library).toEqual([mockItem]);
  });

  it('setFilters updates filters', () => {
    useLibraryStore.getState().setFilters(prev => ({ ...prev, query: 'test' }));
    expect(useLibraryStore.getState().filters.query).toBe('test');
  });

  it('setFilters with function updater', () => {
    useLibraryStore.getState().setFilters(prev => ({ ...prev, type: 'Anime' }));
    expect(useLibraryStore.getState().filters.type).toBe('Anime');
  });

  it('getDisplayedLibrary filters by type', () => {
    useLibraryStore.setState({ library: [mockItem], filters: { query: '', type: 'Anime', status: 'All', rating: 'All', genre: 'All', trope: 'All', sortBy: 'updated', onlyFavorites: false } });
    const displayed = useLibraryStore.getState().getDisplayedLibrary('library');
    expect(displayed).toHaveLength(1);
  });

  it('getDisplayedLibrary excludes non-matching type', () => {
    useLibraryStore.setState({ library: [mockItem], filters: { query: '', type: 'Manga', status: 'All', rating: 'All', genre: 'All', trope: 'All', sortBy: 'updated', onlyFavorites: false } });
    const displayed = useLibraryStore.getState().getDisplayedLibrary('library');
    expect(displayed).toHaveLength(0);
  });

  it('getDisplayedLibrary filters by favorites', () => {
    const favItem = { ...mockItem, id: 'fav-1', trackingData: { ...mockItem.trackingData, is_favorite: true } };
    useLibraryStore.setState({ library: [mockItem, favItem], filters: { query: '', type: 'All', status: 'All', rating: 'All', genre: 'All', trope: 'All', sortBy: 'updated', onlyFavorites: true } });
    const displayed = useLibraryStore.getState().getDisplayedLibrary('library');
    expect(displayed).toHaveLength(1);
    expect(displayed[0].id).toBe('fav-1');
  });

  it('getAvailableGenres returns unique genres', () => {
    useLibraryStore.setState({ library: [mockItem] });
    const genres = useLibraryStore.getState().getAvailableGenres();
    expect(genres).toContain('acción');
  });

  it('getAvailableGenres no longer includes a trope name', () => {
    useLibraryStore.setState({ library: [mockItem, mockTropeItem] });
    const genres = useLibraryStore.getState().getAvailableGenres();

    expect(genres).toContain('acción');
    expect(genres).not.toContain('isekai');
    expect(genres).not.toContain('bucle temporal');
  });

  it('getAvailableTropes returns the trope labels present in the library', () => {
    useLibraryStore.setState({ library: [mockItem, mockTropeItem] });
    const tropes = useLibraryStore.getState().getAvailableTropes();

    expect(tropes).toEqual(expect.arrayContaining(['isekai', 'bucle temporal']));
    expect(tropes).toHaveLength(2);
  });

  it('getDisplayedLibrary filters by trope', () => {
    useLibraryStore.setState({
      library: [mockItem, mockTropeItem],
      filters: { query: '', type: 'All', status: 'All', rating: 'All', genre: 'All', trope: 'isekai', sortBy: 'updated', onlyFavorites: false },
    });

    const displayed = useLibraryStore.getState().getDisplayedLibrary('library');

    expect(displayed).toHaveLength(1);
    expect(displayed[0].id).toBe('test-trope');
  });

  it('getDisplayedLibrary genre filter ignores trope values', () => {
    useLibraryStore.setState({
      library: [mockItem, mockTropeItem],
      filters: { query: '', type: 'All', status: 'All', rating: 'All', genre: 'isekai', trope: 'All', sortBy: 'updated', onlyFavorites: false },
    });

    expect(useLibraryStore.getState().getDisplayedLibrary('library')).toHaveLength(0);
  });
});
