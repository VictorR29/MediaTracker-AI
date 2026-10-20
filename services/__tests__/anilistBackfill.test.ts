import { describe, it, expect, vi } from 'vitest';
import type { AniListAiringSnapshot, AniListData, MediaItem } from '../../types';
import { AniListError } from '../anilistService';
import type { AiringDetails } from '../anilistService';
import { runAniListBackfill } from '../anilistBackfill';
import type { BackfillDeps, BackfillSummary } from '../anilistBackfill';

// --- Fixtures -----------------------------------------------------------------

const AIRING_TTL_MS = 3 * 60 * 60 * 1000;

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

const makeAniList = (id: number, fetchedAt: number): AniListData => ({
  id,
  matchedTitle: `AniList ${id}`,
  matchedBy: 'title',
  confidence: 'exact',
  resolvedAt: fetchedAt,
  airing: {
    status: 'RELEASING',
    isAiring: true,
    nextEpisode: 5,
    nextAiringAt: 1_700_000_000,
    totalEpisodes: 12,
    fetchedAt,
  },
});

const makeSnapshot = (fetchedAt: number): AniListAiringSnapshot => ({
  status: 'FINISHED',
  isAiring: false,
  totalEpisodes: 24,
  fetchedAt,
});

const makeDetails = (id: number): AiringDetails => ({
  snapshot: makeSnapshot(Date.now()),
  sequel: {
    id: id + 1000,
    title: `Sequel of ${id}`,
    status: 'RELEASING',
    nextEpisode: 1,
  },
});

interface Harness {
  deps: BackfillDeps;
  persist: ReturnType<typeof vi.fn<(item: MediaItem) => Promise<void>>>;
  persistedItems: MediaItem[];
  progress: { summary: BackfillSummary; current?: string }[];
}

const createHarness = (overrides: Partial<BackfillDeps> = {}): Harness => {
  const persistedItems: MediaItem[] = [];
  const persist = vi.fn<(item: MediaItem) => Promise<void>>(async item => {
    persistedItems.push(item);
  });
  const progress: { summary: BackfillSummary; current?: string }[] = [];

  const deps: BackfillDeps = {
    resolve: vi.fn(async () => ({ status: 'not_found' as const })),
    fetchSnapshots: vi.fn(async () => new Map<number, AiringDetails>()),
    isFresh: () => false,
    ...overrides,
  };

  return { deps, persist, persistedItems, progress };
};

const run = (
  items: MediaItem[],
  harness: Harness,
  extra: Partial<Parameters<typeof runAniListBackfill>[0]> = {},
) =>
  runAniListBackfill({
    items,
    persist: harness.persist,
    deps: harness.deps,
    onProgress: (summary, current) => harness.progress.push({ summary, current }),
    now: () => 1_000_000_000,
    ...extra,
  });

// --- Tests --------------------------------------------------------------------

