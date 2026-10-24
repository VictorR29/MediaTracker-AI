import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MediaItem } from '../../types';
import {
  ANILIST_ENDPOINT,
  AIRING_TTL_MS,
  AniListError,
  __clearCharacterCacheForTests,
  __resetThrottleForTests,
  __setThrottleForTests,
  applyAiringSnapshots,
  applyMatchResult,
  createManualMatch,
  fetchAiringSnapshots,
  fetchMediaCharacters,
  isAiringSnapshotFresh,
  linkAniListCandidate,
  resolveAniListMatch,
  resolveAniListScope,
  searchAniListCandidates,
} from '../anilistService';
import type { AniListCandidate, AiringDetails } from '../anilistService';

// --- Fixtures -----------------------------------------------------------------

interface MediaNodeFixture {
  id: number;
  romaji?: string;
  english?: string | null;
  native?: string | null;
  synonyms?: string[];
  format?: string;
  seasonYear?: number;
  episodes?: number | null;
  chapters?: number | null;
  countryOfOrigin?: string | null;
  status?: string;
  isAdult?: boolean;
  genres?: string[];
  coverLarge?: string;
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
  relations?: { edges: unknown[] };
}

const mediaNode = (fixture: MediaNodeFixture) => ({
  id: fixture.id,
  title: {
    romaji: fixture.romaji ?? '',
    english: fixture.english ?? null,
    native: fixture.native ?? null,
  },
  synonyms: fixture.synonyms ?? [],
  format: fixture.format ?? 'TV',
  seasonYear: fixture.seasonYear ?? 2013,
  episodes: fixture.episodes === undefined ? 12 : fixture.episodes,
  chapters: fixture.chapters ?? null,
  countryOfOrigin: fixture.countryOfOrigin ?? null,
  status: fixture.status ?? 'FINISHED',
  isAdult: fixture.isAdult ?? false,
  coverImage: { medium: `https://img.example/${fixture.id}.jpg`, large: fixture.coverLarge },
  genres: fixture.genres ?? [],
  nextAiringEpisode: fixture.nextAiringEpisode ?? null,
  relations: fixture.relations ?? { edges: [] },
});

interface RelationNodeFixture {
  id: number;
  romaji?: string;
  english?: string | null;
  type?: string;
  format?: string;
  status?: string;
  isAdult?: boolean;
  episodes?: number | null;
  seasonYear?: number;
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
}

const relationNode = (fixture: RelationNodeFixture) => ({
  id: fixture.id,
  type: fixture.type ?? 'ANIME',
  format: fixture.format ?? 'TV',
  status: fixture.status ?? 'RELEASING',
  isAdult: fixture.isAdult ?? false,
  episodes: fixture.episodes === undefined ? 12 : fixture.episodes,
  seasonYear: fixture.seasonYear ?? 2024,
  startDate: fixture.startDate ?? null,
  title: {
    romaji: fixture.romaji ?? '',
    english: fixture.english ?? null,
  },
  nextAiringEpisode: fixture.nextAiringEpisode ?? null,
});

const relationEdge = (node: ReturnType<typeof relationNode>, relationType = 'SEQUEL') => ({
  relationType,
  node,
});

const searchPayload = (nodes: ReturnType<typeof mediaNode>[]) => ({ Page: { media: nodes } });

const jsonResponse = (data: unknown): Response =>
  ({ ok: true, status: 200, json: async () => ({ data }) }) as unknown as Response;

const errorResponse = (status: number): Response =>
  ({ ok: false, status, json: async () => ({}) }) as unknown as Response;

const makeItem = (aiData: Partial<MediaItem['aiData']> = {}, trackingData: Partial<MediaItem['trackingData']> = {}): MediaItem => ({
  id: 'local-1',
  aiData: {
    title: 'Default Title',
    mediaType: 'Anime',
    synopsis: 'A synopsis',
    genres: ['Action'],
    status: 'En emisión',
    totalContent: '1 Temporada',
    coverDescription: 'Cover',
    coverImage: 'https://img.example/local.jpg',
    ...aiData,
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
    ...trackingData,
  },
  createdAt: 1_000,
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  // AniList is throttled in production; tests must not wait 2s per request.
  __setThrottleForTests(0);
  // Character lists are cached per media id; every test starts cold.
  __clearCharacterCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  __resetThrottleForTests();
});

// --- Search / matching --------------------------------------------------------

