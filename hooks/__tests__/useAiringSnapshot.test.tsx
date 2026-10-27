import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { MediaItem } from '../../types';
import type { AiringDetails } from '../../services/anilistService';

// Keep the real pure selectors and only stub the network boundary, so the test
// exercises the real merge and the real snapshot application.
vi.mock('../../services/anilistService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/anilistService')>();
  return {
    ...actual,
    fetchAiringSnapshots: vi.fn(),
    resolveAniListMatch: vi.fn(),
    isAiringSnapshotFresh: vi.fn(() => false),
  };
});

import { fetchAiringSnapshots, isAiringSnapshotFresh } from '../../services/anilistService';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useAiringSnapshot } from '../useAiringSnapshot';

const mockedFetchAiringSnapshots = vi.mocked(fetchAiringSnapshots);
const mockedIsFresh = vi.mocked(isAiringSnapshotFresh);

const linkedItem: MediaItem = {
  id: 'anime-1',
  aiData: {
    title: 'Attack on Titan',
    mediaType: 'Anime',
    synopsis: '',
    genres: [],
    status: 'En emisión',
    totalContent: '1 Temporada',
    coverDescription: '',
    coverImage: '',
    sourceUrls: [],
    primaryColor: '#c084fc',
    anilist: {
      id: 21,
      matchedTitle: 'Attack on Titan',
      matchedBy: 'title',
      confidence: 'exact',
      resolvedAt: 5_000,
    },
  },
  trackingData: {
    status: 'Viendo/Leyendo',
    currentSeason: 1,
    totalSeasons: 1,
    watchedEpisodes: 11,
    totalEpisodesInSeason: 12,
    is_favorite: false,
    rating: '',
    emotionalTags: [],
    comment: '',
    customLinks: [],
    favoriteCharacters: [],
    recommendedBy: '',
  },
  createdAt: 1_000,
  lastInteraction: 2_000,
};

const snapshotFor = (): Map<number, AiringDetails> =>
  new Map([
    [
      21,
      {
        snapshot: {
          status: 'RELEASING',
          isAiring: true,
          nextEpisode: 12,
          nextAiringAt: 1_700_000_000,
          totalEpisodes: 12,
          fetchedAt: 9_000,
        },
      },
    ],
  ]);

describe('useAiringSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsFresh.mockReturnValue(false);
    useLibraryStore.setState({ library: [linkedItem] });
  });

  it('does not revert an episode watched while the request was in flight', async () => {
    let release: (value: Map<number, AiringDetails>) => void = () => {};
    mockedFetchAiringSnapshots.mockReturnValue(
      new Promise<Map<number, AiringDetails>>((resolve) => {
        release = resolve;
      }),
    );

    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useAiringSnapshot(linkedItem, { enabled: true, onUpdate }),
    );

    expect(result.current.state).toBe('loading');

    // The user taps "+" while AniList is still answering. The hook captured the
    // item at watchedEpisodes 11 before the request started.
    act(() => {
      const live = useLibraryStore.getState().library[0];
      useLibraryStore.setState({
        library: [{ ...live, trackingData: { ...live.trackingData, watchedEpisodes: 12 } }],
      });
    });

    await act(async () => {
      release(snapshotFor());
    });

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());

    const persisted = onUpdate.mock.calls[0][0] as MediaItem;
    expect(persisted.trackingData.watchedEpisodes).toBe(12);
    expect(persisted.aiData.anilist?.airing?.nextEpisode).toBe(12);
    expect(result.current.state).toBe('ready');
  });

  it('writes the item as-is when it is not in the library yet', async () => {
    useLibraryStore.setState({ library: [] });
    mockedFetchAiringSnapshots.mockResolvedValue(snapshotFor());

    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useAiringSnapshot(linkedItem, { enabled: true, onUpdate }),
    );

    await waitFor(() => expect(result.current.state).toBe('ready'));

    const persisted = onUpdate.mock.calls[0][0] as MediaItem;
    expect(persisted.id).toBe('anime-1');
    expect(persisted.aiData.anilist?.airing?.nextEpisode).toBe(12);
  });
});
