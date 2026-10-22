import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ANILIST_GENRES,
  __clearDiscoveryCacheForTests,
  fetchDiscoveryDeck,
} from '../anilistDiscovery';
import type { DiscoveryRequest } from '../anilistDiscovery';
import {
  AniListError,
  __resetThrottleForTests,
  __setThrottleForTests,
} from '../anilistService';

// --- Fixtures -----------------------------------------------------------------

interface MediaFixture {
  id: number;
  romaji?: string | null;
  english?: string | null;
  coverImage?: { large?: string | null; color?: string | null } | null;
  genres?: string[];
  format?: string;
  episodes?: number | null;
  status?: string;
  seasonYear?: number;
  description?: string | null;
  popularity?: number;
  isAdult?: boolean;
}

const media = (fixture: MediaFixture) => ({
  id: fixture.id,
  title: {
    romaji: fixture.romaji ?? null,
    english: fixture.english ?? null,
  },
  coverImage:
    fixture.coverImage === undefined
      ? { large: `https://img.example/${fixture.id}.jpg`, color: '#123456' }
      : fixture.coverImage,
  genres: fixture.genres ?? [],
  format: fixture.format ?? 'TV',
  episodes: fixture.episodes === undefined ? 12 : fixture.episodes,
  status: fixture.status ?? 'FINISHED',
  seasonYear: fixture.seasonYear ?? 2013,
  description: fixture.description ?? '',
  popularity: fixture.popularity ?? 0,
  isAdult: fixture.isAdult ?? false,
});

type MediaNode = ReturnType<typeof media>;

interface RecommendationFixture {
  rating: number;
  media: MediaNode;
}

const seed = (fixture: MediaFixture, recommendations: RecommendationFixture[]) => ({
  ...media(fixture),
  recommendations: {
    nodes: recommendations.map(recommendation => ({
      rating: recommendation.rating,
      mediaRecommendation: recommendation.media,
    })),
  },
});

const seedPayload = (seeds: unknown[]) => ({ Page: { media: seeds } });
const genrePayload = (nodes: unknown[]) => ({ Page: { media: nodes } });

const jsonResponse = (data: unknown): Response =>
  ({ ok: true, status: 200, json: async () => ({ data }) }) as unknown as Response;

const errorResponse = (status: number): Response =>
  ({ ok: false, status, json: async () => ({}) }) as unknown as Response;

const makeRequest = (overrides: Partial<DiscoveryRequest> = {}): DiscoveryRequest => ({
  seeds: [],
  fallbackGenres: [],
  excludeAniListIds: [],
  excludeTitles: [],
  ...overrides,
});

/** Seed pools that leave fewer than 12 usable cards trigger the genre pool too. */
const respondSeedThenGenre = (seedResponse: unknown, genreResponse: unknown = genrePayload([])) => {
  fetchMock.mockResolvedValueOnce(jsonResponse(seedResponse)).mockResolvedValueOnce(jsonResponse(genreResponse));
};

const requestBody = (callIndex = 0): { query: string; variables: Record<string, unknown> } => {
  const init = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  // Discovery reuses the shared AniList queue; tests must not wait 2s per call.
  __setThrottleForTests(0);
  __clearDiscoveryCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  __resetThrottleForTests();
});

// --- Aggregation --------------------------------------------------------------