describe('resolveAniListMatch', () => {
  it('matches exactly through a synonym and reports title / exact', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        searchPayload([
          mediaNode({
            id: 16498,
            romaji: 'Shingeki no Kyojin',
            english: 'Attack on Titan',
            synonyms: ['Ataque a los Titanes'],
          }),
        ]),
      ),
    );

    const result = await resolveAniListMatch(makeItem({ title: 'Ataque a los Titanes' }));

    expect(result.status).toBe('matched');
    expect(result.match?.id).toBe(16498);
    expect(result.match?.matchedTitle).toBe('Shingeki no Kyojin');
    expect(result.match?.matchedBy).toBe('title');
    expect(result.match?.confidence).toBe('exact');
  });

  it('treats accents as irrelevant when normalizing', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        searchPayload([
          mediaNode({
            id: 31964,
            romaji: 'Boku no Hero Academia',
            synonyms: ['Mi Heroe Academia'],
          }),
        ]),
      ),
    );

    const result = await resolveAniListMatch(makeItem({ title: 'Mi Héroe Academia' }));

    expect(result.status).toBe('matched');
    expect(result.match?.id).toBe(31964);
    expect(result.match?.confidence).toBe('exact');
  });

  it('matches an exact romaji title', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(searchPayload([mediaNode({ id: 38000, romaji: 'Kimetsu no Yaiba', english: 'Demon Slayer' })])),
    );

    const result = await resolveAniListMatch(makeItem({ title: 'Kimetsu no Yaiba' }));

    expect(result.status).toBe('matched');
    expect(result.match?.confidence).toBe('exact');
  });

  it('accepts a 0.75 token overlap as a high-confidence match', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(searchPayload([mediaNode({ id: 48561, romaji: 'Jujutsu Kaisen Movie Zero' })])),
    );

    const result = await resolveAniListMatch(makeItem({ title: 'Jujutsu Kaisen Zero' }));

    expect(result.status).toBe('matched');
    expect(result.match?.id).toBe(48561);
    expect(result.match?.confidence).toBe('high');
  });

  it('falls back to originalTitle when the title search returns nothing', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(searchPayload([])))
      .mockResolvedValueOnce(jsonResponse(searchPayload([mediaNode({ id: 31964, romaji: 'Boku no Hero Academia' })])));

    const item = makeItem({ title: 'Boku no Hero Academia (Latino)', originalTitle: 'Boku no Hero Academia' });
    const result = await resolveAniListMatch(item);

    expect(result.status).toBe('matched');
    expect(result.match?.matchedBy).toBe('originalTitle');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to originalTitle when the title search returns only below-threshold noise', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(searchPayload([mediaNode({ id: 1, romaji: 'Demon Slayer: Kimetsu no Yaiba' })])),
      )
      .mockResolvedValueOnce(jsonResponse(searchPayload([mediaNode({ id: 101922, romaji: 'Kimetsu no Yaiba' })])));

    const item = makeItem({ title: 'Cazador de Demonios', originalTitle: 'Kimetsu no Yaiba' });
    const result = await resolveAniListMatch(item);

    expect(result.status).toBe('matched');
    expect(result.match?.id).toBe(101922);
    expect(result.match?.matchedBy).toBe('originalTitle');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns the last source candidates as fallback when every source stays below the threshold', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(searchPayload([mediaNode({ id: 1, romaji: 'Demon Slayer: Kimetsu no Yaiba' })])))
      .mockResolvedValueOnce(jsonResponse(searchPayload([mediaNode({ id: 2, romaji: 'Some Unrelated Show' })])));

    const result = await resolveAniListMatch(makeItem({ title: 'Cazador de Demonios', originalTitle: 'Otra Cosa' }));

    expect(result.status).toBe('not_found');
    expect(result.candidates?.map(candidate => candidate.id)).toEqual([2]);
  });

  it('reports ambiguity when two entries tie and none is airing', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        searchPayload([
          mediaNode({ id: 10, romaji: 'Fruits Basket', status: 'FINISHED' }),
          mediaNode({ id: 11, romaji: 'Fruits Basket', status: 'NOT_YET_RELEASED' }),
        ]),
      ),
    );

    const item = makeItem({ title: 'Fruits Basket' });
    const result = await resolveAniListMatch(item);

    expect(result.status).toBe('ambiguous');
    expect(result.match).toBeUndefined();
    expect(result.candidates).toHaveLength(2);
    expect(applyMatchResult(item, result)).toEqual(item);
  });

  it('breaks a tie in favor of the only airing entry', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        searchPayload([
          mediaNode({ id: 10, romaji: 'Fruits Basket', status: 'FINISHED' }),
          mediaNode({ id: 11, romaji: 'Fruits Basket', status: 'RELEASING' }),
        ]),
      ),
    );

    const result = await resolveAniListMatch(makeItem({ title: 'Fruits Basket' }));

    expect(result.status).toBe('matched');
    expect(result.match?.id).toBe(11);
  });

  it('never matches adult entries', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        searchPayload([
          mediaNode({ id: 1, romaji: 'Bleach', isAdult: true }),
          mediaNode({ id: 2, romaji: 'Bleach: Sennen Kessen-hen', synonyms: ['Bleach'], isAdult: false }),
        ]),
      ),
    );

    const result = await resolveAniListMatch(makeItem({ title: 'Bleach' }));

    expect(result.status).toBe('matched');
    expect(result.match?.id).toBe(2);
    expect(result.candidates ?? []).not.toContainEqual(expect.objectContaining({ id: 1 }));
  });

  it('reports not_found when no candidate reaches the score threshold', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(searchPayload([mediaNode({ id: 20, romaji: 'Naruto Shippuuden' })])),
    );

    const result = await resolveAniListMatch(makeItem({ title: 'Bleach' }));

    expect(result.status).toBe('not_found');
    expect(result.match).toBeUndefined();
    expect(result.candidates).toHaveLength(1);
  });

  it('infers the season from an ordinal suffix in the matched title', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(searchPayload([mediaNode({ id: 30, romaji: 'Shingeki no Kyojin 2nd Season' })])),
    );

    const result = await resolveAniListMatch(makeItem({ title: 'Shingeki no Kyojin' }));

    expect(result.status).toBe('matched');
    expect(result.match?.season).toBe(2);
  });

  it('treats an unsuffixed matched title as season 1', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(searchPayload([mediaNode({ id: 31, romaji: 'Kimetsu no Yaiba' })])));

    const result = await resolveAniListMatch(makeItem({ title: 'Kimetsu no Yaiba' }));

    expect(result.status).toBe('matched');
    expect(result.match?.season).toBe(1);
  });

  it('sends a POST GraphQL request to the AniList endpoint', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(searchPayload([])));

    await searchAniListCandidates('Bleach');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ANILIST_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(init.body).toContain('query');
  });

  it('ignores empty titles and never issues a request', async () => {
    const result = await resolveAniListMatch(makeItem({ title: '   ' }));

    expect(result.status).toBe('not_found');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// --- Media scope --------------------------------------------------------------

const requestBodyAt = (callIndex = 0): { query: string; variables: Record<string, unknown> } => {
  const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(String(init.body));
};

describe('resolveAniListScope', () => {
  it('maps Anime to ANIME and Manhwa to Korean MANGA', () => {
    expect(resolveAniListScope(makeItem({ mediaType: 'Anime' }))).toEqual({ mediaType: 'ANIME' });
    expect(resolveAniListScope(makeItem({ mediaType: 'Manhwa' }))).toEqual({
      mediaType: 'MANGA',
      countryOfOrigin: 'KR',
    });
  });

  it('maps Manga and Comic to MANGA without a country filter', () => {
    expect(resolveAniListScope(makeItem({ mediaType: 'Manga' }))).toEqual({ mediaType: 'MANGA' });
    expect(resolveAniListScope(makeItem({ mediaType: 'Comic' }))).toEqual({ mediaType: 'MANGA' });
  });

  it('returns null for every format AniList does not cover', () => {
    const uncovered: MediaItem['aiData']['mediaType'][] = ['Serie', 'Pelicula', 'Libro', 'Otro'];

    for (const mediaType of uncovered) {
      expect(resolveAniListScope(makeItem({ mediaType }))).toBeNull();
    }
  });
});

describe('searchAniListCandidates scope', () => {
  it('narrows a manhwa search to Korean MANGA', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(searchPayload([])));

    await searchAniListCandidates('Solo Leveling', 10, { mediaType: 'MANGA', countryOfOrigin: 'KR' });

    const body = requestBodyAt();
    expect(body.variables).toEqual({
      search: 'Solo Leveling',
      perPage: 10,
      type: 'MANGA',
      country: 'KR',
    });
    expect(body.query).toContain('countryOfOrigin: $country');
    expect(body.query).toContain('$country: CountryCode');
  });

  it('searches plain manga without a country clause', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(searchPayload([])));

    await searchAniListCandidates('Solo Leveling', 10, { mediaType: 'MANGA' });

    const body = requestBodyAt();
    expect(body.variables).toEqual({ search: 'Solo Leveling', perPage: 10, type: 'MANGA' });
    expect(body.variables).not.toHaveProperty('country');
    // The field is selected (manga carries it) but no country filter is applied.
    expect(body.query).not.toContain('countryOfOrigin: $country');
  });
});

