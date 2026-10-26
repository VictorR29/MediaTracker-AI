import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('../../services/storage', () => ({
  saveMediaItem: vi.fn(),
  deleteMediaItem: vi.fn(),
  saveUserProfile: vi.fn(),
  getLibrary: vi.fn(),
  getUserProfile: vi.fn(),
  clearLibrary: vi.fn(),
  initDB: vi.fn(),
  closeDB: vi.fn(),
}));

import { useDataHandlers } from '../useDataHandlers';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { saveMediaItem, deleteMediaItem, getLibrary, clearLibrary } from '../../services/storage';
import { MediaItem, UserProfile } from '../../types';

const mockedSaveMediaItem = vi.mocked(saveMediaItem);
const mockedDeleteMediaItem = vi.mocked(deleteMediaItem);
const mockedGetLibrary = vi.mocked(getLibrary);
const mockedClearLibrary = vi.mocked(clearLibrary);

const mockProfile: UserProfile = { username: 'Vikthor', password: 'abc123:def456', accentColor: '#c084fc', apiKey: '' };

const previousItem: MediaItem = {
  id: 'previous-1',
  aiData: { title: 'Previous', mediaType: 'Anime', synopsis: '', genres: [], status: 'Finalizado', totalContent: '', coverDescription: '', coverImage: '', sourceUrls: [], primaryColor: '#c084fc' },
  trackingData: { status: 'Completado', currentSeason: 1, totalSeasons: 1, watchedEpisodes: 1, totalEpisodesInSeason: 1, is_favorite: false, rating: '', emotionalTags: [], comment: '', customLinks: [], favoriteCharacters: [], recommendedBy: '' },
  createdAt: 1000,
  lastInteraction: 2000,
};

const backupItem: MediaItem = {
  ...previousItem,
  id: 'backup-1',
  aiData: { ...previousItem.aiData, title: 'From backup' },
  createdAt: 3000,
};

const backupFile = (library: unknown[]): File =>
  new File(
    [JSON.stringify({ profile: mockProfile, library, version: 1 })],
    'mediatracker_backup.json',
    { type: 'application/json' },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  useLibraryStore.setState({ library: [previousItem], loadError: null });
  mockedGetLibrary.mockResolvedValue([previousItem]);
  mockedSaveMediaItem.mockResolvedValue(undefined);
  mockedDeleteMediaItem.mockResolvedValue(undefined);
});

describe('useDataHandlers — backup import', () => {
  it('leaves the previous library intact when a write fails mid-restore', async () => {
    mockedSaveMediaItem.mockRejectedValue(new Error('QuotaExceededError'));

    const { result } = renderHook(() => useDataHandlers());

    await act(async () => {
      await result.current.handleImportBackup(backupFile([backupItem]));
    });

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('Tu biblioteca anterior sigue intacta'),
        'error',
      ),
    );

    // The old library was never cleared, so it is still exactly what it was.
    expect(useLibraryStore.getState().library).toEqual([previousItem]);
    expect(mockedClearLibrary).not.toHaveBeenCalled();
    expect(mockedDeleteMediaItem).not.toHaveBeenCalledWith(previousItem.id);
  });

  it('prunes against the database, not the store cache', async () => {
    // Simulate a failed load: the store is empty while IndexedDB still has data.
    useLibraryStore.setState({ library: [], loadError: 'storage blocked' });
    mockedGetLibrary.mockResolvedValue([previousItem]);

    const { result } = renderHook(() => useDataHandlers());

    await act(async () => {
      await result.current.handleImportBackup(backupFile([backupItem]));
    });

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Restaurada 1 obra', 'success'));

    // The prune source is the database, so the replaced item is still removed
    // even though the store cache was empty.
    expect(mockedDeleteMediaItem).toHaveBeenCalledWith(previousItem.id);
  });

  it('aborts without writing when the current library cannot be read', async () => {
    mockedGetLibrary.mockRejectedValue(new Error('storage blocked'));

    const { result } = renderHook(() => useDataHandlers());

    await act(async () => {
      await result.current.handleImportBackup(backupFile([backupItem]));
    });

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('La restauración se canceló'),
        'error',
      ),
    );

    expect(mockedSaveMediaItem).not.toHaveBeenCalled();
    expect(mockedClearLibrary).not.toHaveBeenCalled();
    expect(useLibraryStore.getState().library).toEqual([previousItem]);
  });

  it('restores the valid items and reports how many were skipped', async () => {
    const { result } = renderHook(() => useDataHandlers());

    await act(async () => {
      await result.current.handleImportBackup(backupFile([backupItem, { id: 'junk' }]));
    });

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Restaurada 1 obra (1 omitida)', 'success'),
    );

    expect(mockedSaveMediaItem).toHaveBeenCalledWith(backupItem);
    // The item the backup replaced is pruned only after every write succeeded.
    expect(mockedDeleteMediaItem).toHaveBeenCalledWith(previousItem.id);
  });

  it('rejects an unsupported backup version without touching storage', async () => {
    const file = new File(
      [JSON.stringify({ profile: mockProfile, library: [backupItem], version: 2 })],
      'future_backup.json',
      { type: 'application/json' },
    );

    const { result } = renderHook(() => useDataHandlers());

    await act(async () => {
      await result.current.handleImportBackup(file);
    });

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Formato de archivo no reconocido'), 'error'),
    );

    expect(mockedSaveMediaItem).not.toHaveBeenCalled();
    expect(mockedClearLibrary).not.toHaveBeenCalled();
    expect(useLibraryStore.getState().library).toEqual([previousItem]);
  });
});
