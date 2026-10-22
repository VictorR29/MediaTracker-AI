import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { curateCandidatesMock } = vi.hoisted(() => ({ curateCandidatesMock: vi.fn() }));

vi.mock('../discoveryCuration', () => ({ curateCandidates: curateCandidatesMock }));

import {
  ANILIST_GENRES,
  __clearDiscoveryCacheForTests,
  fetchDiscoveryDeck,
} from '../anilistDiscovery';
import type { DiscoveryCandidate, DiscoveryRequest } from '../anilistDiscovery';
import { curateCandidates } from '../discoveryCuration';
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
  tags?: { name: string; rank: number }[];
  format?: string;
  episodes?: number | null;
  status?: string;
  seasonYear?: number | null;
  startDate?: { year?: number | null } | null;
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
  tags: fixture.tags ?? [],
  format: fixture.format ?? 'TV',
  episodes: fixture.episodes === undefined ? 12 : fixture.episodes,
  status: fixture.status ?? 'FINISHED',
  seasonYear: fixture.seasonYear === undefined ? 2013 : fixture.seasonYear,
  startDate:
    fixture.startDate === undefined
      ? { year: fixture.seasonYear === undefined ? 2013 : fixture.seasonYear }
      : fixture.startDate,
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
  // Curation is opt-in and mocked: no test here may reach Gemini.
  vi.mocked(curateCandidates).mockReset();
  vi.mocked(curateCandidates).mockResolvedValue(null);
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

// --- Paging -------------------------------------------------------------------

describe('fetchDiscoveryDeck paging', () => {
  it('sends page 1 by default and the requested page afterwards', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(genrePayload([media({ id: 10, romaji: 'First', english: 'First' })])))
      .mockResolvedValueOnce(jsonResponse(genrePayload([media({ id: 11, romaji: 'Second', english: 'Second' })])));

    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'] }));
    expect(requestBody(0).variables.page).toBe(1);

    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], page: 2 }));
    expect(requestBody(1).variables.page).toBe(2);
  });

  it('does not re-harvest seed recommendations on later pages', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(genrePayload([media({ id: 20, romaji: 'Deep Cut', english: 'Deep Cut' })])),
    );

    const deck = await fetchDiscoveryDeck(
      makeRequest({ seeds: [{ anilistId: 1, title: 'Seed' }], fallbackGenres: ['Action'], page: 2 }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestBody(0).query).not.toContain('recommendations');
    expect(deck.map(candidate => candidate.anilistId)).toEqual([20]);
  });

  it('keeps one cache entry per page', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(genrePayload([media({ id: 30, romaji: 'Page One', english: 'Page One' })])))
      .mockResolvedValueOnce(jsonResponse(genrePayload([media({ id: 31, romaji: 'Page Two', english: 'Page Two' })])));

    const first = await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'] }));
    const second = await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], page: 2 }));
    const firstAgain = await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'] }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first[0].anilistId).toBe(30);
    expect(second[0].anilistId).toBe(31);
    expect(firstAgain[0].anilistId).toBe(30);
  });
});

// --- Catalog filters: year and franchise collapse ------------------------------