describe('resolveAniListMatch media scope', () => {
  it('resolves a manhwa against Korean MANGA', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        searchPayload([
          mediaNode({
            id: 105398,
            romaji: 'Solo Leveling',
            format: 'MANGA',
            episodes: null,
            chapters: 179,
            countryOfOrigin: 'KR',
          }),
        ]),
      ),
    );

    const result = await resolveAniListMatch(makeItem({ title: 'Solo Leveling', mediaType: 'Manhwa' }));

    expect(result.status).toBe('matched');
    expect(result.match?.id).toBe(105398);

    const body = requestBodyAt();
    expect(body.variables).toMatchObject({ type: 'MANGA', country: 'KR' });
  });

  it('never issues a request for a format AniList does not cover', async () => {
    const result = await resolveAniListMatch(makeItem({ title: 'El Marginal', mediaType: 'Serie' }));

    expect(result.status).toBe('not_found');
    expect(result.candidates).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// --- Airing snapshots ---------------------------------------------------------

describe('fetchAiringSnapshots', () => {
  it('fetches deduplicated ids in a single request and maps the airing fields', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        searchPayload([
          mediaNode({
            id: 1,
            status: 'RELEASING',
            episodes: 24,
            nextAiringEpisode: { episode: 7, airingAt: 1_700_000_000 },
          }),
          mediaNode({ id: 2, status: 'FINISHED', episodes: 12, nextAiringEpisode: null }),
          mediaNode({ id: 3, status: 'HIATUS', episodes: 10 }),
        ]),
      ),
    );

    const snapshots = await fetchAiringSnapshots([1, 2, 3, 2]);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const details = snapshots.get(1);
    const airing = details?.snapshot;
    expect(airing).toMatchObject({
      status: 'RELEASING',
      isAiring: true,
      nextEpisode: 7,
      nextAiringAt: 1_700_000_000,
      totalEpisodes: 24,
    });
    expect(typeof airing?.fetchedAt).toBe('number');

    expect(snapshots.get(2)?.snapshot).toMatchObject({ status: 'FINISHED', isAiring: false, totalEpisodes: 12 });
    expect(snapshots.get(2)?.snapshot.nextEpisode).toBeUndefined();
    expect(snapshots.get(3)?.snapshot.isAiring).toBe(false);
  });

  it('chunks more than 50 ids into one request per chunk', async () => {
    fetchMock.mockResolvedValue(jsonResponse(searchPayload([])));
    const ids = Array.from({ length: 120 }, (_, index) => index + 1);

    const snapshots = await fetchAiringSnapshots(ids);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(snapshots.size).toBe(0);
  });

  it('returns an empty map without any request for empty input', async () => {
    const snapshots = await fetchAiringSnapshots([]);

    expect(snapshots.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces HTTP 429 as a rate_limit error', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(429));

    const error = await fetchAiringSnapshots([1]).catch(caught => caught);

    expect(error).toBeInstanceOf(AniListError);
    expect(error.kind).toBe('rate_limit');
    expect(error.status).toBe(429);
  });

  it('surfaces a GraphQL errors payload', async () => {
    fetchMock.mockResolvedValueOnce(
      { ok: true, status: 200, json: async () => ({ errors: [{ message: 'Invalid token' }] }) } as unknown as Response,
    );

    const error = await searchAniListCandidates('Bleach').catch(caught => caught);

    expect(error).toBeInstanceOf(AniListError);
    expect(error.kind).toBe('graphql');
    expect(error.message).toBe('Invalid token');
  });

  it('surfaces a network failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const error = await searchAniListCandidates('Bleach').catch(caught => caught);

    expect(error).toBeInstanceOf(AniListError);
    expect(error.kind).toBe('network');
  });
});

