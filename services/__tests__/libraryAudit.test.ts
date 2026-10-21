import { describe, it, expect } from 'vitest';
import type { AIWorkData, MediaItem } from '../../types';
import { auditLibrary } from '../libraryAudit';

// --- Fixtures -----------------------------------------------------------------

interface ItemFixture {
  id: string;
  title?: unknown;
  anilistId?: number;
}

const makeItem = (fixture: ItemFixture): MediaItem => ({
  id: fixture.id,
  createdAt: 0,
  aiData: {
    title: (fixture.title ?? '') as string,
    mediaType: 'Anime',
    synopsis: '',
    genres: [],
    status: '',
    totalContent: '',
    coverDescription: '',
    anilist:
      fixture.anilistId === undefined
        ? undefined
        : {
            id: fixture.anilistId,
            matchedTitle: `AniList ${fixture.anilistId}`,
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
    favoriteCharacters: [],
    rating: '',
    comment: '',
  },
});

/** Builds an item whose `aiData.title` key is absent, not merely empty. */
const itemWithoutTitle = (id: string): MediaItem => {
  const base = makeItem({ id, title: 'placeholder' });
  const { title: _omitted, ...rest } = base.aiData;
  return { ...base, aiData: rest as AIWorkData };
};

const memberIds = (group: { items: MediaItem[] }): string[] => group.items.map(item => item.id);

// --- Tests --------------------------------------------------------------------

describe('auditLibrary', () => {
  it('reports nothing when the library has no duplicates', () => {
    const report = auditLibrary([
      makeItem({ id: 'a', title: 'Naruto' }),
      makeItem({ id: 'b', title: 'Bleach' }),
      makeItem({ id: 'c', title: 'One Piece', anilistId: 1 }),
      makeItem({ id: 'd', title: 'Monster', anilistId: 2 }),
    ]);

    expect(report.byAniListId).toEqual([]);
    expect(report.byTitle).toEqual([]);
  });

  it('groups two items sharing an AniList id', () => {
    const first = makeItem({ id: 'a', title: 'Monster', anilistId: 19 });
    const second = makeItem({ id: 'b', title: 'Monster (1997)', anilistId: 19 });

    const report = auditLibrary([first, second]);

    expect(report.byAniListId).toHaveLength(1);
    expect(report.byAniListId[0].reason).toBe('anilist-id');
    expect(report.byAniListId[0].key).toBe('19');
    expect(memberIds(report.byAniListId[0])).toEqual(['a', 'b']);
    expect(report.byTitle).toEqual([]);
  });

  it('groups titles that differ only by case and surrounding spaces', () => {
    const report = auditLibrary([
      makeItem({ id: 'a', title: 'Naruto' }),
      makeItem({ id: 'b', title: 'naruto ' }),
      makeItem({ id: 'c', title: 'NARUTO' }),
    ]);

    expect(report.byAniListId).toEqual([]);
    expect(report.byTitle).toHaveLength(1);
    expect(report.byTitle[0].reason).toBe('title');
    expect(report.byTitle[0].key).toBe('naruto');
    expect(memberIds(report.byTitle[0])).toEqual(['a', 'b', 'c']);
  });

  it('groups titles that differ only by accents and punctuation', () => {
    const report = auditLibrary([
      makeItem({ id: 'a', title: 'Boku no Hīrō Akademia' }),
      makeItem({ id: 'b', title: 'boku-no-hiro, akademia!' }),
      makeItem({ id: 'c', title: 'Boku no Hiro   Akademia' }),
    ]);

    expect(report.byTitle).toHaveLength(1);
    expect(report.byTitle[0].key).toBe('boku no hiro akademia');
    expect(memberIds(report.byTitle[0])).toEqual(['a', 'b', 'c']);
  });

  it('does not repeat an AniList-id pair under title', () => {
    const report = auditLibrary([
      makeItem({ id: 'a', title: 'Naruto', anilistId: 20 }),
      makeItem({ id: 'b', title: 'NARUTO', anilistId: 20 }),
    ]);

    expect(report.byAniListId).toHaveLength(1);
    expect(memberIds(report.byAniListId[0])).toEqual(['a', 'b']);
    expect(report.byTitle).toEqual([]);
  });

  it('drops a title group left with fewer than two members once linked items are removed', () => {
    const report = auditLibrary([
      makeItem({ id: 'a', title: 'Naruto', anilistId: 20 }),
      makeItem({ id: 'b', title: 'naruto', anilistId: 20 }),
      makeItem({ id: 'c', title: 'Naruto' }),
    ]);

    expect(report.byAniListId).toHaveLength(1);
    expect(memberIds(report.byAniListId[0])).toEqual(['a', 'b']);
    expect(report.byTitle).toEqual([]);
  });

  it('keeps a title group when two unlinked members remain', () => {
    const report = auditLibrary([
      makeItem({ id: 'a', title: 'Naruto', anilistId: 20 }),
      makeItem({ id: 'b', title: 'Naruto', anilistId: 20 }),
      makeItem({ id: 'c', title: 'Naruto' }),
      makeItem({ id: 'd', title: 'naruto ' }),
    ]);

    expect(report.byAniListId).toHaveLength(1);
    expect(report.byTitle).toHaveLength(1);
    expect(memberIds(report.byTitle[0])).toEqual(['c', 'd']);
  });

  it('groups three items sharing a title into a single group', () => {
    const report = auditLibrary([
      makeItem({ id: 'a', title: 'Steins;Gate' }),
      makeItem({ id: 'b', title: 'steins gate' }),
      makeItem({ id: 'c', title: 'Steins Gate!' }),
    ]);

    expect(report.byTitle).toHaveLength(1);
    expect(report.byTitle[0].items).toHaveLength(3);
    expect(memberIds(report.byTitle[0])).toEqual(['a', 'b', 'c']);
  });

  it('reports nothing for unlinked items with different titles', () => {
    const report = auditLibrary([
      makeItem({ id: 'a', title: 'Dune' }),
      makeItem({ id: 'b', title: 'Neuromancer' }),
      makeItem({ id: 'c', title: 'Snow Crash' }),
    ]);

    expect(report.byAniListId).toEqual([]);
    expect(report.byTitle).toEqual([]);
  });

  it('reports nothing when every key occurs only once', () => {
    const report = auditLibrary([
      makeItem({ id: 'a', title: 'Dune', anilistId: 1 }),
      makeItem({ id: 'b', title: 'Dune Messiah', anilistId: 2 }),
      makeItem({ id: 'c', title: 'Children of Dune', anilistId: 3 }),
    ]);

    expect(report.byAniListId).toEqual([]);
    expect(report.byTitle).toEqual([]);
  });

  it('ignores blank, whitespace-only, punctuation-only and non-string titles', () => {
    const report = auditLibrary([
      makeItem({ id: 'a', title: '' }),
      makeItem({ id: 'b', title: '   ' }),
      makeItem({ id: 'c', title: '!!!' }),
      itemWithoutTitle('d'),
      makeItem({ id: 'e', title: 42 }),
      makeItem({ id: 'f', title: null }),
    ]);

    expect(report.byAniListId).toEqual([]);
    expect(report.byTitle).toEqual([]);
  });

  it('is safe with empty and malformed input', () => {
    expect(auditLibrary([])).toEqual({ byAniListId: [], byTitle: [] });
    expect(auditLibrary(undefined as unknown as MediaItem[])).toEqual({
      byAniListId: [],
      byTitle: [],
    });
    expect(
      auditLibrary([undefined as unknown as MediaItem, null as unknown as MediaItem]),
    ).toEqual({ byAniListId: [], byTitle: [] });
  });

  it('ignores malformed AniList ids', () => {
    const report = auditLibrary([
      makeItem({ id: 'a', title: 'Monster' }),
      makeItem({ id: 'b', title: 'Monster' }),
      makeItem({ id: 'c', title: 'Monster', anilistId: NaN }),
    ]);

    expect(report.byAniListId).toEqual([]);
    expect(report.byTitle).toHaveLength(1);
    expect(memberIds(report.byTitle[0])).toEqual(['a', 'b', 'c']);
  });

  it('keeps members in library order', () => {
    const report = auditLibrary([
      makeItem({ id: 'z', title: 'Zeta', anilistId: 7 }),
      makeItem({ id: 'm', title: 'Alpha' }),
      makeItem({ id: 'a', title: 'Zeta', anilistId: 7 }),
      makeItem({ id: 'b', title: 'alpha' }),
      makeItem({ id: 'c', title: 'ALPHA!' }),
    ]);

    expect(memberIds(report.byAniListId[0])).toEqual(['z', 'a']);
    expect(memberIds(report.byTitle[0])).toEqual(['m', 'b', 'c']);
  });

  it('orders groups by descending size then ascending key', () => {
    const report = auditLibrary([
      makeItem({ id: 'g1', title: 'Gamma' }),
      makeItem({ id: 'g2', title: 'gamma' }),
      makeItem({ id: 'b1', title: 'Beta' }),
      makeItem({ id: 'b2', title: 'Beta' }),
      makeItem({ id: 'b3', title: 'BETA' }),
      makeItem({ id: 'a1', title: 'Alpha' }),
      makeItem({ id: 'a2', title: 'alpha' }),
    ]);

    expect(report.byTitle.map(group => group.key)).toEqual(['beta', 'alpha', 'gamma']);
    expect(report.byTitle.map(group => group.items.length)).toEqual([3, 2, 2]);
  });

  it('orders AniList-id groups by descending size then ascending key', () => {
    const report = auditLibrary([
      makeItem({ id: 'x1', title: 'First', anilistId: 30 }),
      makeItem({ id: 'x2', title: 'Second', anilistId: 30 }),
      makeItem({ id: 'y1', title: 'Third', anilistId: 5 }),
      makeItem({ id: 'y2', title: 'Fourth', anilistId: 5 }),
      makeItem({ id: 'y3', title: 'Fifth', anilistId: 5 }),
    ]);

    expect(report.byAniListId.map(group => group.key)).toEqual(['5', '30']);
    expect(report.byTitle).toEqual([]);
  });
});