describe('fetchDiscoveryDeck catalog filters', () => {
  const relationsPayload = (nodes: unknown[]) => ({ Page: { media: nodes } });

  it('drops a candidate older than minYear and keeps a newer one', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        genrePayload([
          media({ id: 200, romaji: 'Old Show', english: 'Old Show', popularity: 10, seasonYear: 2005 }),
          media({ id: 201, romaji: 'New Show', english: 'New Show', popularity: 20, seasonYear: 2015 }),
        ]),
      ),
    );

    const deck = await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], minYear: 2010 }));

    expect(deck.map(candidate => candidate.anilistId)).toEqual([201]);
  });

  it('uses startDate.year when seasonYear is null, so old movies are still dropped', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        genrePayload([
          media({
            id: 300,
            romaji: 'Old Movie',
            english: 'Old Movie',
            format: 'MOVIE',
            seasonYear: null,
            startDate: { year: 1998 },
          }),
          media({
            id: 301,
            romaji: 'New Movie',
            english: 'New Movie',
            format: 'MOVIE',
            seasonYear: null,
            startDate: { year: 2019 },
          }),
        ]),
      ),
    );

    const deck = await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], minYear: 2000 }));

    expect(deck.map(candidate => candidate.anilistId)).toEqual([301]);
    // The fallback also feeds the card meta line.
    expect(deck[0].seasonYear).toBe(2019);
  });

  it('keeps a candidate with no year at all', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        genrePayload([
          media({ id: 400, romaji: 'Undated', english: 'Undated', seasonYear: null, startDate: null }),
        ]),
      ),
    );

    const deck = await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], minYear: 2010 }));

    expect(deck.map(candidate => candidate.anilistId)).toEqual([400]);
    expect(deck[0].seasonYear).toBeUndefined();
  });

  it('adds startDate_greater and the previous year last day to the genre pool query', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(genrePayload([])));

    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], minYear: 2000 }));

    const body = requestBody(0);
    expect(body.variables.minDate).toBe(19991231);
    expect(body.query).toContain('startDate_greater');
    expect(body.query).toContain('$minDate: FuzzyDateInt');
  });

  it('collapses later seasons by dropping entries with a series prequel', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          genrePayload([
            media({ id: 100, romaji: 'Later Season', english: 'Later Season' }),
            media({ id: 101, romaji: 'First Entry', english: 'First Entry' }),
            media({ id: 102, romaji: 'Movie With Prequel Movie', english: 'Movie With Prequel Movie' }),
          ]),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          relationsPayload([
            { id: 100, relations: { edges: [{ relationType: 'PREQUEL', node: { id: 90, format: 'TV' } }] } },
            { id: 101, relations: { edges: [] } },
            { id: 102, relations: { edges: [{ relationType: 'PREQUEL', node: { id: 91, format: 'MOVIE' } }] } },
          ]),
        ),
      );

    const deck = await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], collapseSeasons: true }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBody(1).variables.ids).toEqual([100, 101, 102]);
    expect(deck.map(candidate => candidate.anilistId)).toEqual([101, 102]);
  });

  it('keeps every candidate when the relations request fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          genrePayload([
            media({ id: 100, romaji: 'Later Season', english: 'Later Season' }),
            media({ id: 101, romaji: 'First Entry', english: 'First Entry' }),
          ]),
        ),
      )
      .mockResolvedValueOnce(errorResponse(500));

    const deck = await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], collapseSeasons: true }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(deck.map(candidate => candidate.anilistId)).toEqual([100, 101]);
  });

  it('issues no relations request when collapseSeasons is false or omitted', async () => {
    fetchMock.mockResolvedValue(jsonResponse(genrePayload([media({ id: 100, romaji: 'Show', english: 'Show' })])));

    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'] }));
    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], collapseSeasons: false }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestBody(0).query).not.toContain('relations');
  });

  it('caches minYear and collapseSeasons separately', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(genrePayload([media({ id: 100, romaji: 'Show', english: 'Show', seasonYear: 2015 })])),
    );

    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], minYear: 2000 }));
    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], minYear: 2010 }));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // collapseSeasons: false shares the cache key of the omitted form.
    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], minYear: 2000, collapseSeasons: false }));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // A different collapseSeasons value misses the cache: genre pool + relations.
    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], minYear: 2000, collapseSeasons: true }));
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

// --- Mood tag scoring ---------------------------------------------------------