describe('sequel selection', () => {
  const mediaWith = (edges: unknown[], mediaId = 1) =>
    jsonResponse(
      searchPayload([
        {
          ...mediaNode({ id: mediaId, status: 'FINISHED' }),
          relations: { edges },
        },
      ]),
    );

  it('picks a RELEASING sequel and maps its next episode', async () => {
    fetchMock.mockResolvedValueOnce(
      mediaWith([
        relationEdge(
          relationNode({
            id: 2,
            romaji: 'Shingeki no Kyojin Season 2',
            status: 'RELEASING',
            episodes: 12,
            nextAiringEpisode: { episode: 5, airingAt: 1_700_000_000 },
          }),
        ),
      ]),
    );

    const details = (await fetchAiringSnapshots([1])).get(1);

    expect(details?.snapshot.isAiring).toBe(false);
    expect(details?.sequel).toMatchObject({
      id: 2,
      season: 2,
      title: 'Shingeki no Kyojin Season 2',
      status: 'RELEASING',
      episodes: 12,
      nextEpisode: 5,
      nextAiringAt: 1_700_000_000,
    });
  });

  it('picks a NOT_YET_RELEASED sequel when no RELEASING sibling exists', async () => {
    fetchMock.mockResolvedValueOnce(
      mediaWith([
        relationEdge(
          relationNode({
            id: 3,
            romaji: 'Kimetsu no Yaiba 2nd Season',
            status: 'NOT_YET_RELEASED',
            startDate: { year: 2027, month: 1, day: 4 },
          }),
        ),
      ]),
    );

    const sequel = (await fetchAiringSnapshots([1])).get(1)?.sequel;

    expect(sequel?.status).toBe('NOT_YET_RELEASED');
    expect(sequel?.id).toBe(3);
    expect(sequel?.startDate).toBe('2027-01-04');
  });

  it('ignores a FINISHED sequel and omits the field entirely', async () => {
    fetchMock.mockResolvedValueOnce(
      mediaWith([relationEdge(relationNode({ id: 4, romaji: 'Shingeki no Kyojin Season 2', status: 'FINISHED' }))]),
    );

    const details = (await fetchAiringSnapshots([1])).get(1);

    expect(details?.sequel).toBeUndefined();
    expect(details && 'sequel' in details).toBe(false);
  });

  it('ignores a MOVIE sequel even when it is NOT_YET_RELEASED', async () => {
    fetchMock.mockResolvedValueOnce(
      mediaWith([
        relationEdge(
          relationNode({ id: 5, romaji: 'Kimetsu no Yaiba Movie', format: 'MOVIE', status: 'NOT_YET_RELEASED' }),
        ),
      ]),
    );

    expect((await fetchAiringSnapshots([1])).get(1)?.sequel).toBeUndefined();
  });

  it('picks the RELEASING sequel with the soonest airingAt', async () => {
    fetchMock.mockResolvedValueOnce(
      mediaWith([
        relationEdge(
          relationNode({ id: 6, romaji: 'Show 2nd Season', status: 'RELEASING', nextAiringEpisode: { episode: 3, airingAt: 1_800_000_000 } }),
        ),
        relationEdge(
          relationNode({ id: 7, romaji: 'Show 3rd Season', status: 'RELEASING', nextAiringEpisode: { episode: 1, airingAt: 1_700_000_000 } }),
        ),
      ]),
    );

    const sequel = (await fetchAiringSnapshots([1])).get(1)?.sequel;

    expect(sequel?.id).toBe(7);
    expect(sequel?.nextAiringAt).toBe(1_700_000_000);
  });

  it('breaks an exact tie by ascending id', async () => {
    fetchMock.mockResolvedValueOnce(
      mediaWith([
        relationEdge(
          relationNode({ id: 9, romaji: 'Show 3rd Season', status: 'RELEASING', nextAiringEpisode: { episode: 1, airingAt: 1_700_000_000 } }),
        ),
        relationEdge(
          relationNode({ id: 8, romaji: 'Show 2nd Season', status: 'RELEASING', nextAiringEpisode: { episode: 1, airingAt: 1_700_000_000 } }),
        ),
      ]),
    );

    expect((await fetchAiringSnapshots([1])).get(1)?.sequel?.id).toBe(8);
  });

  it('ignores a PREQUEL relation', async () => {
    fetchMock.mockResolvedValueOnce(
      mediaWith([relationEdge(relationNode({ id: 10, romaji: 'Show 1st Season', status: 'RELEASING' }), 'PREQUEL')]),
    );

    expect((await fetchAiringSnapshots([1])).get(1)?.sequel).toBeUndefined();
  });

  it('formats partial start dates as year or year-month', async () => {
    fetchMock.mockResolvedValueOnce(
      mediaWith([relationEdge(relationNode({ id: 11, status: 'NOT_YET_RELEASED', startDate: { year: 2027 } }))]),
    );
    fetchMock.mockResolvedValueOnce(
      mediaWith([relationEdge(relationNode({ id: 12, status: 'NOT_YET_RELEASED', startDate: { year: 2027, month: 1 } }))]),
    );

    expect((await fetchAiringSnapshots([1])).get(1)?.sequel?.startDate).toBe('2027');
    expect((await fetchAiringSnapshots([1])).get(1)?.sequel?.startDate).toBe('2027-01');
  });
});