describe('fetchDiscoveryDeck aggregation', () => {
  it('sums votes across seeds and credits every seed that recommended the candidate', async () => {
    respondSeedThenGenre(
      seedPayload([
        seed({ id: 16498, romaji: 'Shingeki no Kyojin', english: 'Attack on Titan' }, [
          { rating: 3639, media: media({ id: 11061, romaji: 'HUNTER×HUNTER (2011)', english: 'Hunter x Hunter (2011)' }) },
          { rating: 100, media: media({ id: 20, romaji: 'NARUTO', english: 'Naruto' }) },
        ]),
        seed({ id: 21, romaji: 'ONE PIECE', english: 'ONE PIECE' }, [
          { rating: 2201, media: media({ id: 11061, romaji: 'HUNTER×HUNTER (2011)', english: 'Hunter x Hunter (2011)' }) },
        ]),
      ]),
    );

    const deck = await fetchDiscoveryDeck(
      makeRequest({
        seeds: [
          { anilistId: 16498, title: 'Attack on Titan' },
          { anilistId: 21, title: 'One Piece' },
        ],
      }),
    );

    const shared = deck.find(candidate => candidate.anilistId === 11061);
    expect(shared).toBeDefined();
    expect(shared?.votes).toBe(5840);
    expect(shared?.recommendedBy).toEqual(['Attack on Titan', 'ONE PIECE']);
    expect(deck[0].anilistId).toBe(11061);
  });

  it('dedupes candidates by id and keeps a single card', async () => {
    respondSeedThenGenre(
      seedPayload([
        seed({ id: 1, romaji: 'Seed One', english: 'Seed One' }, [
          { rating: 100, media: media({ id: 500, romaji: 'Shared', english: 'Shared' }) },
          { rating: 50, media: media({ id: 500, romaji: 'Shared', english: 'Shared' }) },
        ]),
        seed({ id: 2, romaji: 'Seed Two', english: 'Seed Two' }, [
          { rating: 25, media: media({ id: 500, romaji: 'Shared', english: 'Shared' }) },
        ]),
      ]),
    );

    const deck = await fetchDiscoveryDeck(
      makeRequest({
        seeds: [
          { anilistId: 1, title: 'Seed One' },
          { anilistId: 2, title: 'Seed Two' },
        ],
      }),
    );

    const shared = deck.filter(candidate => candidate.anilistId === 500);
    expect(shared).toHaveLength(1);
    expect(shared[0].votes).toBe(175);
    // The seed that recommended it twice is only credited once.
    expect(shared[0].recommendedBy).toEqual(['Seed One', 'Seed Two']);
  });

  it('drops duplicate seed ids before querying', async () => {
    respondSeedThenGenre(seedPayload([]));

    await fetchDiscoveryDeck(
      makeRequest({
        seeds: [
          { anilistId: 16498, title: 'Attack on Titan' },
          { anilistId: 16498, title: 'Duplicate' },
        ],
      }),
    );

    expect(requestBody(0).variables.seedIds).toEqual([16498]);
    expect(requestBody(0).variables.perSeed).toBe(1);
  });
});

// --- Titles / synopsis --------------------------------------------------------

describe('fetchDiscoveryDeck presentation fields', () => {
  it('prefers english over romaji and exposes the other title only when it differs', async () => {
    respondSeedThenGenre(
      seedPayload([
        seed({ id: 1, romaji: 'Seed', english: 'Seed' }, [
          { rating: 10, media: media({ id: 10, romaji: 'Shingeki no Kyojin', english: 'Attack on Titan' }) },
          { rating: 9, media: media({ id: 11, romaji: 'Kimetsu no Yaiba', english: null }) },
          { rating: 8, media: media({ id: 12, romaji: 'Naruto', english: 'Naruto' }) },
        ]),
      ]),
    );

    const deck = await fetchDiscoveryDeck(makeRequest({ seeds: [{ anilistId: 1, title: 'Seed' }] }));

    expect(deck.find(candidate => candidate.anilistId === 10)?.title).toBe('Attack on Titan');
    expect(deck.find(candidate => candidate.anilistId === 10)?.alternateTitle).toBe('Shingeki no Kyojin');
    expect(deck.find(candidate => candidate.anilistId === 11)?.title).toBe('Kimetsu no Yaiba');
    expect(deck.find(candidate => candidate.anilistId === 11)?.alternateTitle).toBeUndefined();
    expect(deck.find(candidate => candidate.anilistId === 12)?.alternateTitle).toBeUndefined();
  });

  it('strips HTML, decodes entities, cuts the source credit and caps the synopsis', async () => {
    respondSeedThenGenre(
      seedPayload([
        seed({ id: 1, romaji: 'Seed', english: 'Seed' }, [
          {
            rating: 10,
            media: media({
              id: 10,
              romaji: 'Title',
              english: 'Title',
              description:
                'Great <i>show</i>.<br>Second line.<br/>Third &amp; fourth &quot;quoted&quot; &#039;single&#039; &lt;3 &nbsp; end. (Source: Crunchyroll)',
            }),
          },
          {
            rating: 9,
            media: media({
              id: 11,
              romaji: 'Long',
              english: 'Long',
              description: `${'word '.repeat(300)}(Source: AniList)`,
            }),
          },
        ]),
      ]),
    );

    const deck = await fetchDiscoveryDeck(makeRequest({ seeds: [{ anilistId: 1, title: 'Seed' }] }));

    const synopsis = deck.find(candidate => candidate.anilistId === 10)?.synopsis ?? '';
    expect(synopsis).toBe('Great show . Second line. Third & fourth "quoted" \'single\' <3 end.');
    expect(synopsis).not.toMatch(/<\/?[a-z][^>]*>/i);
    expect(synopsis).not.toContain('Source:');
    expect(synopsis).not.toContain('Crunchyroll');

    const longSynopsis = deck.find(candidate => candidate.anilistId === 11)?.synopsis ?? '';
    expect(longSynopsis.length).toBeLessThanOrEqual(700);
    expect(longSynopsis.length).toBeGreaterThan(690);
  });
});