describe('fetchDiscoveryDeck mood tag scoring', () => {
  it('requests tags in the pool query at no extra request', async () => {
    fetchMock.mockResolvedValue(jsonResponse(genrePayload([media({ id: 10, romaji: 'Show', english: 'Show' })])));

    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'] }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestBody(0).query).toContain('tags { name rank }');
  });

  it('ranks the highest tag-rank sum first, above votes and consensus', async () => {
    respondSeedThenGenre(
      seedPayload([
        seed({ id: 1, romaji: 'Seed', english: 'Seed' }, [
          {
            rating: 1,
            media: media({
              id: 10,
              romaji: 'Tag Star',
              english: 'Tag Star',
              popularity: 1,
              tags: [
                { name: 'Denpa', rank: 95 },
                { name: 'Philosophy', rank: 60 },
              ],
            }),
          },
          {
            rating: 9000,
            media: media({
              id: 11,
              romaji: 'Votes Star',
              english: 'Votes Star',
              popularity: 900000,
              tags: [{ name: 'Denpa', rank: 10 }],
            }),
          },
        ]),
      ]),
    );

    const deck = await fetchDiscoveryDeck(
      makeRequest({
        seeds: [{ anilistId: 1, title: 'Seed' }],
        moodTags: ['Denpa', 'Philosophy'],
      }),
    );

    // 95 + 60 = 155 beats 10, despite the other candidate's votes and popularity.
    expect(deck.map(candidate => candidate.anilistId)).toEqual([10, 11]);
    expect(deck[0].tags).toEqual([
      { name: 'Denpa', rank: 95 },
      { name: 'Philosophy', rank: 60 },
    ]);
  });

  it('keeps a candidate whose mood score is zero', async () => {
    respondSeedThenGenre(
      seedPayload([
        seed({ id: 1, romaji: 'Seed', english: 'Seed' }, [
          {
            rating: 500,
            media: media({
              id: 20,
              romaji: 'Unrelated',
              english: 'Unrelated',
              tags: [{ name: 'Cooking', rank: 100 }],
            }),
          },
        ]),
      ]),
    );

    const deck = await fetchDiscoveryDeck(
      makeRequest({ seeds: [{ anilistId: 1, title: 'Seed' }], moodTags: ['Denpa'] }),
    );

    expect(deck.map(candidate => candidate.anilistId)).toEqual([20]);
  });

  it('treats a missing tags field as an empty list and ignores malformed tags', async () => {
    respondSeedThenGenre(
      seedPayload([
        seed({ id: 1, romaji: 'Seed', english: 'Seed' }, [
          { rating: 100, media: media({ id: 30, romaji: 'No Tags', english: 'No Tags' }) },
          {
            rating: 50,
            media: {
              ...media({ id: 31, romaji: 'Broken Tags', english: 'Broken Tags' }),
              // A hostile payload: the engine must clean it, not trust it.
              tags: [
                { name: '  ', rank: 90 },
                { name: 'Denpa', rank: null },
                { name: 'Denpa', rank: 999 },
                null,
                'nope',
              ] as unknown as { name: string; rank: number }[],
            },
          },
        ]),
      ]),
    );

    const deck = await fetchDiscoveryDeck(
      makeRequest({ seeds: [{ anilistId: 1, title: 'Seed' }], moodTags: ['Denpa'] }),
    );

    expect(deck.find(candidate => candidate.anilistId === 30)?.tags).toEqual([]);
    // The rank is clamped to 0-100, so the malformed entries leave exactly one tag.
    expect(deck.find(candidate => candidate.anilistId === 31)?.tags).toEqual([{ name: 'Denpa', rank: 100 }]);
    expect(deck[0].anilistId).toBe(31);
  });
});

// --- Curation -----------------------------------------------------------------