describe('fetchAiringSnapshots meta', () => {
  it('carries the canonical genres of the matched node', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(searchPayload([mediaNode({ id: 1, genres: ['Action', 'Drama', 'Sci-Fi'] })])),
    );

    const details = (await fetchAiringSnapshots([1])).get(1);

    expect(details?.meta).toEqual({ genres: ['Action', 'Drama', 'Sci-Fi'] });
  });

  it('carries the large poster url of the matched node', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        searchPayload([
          mediaNode({ id: 16498, coverLarge: 'https://img.example/16498-large.jpg' }),
        ]),
      ),
    );

    const details = (await fetchAiringSnapshots([16498])).get(16498);

    expect(details?.meta?.coverImage).toBe('https://img.example/16498-large.jpg');
  });

  it('omits the cover when the node has no large poster', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(searchPayload([mediaNode({ id: 1 })])));

    const details = (await fetchAiringSnapshots([1])).get(1);

    expect(details?.meta?.coverImage).toBeUndefined();
  });
});

describe('isAiringSnapshotFresh', () => {
  const snapshot = {
    status: 'RELEASING' as const,
    isAiring: true,
    fetchedAt: 1_000_000,
  };

  it('is fresh just under the 3h TTL', () => {
    expect(isAiringSnapshotFresh(snapshot, snapshot.fetchedAt + 2 * 60 * 60 * 1000 + 59 * 60 * 1000)).toBe(true);
  });

  it('is stale just over the 3h TTL', () => {
    expect(isAiringSnapshotFresh(snapshot, snapshot.fetchedAt + AIRING_TTL_MS + 60 * 1000)).toBe(false);
  });

  it('is not fresh for undefined snapshots', () => {
    expect(isAiringSnapshotFresh(undefined)).toBe(false);
  });
});

// --- Pure appliers ------------------------------------------------------------