// --- Exclusions ---------------------------------------------------------------

describe('fetchDiscoveryDeck exclusions', () => {
  it('excludes library ids, normalized titles, adult entries and blank titles', async () => {
    respondSeedThenGenre(
      seedPayload([
        seed({ id: 1, romaji: 'Seed', english: 'Seed' }, [
          { rating: 10, media: media({ id: 100, romaji: 'Owned', english: 'Owned' }) },
          { rating: 9, media: media({ id: 101, romaji: 'Boku no Hero Academia', english: 'Mi Héroe: Academia' }) },
          { rating: 8, media: media({ id: 102, romaji: 'Adult Thing', english: 'Adult Thing', isAdult: true }) },
          { rating: 7, media: media({ id: 103, romaji: '', english: '  ' }) },
          { rating: 6, media: media({ id: 104, romaji: 'Vinland Saga', english: 'Vinland Saga' }) },
        ]),
      ]),
    );

    const deck = await fetchDiscoveryDeck(
      makeRequest({
        seeds: [{ anilistId: 1, title: 'Seed' }],
        excludeAniListIds: [100],
        excludeTitles: ['mi heroe academia'],
      }),
    );

    expect(deck.map(candidate => candidate.anilistId)).toEqual([104]);
  });
});

// --- Ordering -----------------------------------------------------------------

describe('fetchDiscoveryDeck ordering', () => {
  it('orders by mood match, then recommendation count, then votes', async () => {
    respondSeedThenGenre(
      seedPayload([
        seed({ id: 1, romaji: 'Seed One', english: 'Seed One' }, [
          { rating: 5, media: media({ id: 1, romaji: 'Mood Pick', english: 'Mood Pick', genres: ['Action'], popularity: 1 }) },
          { rating: 100, media: media({ id: 2, romaji: 'Two Backers', english: 'Two Backers', genres: ['Drama'] }) },
          { rating: 10, media: media({ id: 3, romaji: 'Few Votes', english: 'Few Votes', genres: ['Drama'] }) },
        ]),
        seed({ id: 2, romaji: 'Seed Two', english: 'Seed Two' }, [
          { rating: 50, media: media({ id: 2, romaji: 'Two Backers', english: 'Two Backers', genres: ['Drama'] }) },
          { rating: 900, media: media({ id: 4, romaji: 'Many Votes', english: 'Many Votes', genres: ['Drama'] }) },
        ]),
      ]),
    );

    const deck = await fetchDiscoveryDeck(
      makeRequest({
        seeds: [
          { anilistId: 1, title: 'Seed One' },
          { anilistId: 2, title: 'Seed Two' },
        ],
        moodGenres: ['Action'],
      }),
    );

    expect(deck.map(candidate => candidate.title)).toEqual([
      'Mood Pick',
      'Two Backers',
      'Many Votes',
      'Few Votes',
    ]);
  });
});

// --- Genre fallback -----------------------------------------------------------