describe('fetchDiscoveryDeck curation', () => {
  const poolOfTen = () =>
    seedPayload([
      seed(
        { id: 1, romaji: 'Seed', english: 'Seed' },
        Array.from({ length: 10 }, (_, index) => ({
          rating: 100 - index,
          media: media({ id: 100 + index, romaji: `Pick ${index}`, english: `Pick ${index}` }),
        })),
      ),
    ]);

  const curationRequest = (apiKey = 'secret-api-key'): Partial<DiscoveryRequest> => ({
    seeds: [{ anilistId: 1, title: 'Seed' }],
    moodTags: ['Denpa'],
    curation: { apiKey, moodLabel: 'Quiero algo que me vuele la cabeza' },
  });

  /** One seed response followed by one empty genre pool, per scheduled call. */
  const scheduleSeedPicks = (times = 1): void => {
    for (let index = 0; index < times; index += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse(poolOfTen()));
      fetchMock.mockResolvedValueOnce(jsonResponse(genrePayload([])));
    }
  };

  it('rebuilds the deck from the curated order with the Spanish reasons', async () => {
    scheduleSeedPicks();
    vi.mocked(curateCandidates).mockResolvedValueOnce([
      { anilistId: 105, reason: 'Su estructura fragmentada te deja descolocado.' },
      { anilistId: 100, reason: 'Juega con la memoria de un modo imposible de prever.' },
    ]);

    const deck = await fetchDiscoveryDeck(makeRequest(curationRequest()));

    // Curation selects: everything it did not pick is dropped, not appended.
    expect(deck.map(candidate => candidate.anilistId)).toEqual([105, 100]);
    expect(deck[0].reason).toBe('Su estructura fragmentada te deja descolocado.');
    expect(deck[1].reason).toBe('Juega con la memoria de un modo imposible de prever.');

    // The curated ids are the only ones offered to the model.
    const call = vi.mocked(curateCandidates).mock.calls[0][0];
    expect(call.candidates.map(candidate => candidate.anilistId)).toEqual([
      100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
    ]);
    expect(call.moodLabel).toBe('Quiero algo que me vuele la cabeza');
    expect(call.maxItems).toBe(40);
    // The key must never reach AniList.
    expect(JSON.stringify(requestBody(0))).not.toContain('secret-api-key');
  });

  it('drops curated ids the engine never offered', async () => {
    scheduleSeedPicks();
    vi.mocked(curateCandidates).mockResolvedValueOnce([
      { anilistId: 999, reason: 'Inventada.' },
      { anilistId: 101, reason: 'Real.' },
    ]);

    const deck = await fetchDiscoveryDeck(makeRequest(curationRequest()));

    expect(deck.map(candidate => candidate.anilistId)).toEqual([101]);
  });

  it('keeps the local order when curation returns null', async () => {
    scheduleSeedPicks();
    vi.mocked(curateCandidates).mockResolvedValueOnce(null);

    const deck = await fetchDiscoveryDeck(makeRequest(curationRequest()));

    expect(deck).toHaveLength(10);
    expect(deck.map(candidate => candidate.anilistId)).toEqual([
      100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
    ]);
    expect(deck.every(candidate => candidate.reason === undefined)).toBe(true);
  });

  it('does not curate without a key or with a pool thinner than eight', async () => {
    // A single usable pick: the pool is never deep enough to curate.
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          seedPayload([
            seed({ id: 1, romaji: 'Seed', english: 'Seed' }, [
              { rating: 10, media: media({ id: 100, romaji: 'Only Pick', english: 'Only Pick' }) },
            ]),
          ]),
        ),
      )
      .mockResolvedValueOnce(jsonResponse(genrePayload([])))
      .mockResolvedValueOnce(
        jsonResponse(
          seedPayload([
            seed({ id: 1, romaji: 'Seed', english: 'Seed' }, [
              { rating: 10, media: media({ id: 100, romaji: 'Only Pick', english: 'Only Pick' }) },
            ]),
          ]),
        ),
      )
      .mockResolvedValueOnce(jsonResponse(genrePayload([])));

    await fetchDiscoveryDeck(makeRequest({ seeds: [{ anilistId: 1, title: 'Seed' }], moodTags: ['Denpa'] }));
    expect(vi.mocked(curateCandidates)).not.toHaveBeenCalled();

    __clearDiscoveryCacheForTests();
    await fetchDiscoveryDeck(makeRequest({ ...curationRequest(), curation: { apiKey: '   ' } }));
    expect(vi.mocked(curateCandidates)).not.toHaveBeenCalled();
  });

  it('clamps maxItems into the 8-40 window', async () => {
    scheduleSeedPicks(3);
    vi.mocked(curateCandidates).mockResolvedValue(null);
    await fetchDiscoveryDeck(
      makeRequest({ ...curationRequest(), curation: { apiKey: 'secret-api-key', maxItems: 3 } }),
    );
    expect(vi.mocked(curateCandidates).mock.calls[0][0].maxItems).toBe(8);

    __clearDiscoveryCacheForTests();
    await fetchDiscoveryDeck(
      makeRequest({ ...curationRequest(), curation: { apiKey: 'secret-api-key', maxItems: 500 } }),
    );
    expect(vi.mocked(curateCandidates).mock.calls[1][0].maxItems).toBe(40);

    __clearDiscoveryCacheForTests();
    await fetchDiscoveryDeck(makeRequest(curationRequest()));
    expect(vi.mocked(curateCandidates).mock.calls[2][0].maxItems).toBe(40);
  });

  it('caches mood tags sorted and separates entries by mood label', async () => {
    fetchMock.mockResolvedValue(jsonResponse(genrePayload([media({ id: 10, romaji: 'Show', english: 'Show' })])));

    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], moodTags: ['Denpa', 'Time Loop'] }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Same tag set in another order: one cache entry.
    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], moodTags: ['Time Loop', 'Denpa'] }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A different tag set misses the cache.
    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'], moodTags: ['Denpa'] }));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // A different mood label misses the cache even with the same tags.
    await fetchDiscoveryDeck(
      makeRequest({
        fallbackGenres: ['Action'],
        moodTags: ['Denpa'],
        curation: { apiKey: 'secret-api-key', moodLabel: 'Quiero algo que me vuele la cabeza' },
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // A different apiKey is not in the cache key, so it hits the same entry.
    await fetchDiscoveryDeck(
      makeRequest({
        fallbackGenres: ['Action'],
        moodTags: ['Denpa'],
        curation: { apiKey: 'another-key', moodLabel: 'Quiero algo que me vuele la cabeza' },
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // No mood tags at all is yet another entry.
    await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'] }));
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('copies tags onto the served deck so callers cannot mutate the cache', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        genrePayload([
          media({ id: 10, romaji: 'Show', english: 'Show', tags: [{ name: 'Denpa', rank: 90 }] }),
        ]),
      ),
    );

    const first = await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'] }));
    first[0].tags.push({ name: 'Injected', rank: 100 });
    first[0].tags[0].rank = 1;

    const second = await fetchDiscoveryDeck(makeRequest({ fallbackGenres: ['Action'] }));
    expect(second[0].tags).toEqual<DiscoveryCandidate['tags']>([{ name: 'Denpa', rank: 90 }]);
  });
});