describe('applyAiringSnapshots', () => {
  const ANILIST_ID = 21;

  const linkedItem = (aiData: Partial<MediaItem['aiData']> = {}): MediaItem =>
    makeItem({
      anilist: {
        id: ANILIST_ID,
        matchedTitle: 'Shingeki no Kyojin',
        matchedBy: 'title',
        confidence: 'exact',
        resolvedAt: 5_000,
      },
      ...aiData,
    });

  const detailsFor = (meta?: { genres: string[]; coverImage?: string }): Map<number, AiringDetails> =>
    new Map([
      [
        ANILIST_ID,
        {
          snapshot: { status: 'FINISHED' as const, isAiring: false, fetchedAt: 9_000 },
          ...(meta ? { meta } : {}),
        },
      ],
    ]);

  it('merges the snapshot while preserving every other aiData field', () => {
    const item = makeItem({
      synopsis: 'Existing synopsis',
      genres: ['Action', 'Drama'],
      coverImage: 'https://img.example/local.jpg',
      anilist: {
        id: 21,
        season: 2,
        matchedTitle: 'Shingeki no Kyojin Season 2',
        matchedBy: 'title',
        confidence: 'high',
        resolvedAt: 5_000,
      },
    });

    const snapshots = new Map([
      [
        21,
        {
          snapshot: {
            status: 'RELEASING' as const,
            isAiring: true,
            nextEpisode: 4,
            nextAiringAt: 1_700_000_000,
            totalEpisodes: 12,
            fetchedAt: 9_000,
          },
        },
      ],
    ]);

    const result = applyAiringSnapshots(item, snapshots);

    expect(result).not.toBe(item);
    expect(result.aiData.synopsis).toBe('Existing synopsis');
    expect(result.aiData.genres).toEqual(['Action', 'Drama']);
    expect(result.aiData.coverImage).toBe('https://img.example/local.jpg');
    expect(result.aiData.anilist?.id).toBe(21);
    expect(result.aiData.anilist?.matchedTitle).toBe('Shingeki no Kyojin Season 2');
    expect(result.aiData.anilist?.season).toBe(2);
    expect(result.aiData.anilist?.airing).toEqual(snapshots.get(21)?.snapshot);
    // The original item must stay untouched.
    expect(item.aiData.anilist?.airing).toBeUndefined();
  });

  it('persists the sequel alongside the snapshot', () => {
    const item = makeItem({
      anilist: {
        id: 21,
        season: 1,
        matchedTitle: 'Shingeki no Kyojin',
        matchedBy: 'title',
        confidence: 'exact',
        resolvedAt: 5_000,
      },
    });

    const sequel = {
      id: 22,
      season: 2,
      title: 'Shingeki no Kyojin Season 2',
      status: 'RELEASING' as const,
      episodes: 12,
      nextEpisode: 3,
      nextAiringAt: 1_700_000_000,
      startDate: '2027-01-04',
    };

    const result = applyAiringSnapshots(
      item,
      new Map([
        [21, { snapshot: { status: 'FINISHED' as const, isAiring: false, fetchedAt: 9_000 }, sequel }],
      ]),
    );

    expect(result.aiData.anilist?.sequel).toEqual(sequel);
    expect(result.aiData.anilist?.id).toBe(21);
  });

  it('deletes a previously persisted sequel when the new details have none', () => {
    const item = makeItem({
      anilist: {
        id: 21,
        matchedTitle: 'Shingeki no Kyojin',
        matchedBy: 'title',
        confidence: 'exact',
        resolvedAt: 5_000,
        sequel: {
          id: 22,
          season: 2,
          title: 'Shingeki no Kyojin Season 2',
          status: 'NOT_YET_RELEASED',
          startDate: '2027-01-04',
        },
      },
    });

    const result = applyAiringSnapshots(
      item,
      new Map([[21, { snapshot: { status: 'FINISHED' as const, isAiring: false, fetchedAt: 9_000 } }]]),
    );

    expect(result.aiData.anilist?.sequel).toBeUndefined();
    // A persisted (serialized) item must not resurrect the stale sequel either.
    expect(JSON.parse(JSON.stringify(result.aiData.anilist))).not.toHaveProperty('sequel');
  });

  it('writes genres from the snapshot meta', () => {
    const item = makeItem({
      anilist: {
        id: 21,
        matchedTitle: 'Shingeki no Kyojin',
        matchedBy: 'title',
        confidence: 'exact',
        resolvedAt: 5_000,
        genres: ['Action'],
      },
    });

    const result = applyAiringSnapshots(
      item,
      new Map([
        [
          21,
          {
            snapshot: { status: 'FINISHED' as const, isAiring: false, fetchedAt: 9_000 },
            meta: { genres: ['Action', 'Drama', 'Sci-Fi'] },
          },
        ],
      ]),
    );

    expect(result.aiData.anilist?.genres).toEqual(['Action', 'Drama', 'Sci-Fi']);
    expect(result.aiData.genres).toEqual(['Action']);
  });

  it('keeps stored genres when the details carry no meta', () => {
    const item = makeItem({
      anilist: {
        id: 21,
        matchedTitle: 'Shingeki no Kyojin',
        matchedBy: 'title',
        confidence: 'exact',
        resolvedAt: 5_000,
        genres: ['Action', 'Drama'],
      },
    });

    const result = applyAiringSnapshots(
      item,
      new Map([[21, { snapshot: { status: 'FINISHED' as const, isAiring: false, fetchedAt: 9_000 } }]]),
    );

    expect(result.aiData.anilist?.genres).toEqual(['Action', 'Drama']);
  });

  it('fills aiData.coverImage when it is undefined', () => {
    const item = linkedItem({ coverImage: undefined });
    const result = applyAiringSnapshots(
      item,
      detailsFor({ genres: ['Action'], coverImage: 'https://img.example/21-large.jpg' }),
    );

    expect(result.aiData.coverImage).toBe('https://img.example/21-large.jpg');
    // The cover rides along with the existing snapshot update.
    expect(result.aiData.anilist?.airing?.fetchedAt).toBe(9_000);
  });

  it('fills aiData.coverImage when it is an empty string', () => {
    const item = linkedItem({ coverImage: '' });
    const result = applyAiringSnapshots(
      item,
      detailsFor({ genres: ['Action'], coverImage: 'https://img.example/21-large.jpg' }),
    );

    expect(result.aiData.coverImage).toBe('https://img.example/21-large.jpg');
  });

  it('never overwrites an existing remote cover url', () => {
    const item = linkedItem({ coverImage: 'https://img.example/curated.jpg' });
    const result = applyAiringSnapshots(
      item,
      detailsFor({ genres: ['Action'], coverImage: 'https://img.example/21-large.jpg' }),
    );

    expect(result.aiData.coverImage).toBe('https://img.example/curated.jpg');
  });

  it('never overwrites an existing base64 cover upload', () => {
    const base64 = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAv';
    const item = linkedItem({ coverImage: base64 });
    const result = applyAiringSnapshots(
      item,
      detailsFor({ genres: ['Action'], coverImage: 'https://img.example/21-large.jpg' }),
    );

    expect(result.aiData.coverImage).toBe(base64);
  });

  it('leaves aiData.coverImage untouched when the details carry no meta', () => {
    const item = linkedItem({ coverImage: undefined });
    const result = applyAiringSnapshots(item, detailsFor());

    expect(result.aiData.coverImage).toBeUndefined();
  });

  it('leaves aiData.coverImage untouched when the meta has no cover', () => {
    const item = linkedItem({ coverImage: undefined });
    const result = applyAiringSnapshots(item, detailsFor({ genres: ['Action'] }));

    expect(result.aiData.coverImage).toBeUndefined();
    expect(result.aiData.anilist?.genres).toEqual(['Action']);
  });

  it('returns the item unchanged when it has no AniList data', () => {
    const item = makeItem();
    const snapshots = new Map([
      [21, { snapshot: { status: 'FINISHED' as const, isAiring: false, fetchedAt: 9_000 } }],
    ]);

    expect(applyAiringSnapshots(item, snapshots)).toBe(item);
  });

  it('returns the item unchanged when the map has no entry for its id', () => {
    const item = makeItem({
      anilist: {
        id: 21,
        matchedTitle: 'Shingeki no Kyojin',
        matchedBy: 'title',
        confidence: 'exact',
        resolvedAt: 5_000,
      },
    });
    const snapshots = new Map([
      [999, { snapshot: { status: 'FINISHED' as const, isAiring: false, fetchedAt: 9_000 } }],
    ]);

    expect(applyAiringSnapshots(item, snapshots)).toBe(item);
  });
});