describe('runAniListBackfill', () => {
  it('ignores non-anime and dropped items when counting the candidates', async () => {
    const items = [
      makeItem({ id: 'anime', title: 'Anime' }),
      makeItem({ id: 'series', title: 'Series', mediaType: 'Serie' }),
      makeItem({ id: 'manga', title: 'Manga', mediaType: 'Manga' }),
      makeItem({ id: 'dropped', title: 'Dropped', status: 'Descartado' }),
    ];
    const harness = createHarness();

    const summary = await run(items, harness);

    expect(summary.total).toBe(1);
    expect(harness.deps.resolve).toHaveBeenCalledTimes(1);
    expect(harness.deps.resolve).toHaveBeenCalledWith(items[0]);
  });

  it('skips an item whose snapshot is still fresh without touching the service', async () => {
    const now = 1_000_000_000;
    const items = [
      makeItem({
        id: 'fresh',
        title: 'Fresh',
        anilist: makeAniList(42, now - AIRING_TTL_MS / 2),
      }),
    ];
    const harness = createHarness({ isFresh: snapshot => !!snapshot && snapshot.fetchedAt > 0 });

    const summary = await run(items, harness);

    expect(summary).toMatchObject({ total: 1, done: 1, skipped: 1, matched: 0 });
    expect(harness.deps.fetchSnapshots).not.toHaveBeenCalled();
    expect(harness.deps.resolve).not.toHaveBeenCalled();
    expect(harness.persist).not.toHaveBeenCalled();
  });

  it('refreshes every stale link with a single batch request', async () => {
    const items = [
      makeItem({ id: 'a', title: 'A', anilist: makeAniList(10, 0) }),
      makeItem({ id: 'b', title: 'B', anilist: makeAniList(20, 0) }),
      makeItem({ id: 'c', title: 'C', anilist: makeAniList(30, 0) }),
    ];
    const snapshots = new Map<number, AiringDetails>([
      [10, makeDetails(10)],
      [20, makeDetails(20)],
      [30, makeDetails(30)],
    ]);
    const harness = createHarness({ fetchSnapshots: vi.fn(async () => snapshots) });

    const summary = await run(items, harness);

    expect(harness.deps.fetchSnapshots).toHaveBeenCalledTimes(1);
    expect(harness.deps.fetchSnapshots).toHaveBeenCalledWith([10, 20, 30]);
    expect(summary).toMatchObject({ total: 3, done: 3, matched: 3, skipped: 0, failed: 0 });
    expect(harness.persist).toHaveBeenCalledTimes(3);
    expect(harness.persistedItems.every(item => !!item.aiData.anilist?.airing)).toBe(true);
    expect(harness.persistedItems[0].aiData.anilist?.airing?.isAiring).toBe(false);
    expect(harness.persistedItems[0].aiData.anilist?.sequel?.id).toBe(1010);
  });

  it('persists an unlinked match before requesting its snapshot batch', async () => {
    const item = makeItem({ id: 'one', title: 'One Piece' });
    const match: AniListData = {
      id: 21,
      matchedTitle: 'ONE PIECE',
      matchedBy: 'title',
      confidence: 'exact',
      resolvedAt: Date.now(),
    };
    const snapshots = new Map<number, AiringDetails>([[21, makeDetails(21)]]);
    const resolve = vi.fn(async () => ({ status: 'matched' as const, match }));
    const fetchSnapshots = vi.fn(async () => snapshots);
    const harness = createHarness({ resolve, fetchSnapshots });

    const summary = await run([item], harness);

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(fetchSnapshots).toHaveBeenCalledTimes(1);
    expect(fetchSnapshots).toHaveBeenCalledWith([21]);
    expect(summary).toMatchObject({ total: 1, done: 1, matched: 1, unmatched: 0, failed: 0 });

    expect(harness.persist).toHaveBeenCalledTimes(2);
    const identity = harness.persistedItems[0];
    const withSnapshot = harness.persistedItems[1];
    expect(identity.aiData.anilist?.id).toBe(21);
    expect(identity.aiData.anilist?.airing).toBeUndefined();
    expect(withSnapshot.aiData.anilist?.id).toBe(21);
    expect(withSnapshot.aiData.anilist?.airing?.status).toBe('FINISHED');
  });

  it('counts not_found and ambiguous results as unmatched without persisting', async () => {
    const items = [
      makeItem({ id: 'missing', title: 'Missing' }),
      makeItem({ id: 'ambiguous', title: 'Ambiguous' }),
    ];
    const resolve = vi
      .fn()
      .mockResolvedValueOnce({ status: 'not_found' })
      .mockResolvedValueOnce({ status: 'ambiguous', candidates: [] });
    const harness = createHarness({ resolve });

    const summary = await run(items, harness);

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({ total: 2, done: 2, matched: 0, unmatched: 2, failed: 0 });
    expect(harness.persist).not.toHaveBeenCalled();
    expect(harness.deps.fetchSnapshots).not.toHaveBeenCalled();
  });

  it('keeps going after a non-rate-limit failure', async () => {
    const items = [
      makeItem({ id: 'broken', title: 'Broken' }),
      makeItem({ id: 'works', title: 'Works' }),
    ];
    const match: AniListData = {
      id: 77,
      matchedTitle: 'Works',
      matchedBy: 'title',
      confidence: 'high',
      resolvedAt: Date.now(),
    };
    const resolve = vi
      .fn()
      .mockRejectedValueOnce(new AniListError('network', 'offline'))
      .mockResolvedValueOnce({ status: 'matched', match });
    const harness = createHarness({
      resolve,
      fetchSnapshots: vi.fn(async () => new Map<number, AiringDetails>([[77, makeDetails(77)]])),
    });

    const summary = await run(items, harness);

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({ total: 2, done: 2, matched: 1, failed: 1, aborted: false });
    expect(summary.abortReason).toBeUndefined();
    expect(harness.persist).toHaveBeenCalledTimes(2);
  });

  it('aborts after three consecutive failures', async () => {
    const items = [
      makeItem({ id: 'a', title: 'A' }),
      makeItem({ id: 'b', title: 'B' }),
      makeItem({ id: 'c', title: 'C' }),
      makeItem({ id: 'd', title: 'D' }),
    ];
    const resolve = vi.fn(async () => {
      throw new AniListError('http', 'server error', 500);
    });
    const harness = createHarness({ resolve });

    const summary = await run(items, harness);

    expect(resolve).toHaveBeenCalledTimes(3);
    expect(summary).toMatchObject({
      total: 4,
      failed: 3,
      aborted: true,
      abortReason: 'too_many_failures',
    });
    expect(harness.persist).not.toHaveBeenCalled();
  });

  it('stops when shouldStop turns true', async () => {
    const items = [
      makeItem({ id: 'a', title: 'A' }),
      makeItem({ id: 'b', title: 'B' }),
      makeItem({ id: 'c', title: 'C' }),
    ];
    const harness = createHarness();
    let calls = 0;

    const summary = await run(items, harness, {
      shouldStop: () => {
        calls += 1;
        return calls > 1;
      },
    });

    expect(harness.deps.resolve).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ total: 3, done: 1, aborted: true, abortReason: 'cancelled' });
  });

  it('aborts without further work when AniList rate limits phase 2', async () => {
    const items = [makeItem({ id: 'a', title: 'A' })];
    const resolve = vi.fn(async () => {
      throw new AniListError('rate_limit', 'slow down', 429);
    });
    const harness = createHarness({ resolve });

    const summary = await run(items, harness);

    expect(summary).toMatchObject({ total: 1, done: 0, failed: 0, aborted: true });
    expect(summary.abortReason).toBe('rate_limit');
    expect(harness.persist).not.toHaveBeenCalled();
  });

  it('reports progress with a constant total and non-decreasing done', async () => {
    const items = [
      makeItem({ id: 'fresh', title: 'Fresh', anilist: makeAniList(1, 1) }),
      makeItem({ id: 'stale', title: 'Stale', anilist: makeAniList(2, 0) }),
      makeItem({ id: 'unlinked', title: 'Unlinked' }),
    ];
    const snapshots = new Map<number, AiringDetails>([
      [2, makeDetails(2)],
      [3, makeDetails(3)],
    ]);
    const resolve = vi.fn(async () => ({
      status: 'matched' as const,
      match: {
        id: 3,
        matchedTitle: 'Unlinked',
        matchedBy: 'title' as const,
        confidence: 'exact' as const,
        resolvedAt: Date.now(),
      },
    }));
    const harness = createHarness({
      isFresh: snapshot => snapshot?.fetchedAt === 1,
      fetchSnapshots: vi.fn(async () => snapshots),
      resolve,
    });

    const summary = await run(items, harness);

    expect(harness.progress.length).toBeGreaterThan(0);
    expect(harness.progress[0].summary.done).toBe(0);
    expect(harness.progress[0].summary.total).toBe(3);

    const dones = harness.progress.map(entry => entry.summary.done);
    expect(dones).toEqual([...dones].sort((a, b) => a - b));
    expect(harness.progress.every(entry => entry.summary.total === 3)).toBe(true);
    expect(dones[dones.length - 1]).toBe(summary.done);
  });

  it('counts a link AniList no longer returns as failed instead of fresh', async () => {
    const items = [makeItem({ id: 'gone', title: 'Gone', anilist: makeAniList(99, 0) })];
    const harness = createHarness({ fetchSnapshots: vi.fn(async () => new Map()) });

    const summary = await run(items, harness);

    expect(summary).toMatchObject({ total: 1, done: 1, matched: 0, failed: 1 });
    expect(harness.persist).not.toHaveBeenCalled();
  });

  it('never writes back a stale item deleted while the run was in flight', async () => {
    const items = [makeItem({ id: 'stale', title: 'Stale', anilist: makeAniList(2, 0) })];
    const harness = createHarness({
      fetchSnapshots: vi.fn(async () => new Map([[2, makeDetails(2)]])),
    });

    const summary = await run(items, harness, { read: () => undefined });

    expect(harness.persist).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ done: 1, matched: 0, failed: 0 });
  });

  it('skips an item that was linked manually after the capture', async () => {
    const items = [makeItem({ id: 'a', title: 'A' })];
    const harness = createHarness();

    const summary = await run(items, harness, {
      read: () => makeItem({ id: 'a', title: 'A', anilist: makeAniList(55, 0) }),
    });

    expect(harness.deps.resolve).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ total: 1, done: 1, matched: 0, unmatched: 0, failed: 0 });
  });

  it('keeps the run alive when a single write fails', async () => {
    const items = [
      makeItem({ id: 'a', title: 'A' }),
      makeItem({ id: 'b', title: 'B' }),
    ];
    const resolve = vi.fn(async (item: MediaItem) => ({
      status: 'matched' as const,
      match: {
        id: item.aiData.title === 'A' ? 10 : 20,
        matchedTitle: item.aiData.title,
        matchedBy: 'title' as const,
        confidence: 'exact' as const,
        resolvedAt: 0,
      },
    }));
    const fetchSnapshots = vi.fn(async (ids: number[]) =>
      new Map(ids.map(id => [id, makeDetails(id)] as const)),
    );
    const persist = vi.fn(async (item: MediaItem) => {
      if (item.aiData.title === 'A') throw new Error('quota exceeded');
    });
    const harness = createHarness({ resolve, fetchSnapshots });

    const summary = await run(items, harness, { persist });

    expect(summary).toMatchObject({ total: 2, done: 2, matched: 1, failed: 1, aborted: false });
    // Only the write that succeeded reaches the batch phase.
    expect(fetchSnapshots).toHaveBeenCalledTimes(1);
    expect(fetchSnapshots).toHaveBeenCalledWith([20]);
  });

  it('respects a manual re-link made before the snapshot batch landed', async () => {
    const items = [makeItem({ id: 'a', title: 'A' })];
    const resolve = vi.fn(async () => ({
      status: 'matched' as const,
      match: {
        id: 21,
        matchedTitle: 'A',
        matchedBy: 'title' as const,
        confidence: 'exact' as const,
        resolvedAt: 0,
      },
    }));
    const fetchSnapshots = vi.fn(async () => new Map([[21, makeDetails(21)]]));
    const harness = createHarness({ resolve, fetchSnapshots });

    let identityPersisted = false;
    const summary = await run(items, harness, {
      persist: async item => {
        identityPersisted = true;
        harness.persistedItems.push(item);
      },
      // Phase 2 sees no link; phase 3 sees the link the user just made.
      read: () =>
        identityPersisted
          ? makeItem({ id: 'a', title: 'A', anilist: makeAniList(55, 0) })
          : items[0],
    });

    expect(summary.matched).toBe(1);
    expect(harness.persistedItems).toHaveLength(1);
    expect(harness.persistedItems[0].aiData.anilist?.id).toBe(21);
  });
});
