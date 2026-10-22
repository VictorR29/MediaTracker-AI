import { describe, it, expect, vi } from 'vitest';
import type { MediaItem } from '../../types';
import type { AniListCharacter } from '../anilistService';
import {
  matchCharacterImages,
  runCharacterImageBackfill,
} from '../characterImageBackfill';

// --- Fixtures -----------------------------------------------------------------

interface ItemFixture {
  id: string;
  title: string;
  mediaId?: number;
  mediaType?: MediaItem['aiData']['mediaType'];
  characters?: { name: string; image?: string }[];
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
    anilist:
      fixture.mediaId === undefined
        ? undefined
        : {
            id: fixture.mediaId,
            matchedTitle: fixture.title,
            matchedBy: 'title',
            confidence: 'exact',
            resolvedAt: 0,
          },
  },
  trackingData: {
    status: 'Viendo/Leyendo',
    currentSeason: 1,
    totalSeasons: 1,
    watchedEpisodes: 0,
    totalEpisodesInSeason: 12,
    emotionalTags: [],
    favoriteCharacters: fixture.characters ?? [],
    rating: '',
    comment: '',
  },
});

const character = (id: number, name: string, image?: string): AniListCharacter => ({
  id,
  name,
  image,
});

interface RunHarness {
  fetchCharacters: ReturnType<typeof vi.fn<(mediaId: number) => Promise<AniListCharacter[]>>>;
  persist: ReturnType<typeof vi.fn<(item: MediaItem) => Promise<void>>>;
  persisted: MediaItem[];
  progress: { summary: Awaited<ReturnType<typeof runCharacterImageBackfill>>; current?: string }[];
}

const createHarness = (
  cast: Record<number, AniListCharacter[]>,
  fetchCharacters?: RunHarness['fetchCharacters'],
): RunHarness => {
  const persisted: MediaItem[] = [];
  const progress: RunHarness['progress'] = [];

  return {
    fetchCharacters: fetchCharacters ?? vi.fn(async (mediaId: number) => cast[mediaId] ?? []),
    persist: vi.fn(async (item: MediaItem) => {
      persisted.push(item);
    }),
    persisted,
    progress,
  };
};

const run = (
  items: MediaItem[],
  harness: RunHarness,
  extra: Partial<Parameters<typeof runCharacterImageBackfill>[0]> = {},
) =>
  runCharacterImageBackfill({
    items,
    fetchCharacters: harness.fetchCharacters,
    persist: harness.persist,
    onProgress: (summary, current) => harness.progress.push({ summary, current }),
    ...extra,
  });

// --- Matching -----------------------------------------------------------------