describe('applyMatchResult', () => {
  it('stores the match and keeps pre-existing AniList fields', () => {
    const item = makeItem({
      anilist: {
        id: 1,
        matchedTitle: 'Old title',
        matchedBy: 'manual',
        confidence: 'manual',
        resolvedAt: 1_000,
      },
    });

    const result = applyMatchResult(item, {
      status: 'matched',
      match: {
        id: 16498,
        season: 1,
        matchedTitle: 'Shingeki no Kyojin',
        matchedBy: 'title',
        confidence: 'exact',
        resolvedAt: 2_000,
      },
    });

    expect(result.aiData.anilist).toMatchObject({
      id: 16498,
      matchedTitle: 'Shingeki no Kyojin',
      matchedBy: 'title',
      confidence: 'exact',
      resolvedAt: 2_000,
      season: 1,
    });
    expect(result.aiData.title).toBe('Default Title');
    expect(item.aiData.anilist?.id).toBe(1);
  });

  it('returns the item untouched for a non-matched result', () => {
    const item = makeItem();

    expect(applyMatchResult(item, { status: 'not_found' })).toBe(item);
    expect(
      applyMatchResult(item, {
        status: 'ambiguous',
        candidates: [
          {
            id: 1,
            romaji: 'Fruits Basket',
            synonyms: [],
            status: 'FINISHED',
            isAdult: false,
            genres: [],
          },
        ],
      }),
    ).toBe(item);
  });
});

// --- Manual linking -----------------------------------------------------------

const makeCandidate = (overrides: Partial<AniListCandidate> = {}): AniListCandidate => ({
  id: 16498,
  romaji: 'Shingeki no Kyojin',
  synonyms: [],
  status: 'FINISHED',
  isAdult: false,
  genres: [],
  ...overrides,
});

describe('createManualMatch', () => {
  it('builds a manual identity and infers only the season from the title', () => {
    const match = createManualMatch(makeCandidate({ id: 42, romaji: 'Kimetsu no Yaiba 2nd Season' }));

    expect(match).toMatchObject({
      id: 42,
      season: 2,
      matchedTitle: 'Kimetsu no Yaiba 2nd Season',
      matchedBy: 'manual',
      confidence: 'manual',
    });
    expect(typeof match.resolvedAt).toBe('number');
    expect(match).not.toHaveProperty('airing');
    expect(match).not.toHaveProperty('sequel');
  });

  it('falls back to the english title, then to the native title', () => {
    expect(createManualMatch(makeCandidate({ romaji: '', english: 'Attack on Titan' })).matchedTitle).toBe(
      'Attack on Titan',
    );

    const nativeOnly = createManualMatch(
      makeCandidate({ romaji: '', english: undefined, native: '進撃の巨人' }),
    );
    expect(nativeOnly.matchedTitle).toBe('進撃の巨人');
    expect(nativeOnly.season).toBeUndefined();
  });
});

