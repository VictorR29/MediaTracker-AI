import { describe, it, expect, vi } from 'vitest';
import type {
  AniListAiringSnapshot,
  AniListData,
  AniListSequel,
  MediaItem,
} from '../../types';
import type { AiringDetails } from '../anilistService';
import { refreshStaleAiring } from '../anilistAutoRefresh';

// --- Fixtures -----------------------------------------------------------------

const NOW = 1_700_000_000_000;
const HOUR_MS = 60 * 60 * 1000;

const makeAiring = (fetchedAt: number): AniListAiringSnapshot => ({
  status: 'RELEASING',
  isAiring: true,
  nextEpisode: 3,
  nextAiringAt: NOW,
  totalEpisodes: 12,
  fetchedAt,
});

const makeAniList = (overrides: Partial<AniListData> & { id: number }): AniListData => ({
  matchedTitle: `AniList ${overrides.id}`,
  matchedBy: 'title',
  confidence: 'exact',
  resolvedAt: NOW,
  ...overrides,
});

interface ItemFixture {
  id: string;
  title: string;
  mediaType?: MediaItem['aiData']['mediaType'];
  status?: MediaItem['trackingData']['status'];
  anilist?: AniListData;
}

const makeItem = (fixture: ItemFixture): MediaItem => ({
  id: fixture.id,
  createdAt: 0,
  aiData: {
    title: fixture.title,
    mediaType: fixture.mediaType ?? 'Anime',
    synopsis: '',
    genres: [],
    status: '',
    totalContent: '',
    coverDescription: '',
    anilist: fixture.anilist,
  },
  trackingData: {
    status: fixture.status ?? 'Viendo/Leyendo',
    currentSeason: 1,
    totalSeasons: 1,
    watchedEpisodes: 0,
    totalEpisodesInSeason: 12,
    emotionalTags: [],
    favoriteCharacters: [],
    rating: '',
    comment: '',
  },
});

const makeDetails = (
  fetchedAt: number = NOW,
  sequel?: AniListSequel,
): AiringDetails => ({
  snapshot: makeAiring(fetchedAt),
  ...(sequel ? { sequel } : {}),
});

const makeFetcher = (result: Map<number, AiringDetails>) =>
  vi.fn(async (_ids: number[]): Promise<Map<number, AiringDetails>> => result);

// --- Tests --------------------------------------------------------------------