describe('matchCharacterImages', () => {
  it('fills an exact match without touching the typed name', () => {
    const characters = [{ name: 'Levi' }];

    const report = matchCharacterImages(characters, [character(1, 'Levi', 'levi.jpg')]);

    expect(report.filled).toBe(1);
    expect(report.ambiguous).toBe(0);
    expect(report.notFound).toBe(0);
    expect(report.characters).toEqual([{ name: 'Levi', image: 'levi.jpg' }]);
    expect(report.characters[0].name).toBe('Levi');
  });

  it('matches containment when the typed name is contained in the candidate', () => {
    const report = matchCharacterImages([{ name: 'Eren' }], [character(1, 'Eren Yeager', 'eren.jpg')]);

    expect(report.filled).toBe(1);
    expect(report.characters[0]).toEqual({ name: 'Eren', image: 'eren.jpg' });
  });

  it('matches containment when the candidate is contained in the typed name', () => {
    const report = matchCharacterImages(
      [{ name: 'Levi Ackerman' }],
      [character(1, 'Levi', 'levi.jpg')],
    );

    expect(report.filled).toBe(1);
    expect(report.characters[0]).toEqual({ name: 'Levi Ackerman', image: 'levi.jpg' });
  });

  it('ignores case and diacritics', () => {
    const report = matchCharacterImages(
      [{ name: 'Mïkasa' }],
      [character(1, 'Mikasa Ackerman', 'mikasa.jpg')],
    );

    expect(report.filled).toBe(1);
    expect(report.characters[0]).toEqual({ name: 'Mïkasa', image: 'mikasa.jpg' });
  });

  it('flags an ambiguous first name and leaves it untouched', () => {
    const report = matchCharacterImages(
      [{ name: 'Eren' }],
      [character(1, 'Eren Yeager', 'eren.jpg'), character(2, 'Eren Kruger', 'kruger.jpg')],
    );

    expect(report.filled).toBe(0);
    expect(report.ambiguous).toBe(1);
    expect(report.notFound).toBe(0);
    expect(report.characters[0]).toEqual({ name: 'Eren' });
  });

  it('dedupes the same candidate id before deciding', () => {
    const report = matchCharacterImages(
      [{ name: 'Eren' }],
      [character(1, 'Eren Yeager', 'eren.jpg'), character(1, 'Eren Yeager', 'eren.jpg')],
    );

    expect(report.filled).toBe(1);
    expect(report.ambiguous).toBe(0);
  });

  it('never replaces an existing image and never counts it', () => {
    const report = matchCharacterImages(
      [{ name: 'Levi', image: 'local.jpg' }],
      [character(1, 'Levi', 'remote.jpg')],
    );

    expect(report.filled).toBe(0);
    expect(report.ambiguous).toBe(0);
    expect(report.notFound).toBe(0);
    expect(report.characters[0]).toEqual({ name: 'Levi', image: 'local.jpg' });
  });

  it('reports notFound when the only match has no image', () => {
    const report = matchCharacterImages([{ name: 'Levi' }], [character(1, 'Levi')]);

    expect(report.filled).toBe(0);
    expect(report.notFound).toBe(1);
    expect(report.characters[0]).toEqual({ name: 'Levi' });
  });

  it('requires an exact match for names shorter than three characters', () => {
    // "Al" is contained in "Alphonse Elric", but two letters are too little to guess.
    const containment = matchCharacterImages(
      [{ name: 'Al' }],
      [character(1, 'Alphonse Elric', 'alphonse.jpg')],
    );

    expect(containment.filled).toBe(0);
    expect(containment.notFound).toBe(1);
    expect(containment.characters[0]).toEqual({ name: 'Al' });

    const exact = matchCharacterImages([{ name: 'Al' }], [character(2, 'Al', 'al.jpg')]);

    expect(exact.filled).toBe(1);
    expect(exact.characters[0]).toEqual({ name: 'Al', image: 'al.jpg' });
  });

  it('reports every entry as notFound when there are no candidates', () => {
    const report = matchCharacterImages([{ name: 'Levi' }, { name: 'Eren' }], []);

    expect(report.filled).toBe(0);
    expect(report.ambiguous).toBe(0);
    expect(report.notFound).toBe(2);
  });

  it('never mutates the inputs and keeps the order', () => {
    const characters = [{ name: 'Levi' }, { name: 'Mikasa' }];
    const candidates = [character(1, 'Mikasa', 'mikasa.jpg')];

    const report = matchCharacterImages(characters, candidates);

    expect(characters).toEqual([{ name: 'Levi' }, { name: 'Mikasa' }]);
    expect(candidates).toEqual([character(1, 'Mikasa', 'mikasa.jpg')]);
    expect(report.characters.map(entry => entry.name)).toEqual(['Levi', 'Mikasa']);
    expect(report.characters[0]).not.toBe(characters[0]);
  });
});

// --- Run ----------------------------------------------------------------------