describe('linkAniListCandidate', () => {
  it('persists the manual identity and attaches the fresh snapshot', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        searchPayload([
          mediaNode({
            id: 77,
            romaji: 'Bleach',
            status: 'RELEASING',
            nextAiringEpisode: { episode: 3, airingAt: 1_700_000_000 },
          }),
        ]),
      ),
    );

    const linked = await linkAniListCandidate(makeItem(), makeCandidate({ id: 77, romaji: 'Bleach' }));

    expect(linked.aiData.anilist).toMatchObject({
      id: 77,
      matchedTitle: 'Bleach',
      matchedBy: 'manual',
      confidence: 'manual',
    });
    expect(linked.aiData.anilist?.airing).toMatchObject({
      status: 'RELEASING',
      isAiring: true,
      nextEpisode: 3,
      nextAiringAt: 1_700_000_000,
    });
  });

  it('drops the previous airing and sequel when the item is re-linked', async () => {
    const item = makeItem({
      anilist: {
        id: 21,
        season: 1,
        matchedTitle: 'Shingeki no Kyojin',
        matchedBy: 'title',
        confidence: 'exact',
        resolvedAt: 1_000,
        airing: {
          status: 'RELEASING',
          isAiring: true,
          nextEpisode: 9,
          nextAiringAt: 1_700_000_000,
          totalEpisodes: 24,
          fetchedAt: 2_000,
        },
        sequel: {
          id: 22,
          season: 2,
          title: 'Shingeki no Kyojin Season 2',
          status: 'NOT_YET_RELEASED',
        },
      },
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(searchPayload([mediaNode({ id: 77, romaji: 'Bleach', status: 'FINISHED' })])),
    );

    const linked = await linkAniListCandidate(item, makeCandidate({ id: 77, romaji: 'Bleach' }));

    expect(linked.aiData.anilist?.id).toBe(77);
    expect(linked.aiData.anilist?.matchedTitle).toBe('Bleach');
    expect(linked.aiData.anilist?.airing).toMatchObject({ status: 'FINISHED', isAiring: false });
    expect(linked.aiData.anilist?.airing?.nextEpisode).toBeUndefined();
    expect(linked.aiData.anilist?.sequel).toBeUndefined();
    // A serialized item must not resurrect the stale sequel either.
    expect(JSON.parse(JSON.stringify(linked.aiData.anilist))).not.toHaveProperty('sequel');
    // The original item stays untouched.
    expect(item.aiData.anilist?.id).toBe(21);
    expect(item.aiData.anilist?.sequel?.id).toBe(22);
  });

  it('keeps the manual identity when the snapshot request fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    try {
      const linked = await linkAniListCandidate(makeItem(), makeCandidate({ id: 88, romaji: 'Bleach' }));

      expect(linked.aiData.anilist).toMatchObject({
        id: 88,
        matchedTitle: 'Bleach',
        matchedBy: 'manual',
        confidence: 'manual',
      });
      expect(linked.aiData.anilist?.airing).toBeUndefined();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});

// --- Characters ---------------------------------------------------------------

const charactersPayload = (nodes: unknown[]) => ({ Media: { characters: { nodes } } });

const requestBody = (callIndex = 0): { query: string; variables: Record<string, unknown> } => {
  const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(String(init.body));
};

describe('fetchMediaCharacters', () => {
  it('maps full name, native name and the large image, skipping blank names', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        charactersPayload([
          {
            id: 40882,
            name: { full: 'Eren Yeager', native: 'エレン・イェーガー' },
            image: { large: 'https://s4.anilist.co/file/anilistcdn/character/large/b40882.jpg' },
          },
          { id: 40881, name: { full: '   ', native: 'ミカサ・アッカーマン' }, image: { large: 'https://img/mikasa.png' } },
          { id: 40883, name: { full: 'Armin Arlert', native: null }, image: null },
        ]),
      ),
    );

    const characters = await fetchMediaCharacters(16498);

    expect(characters).toEqual([
      {
        id: 40882,
        name: 'Eren Yeager',
        nativeName: 'エレン・イェーガー',
        image: 'https://s4.anilist.co/file/anilistcdn/character/large/b40882.jpg',
      },
      { id: 40883, name: 'Armin Arlert' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = requestBody();
    expect(body.variables).toEqual({ id: 16498, perPage: 50 });
    expect(body.query).toContain('sort: [ROLE, RELEVANCE]');
    expect(body.query).toContain('nodes { id name { full native } image { large } }');
    expect(fetchMock.mock.calls[0][0]).toBe(ANILIST_ENDPOINT);
  });

  it('clamps perPage above the AniList maximum of 50', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(charactersPayload([])));

    await fetchMediaCharacters(1, 500);

    expect(requestBody().variables).toEqual({ id: 1, perPage: 50 });
  });

  it('clamps perPage below 1', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(charactersPayload([])));

    await fetchMediaCharacters(2, 0);

    expect(requestBody().variables).toEqual({ id: 2, perPage: 1 });
  });

  it('returns an empty list for an invalid media id without a request', async () => {
    const results = await Promise.all([
      fetchMediaCharacters(0),
      fetchMediaCharacters(-7),
      fetchMediaCharacters(Number.NaN),
      fetchMediaCharacters(Number.POSITIVE_INFINITY),
    ]);

    expect(results).toEqual([[], [], [], []]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves a repeated request from the module cache', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(charactersPayload([{ id: 40882, name: { full: 'Eren Yeager' }, image: { large: 'https://img/eren.jpg' } }])),
    );

    const first = await fetchMediaCharacters(16498);
    const second = await fetchMediaCharacters(16498);

    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(jsonResponse(charactersPayload([{ id: 1, name: { full: 'Levi Ackerman' } }])));

    await expect(fetchMediaCharacters(16498)).rejects.toBeInstanceOf(AniListError);

    const characters = await fetchMediaCharacters(16498);

    expect(characters).toEqual([{ id: 1, name: 'Levi Ackerman' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