describe('refreshStaleAiring', () => {
  it('makes no request when nothing is linked', async () => {
    const items = [
      makeItem({ id: 'a', title: 'Unlinked', anilist: undefined }),
      makeItem({ id: 'b', title: 'Also unlinked', anilist: undefined }),
    ];
    const fetcher = makeFetcher(new Map());

    const result = await refreshStaleAiring({ items, now: NOW, fetchSnapshots: fetcher });

    expect(result.requestedIds).toEqual([]);
    expect(result.updated).toEqual([]);
    expect(result.failed).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('makes no request when every snapshot is fresh', async () => {
    const items = [
      makeItem({
        id: 'a',
        title: 'Fresh',
        anilist: makeAniList({ id: 1, airing: makeAiring(NOW - HOUR_MS) }),
      }),
      makeItem({
        id: 'b',
        title: 'Also fresh',
        anilist: makeAniList({ id: 2, airing: makeAiring(NOW - HOUR_MS) }),
      }),
    ];
    const fetcher = makeFetcher(new Map());

    const result = await refreshStaleAiring({ items, now: NOW, fetchSnapshots: fetcher });

    expect(result.requestedIds).toEqual([]);
    expect(result.updated).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requests only the stale id when stale and fresh items coexist', async () => {
    const items = [
      makeItem({
        id: 'stale',
        title: 'Stale',
        anilist: makeAniList({ id: 21, airing: makeAiring(NOW - 25 * HOUR_MS) }),
      }),
      makeItem({
        id: 'fresh',
        title: 'Fresh',
        anilist: makeAniList({ id: 16498, airing: makeAiring(NOW - 23 * HOUR_MS) }),
      }),
    ];
    const fetcher = makeFetcher(new Map([[21, makeDetails()]]));

    const result = await refreshStaleAiring({ items, now: NOW, fetchSnapshots: fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith([21]);
    expect(result.requestedIds).toEqual([21]);
    expect(result.updated.map(item => item.id)).toEqual(['stale']);
    expect(result.failed).toBe(false);
  });

  it('treats a linked item without a snapshot as stale', async () => {
    const items = [
      makeItem({ id: 'linked', title: 'Linked', anilist: makeAniList({ id: 7 }) }),
    ];
    const fetcher = makeFetcher(new Map([[7, makeDetails()]]));

    const result = await refreshStaleAiring({ items, now: NOW, fetchSnapshots: fetcher });

    expect(fetcher).toHaveBeenCalledWith([7]);
    expect(result.updated.map(item => item.id)).toEqual(['linked']);
    expect(result.updated[0].aiData.anilist?.airing?.fetchedAt).toBe(NOW);
  });

  it('excludes formats AniList does not cover, discarded and unlinked items', async () => {
    const staleAiring = makeAiring(NOW - 25 * HOUR_MS);
    const items = [
      makeItem({
        id: 'series',
        title: 'A series',
        mediaType: 'Serie',
        anilist: makeAniList({ id: 100, airing: staleAiring }),
      }),
      makeItem({
        id: 'dropped',
        title: 'Dropped anime',
        status: 'Descartado',
        anilist: makeAniList({ id: 200, airing: staleAiring }),
      }),
      makeItem({ id: 'unlinked', title: 'Unlinked anime', anilist: undefined }),
      makeItem({
        id: 'wanted',
        title: 'Wanted anime',
        anilist: makeAniList({ id: 300, airing: staleAiring }),
      }),
    ];
    const fetcher = makeFetcher(new Map([[300, makeDetails()]]));

    const result = await refreshStaleAiring({ items, now: NOW, fetchSnapshots: fetcher });

    expect(result.requestedIds).toEqual([300]);
    expect(fetcher).toHaveBeenCalledWith([300]);
    expect(result.updated.map(item => item.id)).toEqual(['wanted']);
  });

  it('treats a linked manhwa with a stale snapshot as a refresh candidate', async () => {
    const items = [
      makeItem({
        id: 'manhwa',
        title: 'Solo Leveling',
        mediaType: 'Manhwa',
        anilist: makeAniList({ id: 105398, airing: makeAiring(NOW - 25 * HOUR_MS) }),
      }),
    ];
    const fetcher = makeFetcher(new Map([[105398, makeDetails()]]));

    const result = await refreshStaleAiring({ items, now: NOW, fetchSnapshots: fetcher });

    expect(fetcher).toHaveBeenCalledWith([105398]);
    expect(result.requestedIds).toEqual([105398]);
    expect(result.updated.map(item => item.id)).toEqual(['manhwa']);
  });

  it('dedupes a shared AniList id and updates every item that carries it', async () => {
    const staleAiring = makeAiring(NOW - 25 * HOUR_MS);
    const items = [
      makeItem({
        id: 'first',
        title: 'First',
        anilist: makeAniList({ id: 21, airing: staleAiring }),
      }),
      makeItem({
        id: 'second',
        title: 'Second',
        anilist: makeAniList({ id: 21, airing: staleAiring }),
      }),
    ];
    const fetcher = makeFetcher(new Map([[21, makeDetails()]]));

    const result = await refreshStaleAiring({ items, now: NOW, fetchSnapshots: fetcher });

    expect(result.requestedIds).toEqual([21]);
    expect(fetcher).toHaveBeenCalledWith([21]);
    expect(result.updated.map(item => item.id)).toEqual(['first', 'second']);
    expect(result.updated.every(item => item.aiData.anilist?.airing?.fetchedAt === NOW)).toBe(true);
  });

  it('updates only the items covered by the returned map', async () => {
    const staleAiring = makeAiring(NOW - 25 * HOUR_MS);
    const items = [
      makeItem({
        id: 'covered',
        title: 'Covered',
        anilist: makeAniList({ id: 1, airing: staleAiring }),
      }),
      makeItem({
        id: 'missing',
        title: 'Missing',
        anilist: makeAniList({ id: 2, airing: staleAiring }),
      }),
    ];
    const fetcher = makeFetcher(new Map([[1, makeDetails()]]));

    const result = await refreshStaleAiring({ items, now: NOW, fetchSnapshots: fetcher });

    expect(result.requestedIds).toEqual([1, 2]);
    expect(result.updated.map(item => item.id)).toEqual(['covered']);
    expect(result.failed).toBe(false);
  });

  it('reports a rejection as a failure without throwing or updating', async () => {
    const items = [
      makeItem({
        id: 'stale',
        title: 'Stale',
        anilist: makeAniList({ id: 21, airing: makeAiring(NOW - 25 * HOUR_MS) }),
      }),
    ];
    const fetcher = vi.fn(async (_ids: number[]): Promise<Map<number, AiringDetails>> => {
      throw new Error('network down');
    });

    const result = await refreshStaleAiring({ items, now: NOW, fetchSnapshots: fetcher });

    expect(result.failed).toBe(true);
    expect(result.updated).toEqual([]);
    expect(result.requestedIds).toEqual([21]);
  });

  it('applies both the airing snapshot and the sequel', async () => {
    const items = [
      makeItem({
        id: 'stale',
        title: 'Stale',
        anilist: makeAniList({ id: 21, airing: makeAiring(NOW - 25 * HOUR_MS) }),
      }),
    ];
    const sequel: AniListSequel = {
      id: 999,
      season: 2,
      title: 'Sequel',
      status: 'NOT_YET_RELEASED',
      episodes: null,
      startDate: '2027-01',
    };
    const fetcher = makeFetcher(new Map([[21, makeDetails(NOW, sequel)]]));

    const result = await refreshStaleAiring({ items, now: NOW, fetchSnapshots: fetcher });

    const anilist = result.updated[0].aiData.anilist;
    expect(anilist?.airing).toMatchObject({ fetchedAt: NOW, nextEpisode: 3, isAiring: true });
    expect(anilist?.sequel).toEqual(sequel);
  });

  it('respects a custom maxAgeMs', async () => {
    const items = [
      makeItem({
        id: 'aged',
        title: 'Aged one second',
        anilist: makeAniList({ id: 1, airing: makeAiring(NOW - 1000) }),
      }),
      makeItem({
        id: 'boundary',
        title: 'Exactly at the boundary',
        anilist: makeAniList({ id: 2, airing: makeAiring(NOW - 500) }),
      }),
    ];
    const fetcher = makeFetcher(new Map([[1, makeDetails()]]));

    const result = await refreshStaleAiring({
      items,
      now: NOW,
      maxAgeMs: 500,
      fetchSnapshots: fetcher,
    });

    expect(result.requestedIds).toEqual([1]);
    expect(result.updated.map(item => item.id)).toEqual(['aged']);
  });

  it('preserves the input order in updated', async () => {
    const staleAiring = makeAiring(NOW - 25 * HOUR_MS);
    const items = [
      makeItem({
        id: 'b',
        title: 'B',
        anilist: makeAniList({ id: 2, airing: staleAiring }),
      }),
      makeItem({
        id: 'a',
        title: 'A',
        anilist: makeAniList({ id: 1, airing: staleAiring }),
      }),
    ];
    const fetcher = makeFetcher(
      new Map([
        [1, makeDetails()],
        [2, makeDetails()],
      ]),
    );

    const result = await refreshStaleAiring({ items, now: NOW, fetchSnapshots: fetcher });

    expect(result.requestedIds).toEqual([2, 1]);
    expect(result.updated.map(item => item.id)).toEqual(['b', 'a']);
  });

  it('exposes the raw batch so the caller can re-apply it over the live item', async () => {
    const snapshots = new Map([[7, makeDetails()]]);
    const items = [makeItem({ id: 'a', title: 'A', anilist: makeAniList({ id: 7, airing: makeAiring(0) }) })];

    const result = await refreshStaleAiring({
      items,
      now: NOW,
      fetchSnapshots: makeFetcher(snapshots),
    });

    // The caller must not write `updated` back wholesale: it was built from the
    // pre-request item and would clobber concurrent edits.
    expect(result.snapshots).toBe(snapshots);
    expect(result.snapshots.get(7)?.snapshot.nextEpisode).toBe(makeDetails().snapshot.nextEpisode);
  });

  it('returns an empty snapshot map when no request was needed', async () => {
    const result = await refreshStaleAiring({
      items: [makeItem({ id: 'a', title: 'A' })],
      now: NOW,
      fetchSnapshots: makeFetcher(new Map()),
    });

    expect(result.snapshots.size).toBe(0);
    expect(result.failed).toBe(false);
  });
});