describe('runCharacterImageBackfill', () => {
  it('returns immediately and calls no fetcher when no work qualifies', async () => {
    const items = [
      makeItem({ id: 'nothing-missing', title: 'Complete', mediaId: 1, characters: [{ name: 'Levi', image: 'x.jpg' }] }),
      makeItem({ id: 'unlinked', title: 'Unlinked', characters: [{ name: 'Levi' }] }),
      makeItem({ id: 'series', title: 'Series', mediaId: 2, mediaType: 'Serie', characters: [{ name: 'Levi' }] }),
      makeItem({ id: 'no-characters', title: 'Empty', mediaId: 3 }),
    ];
    const harness = createHarness({ 1: [character(1, 'Levi', 'levi.jpg')] });

    const summary = await run(items, harness);

    expect(summary).toMatchObject({
      worksConsidered: 0,
      requests: 0,
      filled: 0,
      ambiguous: 0,
      notFound: 0,
      failed: 0,
      cancelled: false,
    });
    expect(harness.fetchCharacters).not.toHaveBeenCalled();
    expect(harness.persist).not.toHaveBeenCalled();
    expect(harness.progress).toHaveLength(0);
  });

  it('persists only the works that gained at least one image', async () => {
    const changed = makeItem({ id: 'changed', title: 'Changed', mediaId: 10, characters: [{ name: 'Levi' }] });
    const unchanged = makeItem({ id: 'unchanged', title: 'Unchanged', mediaId: 20, characters: [{ name: 'Nobody' }] });
    const harness = createHarness({
      10: [character(1, 'Levi', 'levi.jpg')],
      20: [character(2, 'Someone Else', 'else.jpg')],
    });

    const summary = await run([changed, unchanged], harness);

    expect(harness.fetchCharacters).toHaveBeenCalledTimes(2);
    expect(harness.persist).toHaveBeenCalledTimes(1);
    expect(harness.persisted[0].id).toBe('changed');
    expect(harness.persisted[0].trackingData.favoriteCharacters).toEqual([
      { name: 'Levi', image: 'levi.jpg' },
    ]);
    expect(summary).toMatchObject({ worksConsidered: 2, requests: 2, filled: 1, notFound: 1 });
  });

  it('writes the live item so an edit made during the run survives', async () => {
    const stale = makeItem({ id: 'a', title: 'A', mediaId: 99, characters: [{ name: 'Levi' }] });
    const library = new Map<string, MediaItem>([['a', stale]]);

    const fetchCharacters = vi.fn(async () => {
      // The user edits the same work while the request is in flight.
      const edited = library.get('a')!;
      library.set('a', {
        ...edited,
        trackingData: {
          ...edited.trackingData,
          comment: 'edited during the run',
          favoriteCharacters: [
            ...edited.trackingData.favoriteCharacters,
            { name: 'Erwin', image: 'erwin-local.jpg' },
          ],
        },
      });
      return [character(1, 'Levi', 'levi.jpg'), character(2, 'Erwin', 'erwin-remote.jpg')];
    });
    const harness = createHarness({}, fetchCharacters);

    const summary = await run([stale], harness, { read: id => library.get(id) });

    expect(summary.filled).toBe(1);
    expect(harness.persist).toHaveBeenCalledTimes(1);
    const saved = harness.persisted[0];
    expect(saved.trackingData.comment).toBe('edited during the run');
    expect(saved.trackingData.favoriteCharacters).toEqual([
      { name: 'Levi', image: 'levi.jpg' },
      // The photo the user added meanwhile is untouchable.
      { name: 'Erwin', image: 'erwin-local.jpg' },
    ]);
  });

  it('never resurrects a work deleted mid-run', async () => {
    const stale = makeItem({ id: 'gone', title: 'Gone', mediaId: 7, characters: [{ name: 'Levi' }] });
    const library = new Map<string, MediaItem>([['gone', stale]]);

    const fetchCharacters = vi.fn(async () => {
      library.delete('gone');
      return [character(1, 'Levi', 'levi.jpg')];
    });
    const harness = createHarness({}, fetchCharacters);

    const summary = await run([stale], harness, { read: id => library.get(id) });

    expect(harness.persist).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ worksConsidered: 1, requests: 1, filled: 0, failed: 0 });
  });

  it('counts a single fetch failure and keeps going', async () => {
    const broken = makeItem({ id: 'broken', title: 'Broken', mediaId: 30, characters: [{ name: 'Levi' }] });
    const works = makeItem({ id: 'works', title: 'Works', mediaId: 40, characters: [{ name: 'Mikasa' }] });
    const fetchCharacters = vi
      .fn<(mediaId: number) => Promise<AniListCharacter[]>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([character(1, 'Mikasa', 'mikasa.jpg')]);
    const harness = createHarness({}, fetchCharacters);

    const summary = await run([broken, works], harness);

    expect(fetchCharacters).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({
      worksConsidered: 2,
      requests: 2,
      filled: 1,
      failed: 1,
      cancelled: false,
    });
    expect(harness.persisted).toHaveLength(1);
    expect(harness.persisted[0].id).toBe('works');
  });

  it('stops after the current work and reports the cancellation', async () => {
    const items = [
      makeItem({ id: 'a', title: 'A', mediaId: 1, characters: [{ name: 'Levi' }] }),
      makeItem({ id: 'b', title: 'B', mediaId: 2, characters: [{ name: 'Mikasa' }] }),
      makeItem({ id: 'c', title: 'C', mediaId: 3, characters: [{ name: 'Armin' }] }),
    ];
    let stopRequested = false;
    const fetchCharacters = vi.fn(async (mediaId: number) => {
      // The user hits Cancel while the first request is in flight.
      if (mediaId === 1) stopRequested = true;
      return [character(mediaId, mediaId === 1 ? 'Levi' : 'Other', `img-${mediaId}.jpg`)];
    });
    const harness = createHarness({}, fetchCharacters);

    const summary = await run(items, harness, { shouldStop: () => stopRequested });

    expect(fetchCharacters).toHaveBeenCalledTimes(1);
    expect(harness.persist).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({
      worksConsidered: 3,
      requests: 1,
      filled: 1,
      cancelled: true,
    });
    expect(harness.progress[harness.progress.length - 1].current).toBe('A');
  });

  it('reports counters that add up to the characters that needed an image', async () => {
    const item = makeItem({
      id: 'mixed',
      title: 'Mixed',
      mediaId: 50,
      characters: [
        { name: 'Levi' },
        { name: 'Eren' },
        { name: 'Mikasa', image: 'already.jpg' },
        { name: 'Nobody' },
      ],
    });
    const harness = createHarness({
      50: [
        character(1, 'Levi', 'levi.jpg'),
        character(2, 'Eren Yeager', 'eren.jpg'),
        character(3, 'Eren Kruger', 'kruger.jpg'),
        character(4, 'Mikasa', 'mikasa.jpg'),
      ],
    });

    const summary = await run([item], harness);

    expect(summary).toMatchObject({ filled: 1, ambiguous: 1, notFound: 1, failed: 0 });
    expect(summary.filled + summary.ambiguous + summary.notFound).toBe(3);
    expect(harness.persisted[0].trackingData.favoriteCharacters).toEqual([
      { name: 'Levi', image: 'levi.jpg' },
      { name: 'Eren' },
      { name: 'Mikasa', image: 'already.jpg' },
      { name: 'Nobody' },
    ]);
  });

  it('reports progress with the work title as current', async () => {
    const items = [
      makeItem({ id: 'a', title: 'Alpha', mediaId: 60, characters: [{ name: 'Levi' }] }),
      makeItem({ id: 'b', title: 'Beta', mediaId: 61, characters: [{ name: 'Mikasa' }] }),
    ];
    const harness = createHarness({
      60: [character(1, 'Levi', 'levi.jpg')],
      61: [character(2, 'Mikasa', 'mikasa.jpg')],
    });

    await run(items, harness);

    const currents = harness.progress.map(entry => entry.current).filter(Boolean);
    expect(currents).toEqual(['Alpha', 'Beta']);
    expect(harness.progress[0].summary.worksConsidered).toBe(2);
  });
});