describe('fetchDiscoveryDeck genre pool', () => {
  it('falls back to the genre pool when there are no seeds', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(genrePayload([media({ id: 10, romaji: 'Action Show', english: 'Action Show', popularity: 500 })])),
    );

    const deck = await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'] }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestBody(0).variables.genres).toEqual(['Action']);
    expect(deck).toHaveLength(1);
    expect(deck[0]).toMatchObject({ anilistId: 10, votes: 0, recommendedBy: [], popularity: 500 });
  });

  it('merges the genre pool into a thin seed pool without duplicating ids', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          seedPayload([
            seed({ id: 1, romaji: 'Seed', english: 'Seed' }, [
              { rating: 100, media: media({ id: 5, romaji: 'Seed Pick', english: 'Seed Pick' }) },
            ]),
          ]),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          genrePayload([
            media({ id: 5, romaji: 'Seed Pick', english: 'Seed Pick', popularity: 9 }),
            media({ id: 6, romaji: 'Genre Pick', english: 'Genre Pick', popularity: 9 }),
          ]),
        ),
      );

    const deck = await fetchDiscoveryDeck(
      makeRequest({
        seeds: [{ anilistId: 1, title: 'Seed' }],
        fallbackGenres: ['Action'],
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(deck).toHaveLength(2);
    expect(deck.filter(candidate => candidate.anilistId === 5)).toHaveLength(1);

    const seedPick = deck.find(candidate => candidate.anilistId === 5);
    expect(seedPick).toMatchObject({ votes: 100, recommendedBy: ['Seed'] });

    const genrePick = deck.find(candidate => candidate.anilistId === 6);
    expect(genrePick).toMatchObject({ votes: 0, recommendedBy: [] });
  });

  it('fetches the genre pool when exclusions leave the seed pool thin', async () => {
    // Fourteen seed picks, thirteen of them already in the library.
    const recommendations = Array.from({ length: 14 }, (_, index) => ({
      rating: 100 - index,
      media: media({ id: 100 + index, romaji: `Pick ${index}`, english: `Pick ${index}` }),
    }));

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(seedPayload([seed({ id: 1, romaji: 'Seed', english: 'Seed' }, recommendations)])),
      )
      .mockResolvedValueOnce(
        jsonResponse(genrePayload([media({ id: 900, romaji: 'Fresh', english: 'Fresh', popularity: 50 })])),
      );

    const excluded = Array.from({ length: 13 }, (_, index) => 100 + index);
    const deck = await fetchDiscoveryDeck(
      makeRequest({
        seeds: [{ anilistId: 1, title: 'Seed' }],
        fallbackGenres: ['Action'],
        excludeAniListIds: excluded,
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(deck.map(candidate => candidate.anilistId)).toEqual([113, 900]);
  });

  it('does not fetch the genre pool when enough seed candidates survive', async () => {
    const recommendations = Array.from({ length: 12 }, (_, index) => ({
      rating: 10,
      media: media({ id: 200 + index, romaji: `Pick ${index}`, english: `Pick ${index}` }),
    }));

    fetchMock.mockResolvedValueOnce(
      jsonResponse(seedPayload([seed({ id: 1, romaji: 'Seed', english: 'Seed' }, recommendations)])),
    );

    const deck = await fetchDiscoveryDeck(
      makeRequest({ seeds: [{ anilistId: 1, title: 'Seed' }], fallbackGenres: ['Action'] }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(deck).toHaveLength(12);
  });

  it('drops invalid genres before querying', async () => {
    fetchMock.mockResolvedValue(jsonResponse(genrePayload([])));

    await fetchDiscoveryDeck(
      makeRequest({ fallbackGenres: ['Action', 'Not A Genre', 'action', 'Sci-Fi', '   '] }),
    );

    const genres = requestBody(0).variables.genres as string[];
    expect(genres).toEqual(['Action', 'Sci-Fi']);
    expect(genres.every(genre => ANILIST_GENRES.includes(genre))).toBe(true);
  });

  it('omits genre_in entirely when there are no usable genres', async () => {
    fetchMock.mockResolvedValue(jsonResponse(genrePayload([])));

    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: [] }));

    const body = requestBody(0);
    expect(body.query).not.toContain('genre_in');
    expect(body.variables).not.toHaveProperty('genres');
    expect(body.query).toContain('format_not: MUSIC');
    expect(body.query).toContain('isAdult: false');
  });
});

// --- Cache / transport --------------------------------------------------------

describe('fetchDiscoveryDeck cache and errors', () => {
  it('issues no request on a second identical call', async () => {
    fetchMock.mockResolvedValue(jsonResponse(genrePayload([media({ id: 10, romaji: 'Show', english: 'Show' })])));

    const request = makeRequest({ fallbackGenres: ['Action'], moodGenres: ['Action'] });
    const first = await fetchDiscoveryDeck(request);
    const second = await fetchDiscoveryDeck(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('propagates AniListError instead of swallowing a transport failure', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500));

    await expect(fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'] }))).rejects.toBeInstanceOf(
      AniListError,
    );
  });
});
