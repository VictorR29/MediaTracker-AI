import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AIWorkData } from '../../types';
import {
  TVMAZE_API_BASE,
  TvmazeError,
  __clearTvmazeCacheForTests,
  __resetTvmazeThrottleForTests,
  __setTvmazeThrottleForTests,
  applyTvmazeMetadata,
  fetchTvmazeShow,
  searchTvmazeShow,
} from '../tvmazeService';
import type { TvmazeMatch } from '../tvmazeService';

// --- Fixtures -----------------------------------------------------------------

interface ShowFixture {
  id?: number;
  name?: string;
  language?: string | null;
  premiered?: string | null;
  ended?: string | null;
  status?: string | null;
  genres?: string[];
  rating?: number | null;
  network?: { name: string; country?: { name: string } | null } | null;
  webChannel?: { name: string; country?: { name: string } | null } | null;
  imageOriginal?: string | null;
  imageMedium?: string | null;
  summary?: string | null;
  seasons?: number[];
}

const makeShow = (fixture: ShowFixture = {}) => ({
  id: fixture.id ?? 22557,
  name: fixture.name ?? 'El Marginal',
  language: fixture.language === undefined ? 'Spanish' : fixture.language,
  premiered: fixture.premiered === undefined ? '2016-06-02' : fixture.premiered,
  ended: fixture.ended === undefined ? null : fixture.ended,
  status: fixture.status === undefined ? 'Running' : fixture.status,
  genres: fixture.genres ?? ['Drama', 'Crime'],
  rating: { average: fixture.rating === undefined ? 8.2 : fixture.rating },
  network: fixture.network === undefined ? { name: 'Televisión Pública', country: { name: 'Argentina' } } : fixture.network,
  webChannel: fixture.webChannel ?? null,
  image: {
    medium: fixture.imageMedium === undefined ? 'https://static.tvmaze.com/medium.jpg' : fixture.imageMedium,
    original: fixture.imageOriginal === undefined ? 'https://static.tvmaze.com/original.jpg' : fixture.imageOriginal,
  },
  summary: fixture.summary === undefined ? '<p>Un <b>policial</b> carcelario.</p>' : fixture.summary,
  _embedded: fixture.seasons
    ? { episodes: fixture.seasons.map((season, index) => ({ season, number: index + 1 })) }
    : undefined,
});

const searchPayload = (entries: { score?: number; show: ReturnType<typeof makeShow> }[]) =>
  entries.map(entry => ({ score: entry.score ?? 0.9, show: entry.show }));

const jsonResponse = (data: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => data }) as unknown as Response;

const statusResponse = (status: number): Response =>
  ({ ok: false, status, json: async () => ({}) }) as unknown as Response;

const makeAiData = (overrides: Partial<AIWorkData> = {}): AIWorkData => ({
  title: 'El Marginal',
  mediaType: 'Serie',
  synopsis: 'Sinopsis no disponible.',
  genres: [],
  status: 'Desconocido',
  totalContent: 'inventado por gemini',
  coverDescription: 'Un policial carcelario',
  coverImage: '',
  ...overrides,
});

const makeMatch = (overrides: Partial<TvmazeMatch> = {}): TvmazeMatch => ({
  id: 22557,
  name: 'El Marginal',
  language: 'Spanish',
  premiered: '2016-06-02',
  status: 'En emisión',
  genres: ['Drama', 'Crime'],
  image: 'https://static.tvmaze.com/original.jpg',
  synopsis: 'Un policial carcelario.',
  network: 'Televisión Pública',
  country: 'Argentina',
  totalEpisodes: 43,
  seasons: 5,
  ...overrides,
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  // Production spacing is 500ms; tests must not wait for it.
  __setTvmazeThrottleForTests(0);
  __clearTvmazeCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  __resetTvmazeThrottleForTests();
});

// --- Search -------------------------------------------------------------------

describe('searchTvmazeShow', () => {
  it('requests /search/shows with the URL-encoded query and maps the payload', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(searchPayload([{ show: makeShow() }])));

    const match = await searchTvmazeShow('El Marginal');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${TVMAZE_API_BASE}/search/shows?q=El%20Marginal`);
    expect(match).toMatchObject({
      id: 22557,
      name: 'El Marginal',
      language: 'Spanish',
      premiered: '2016-06-02',
      status: 'En emisión',
      genres: ['Drama', 'Crime'],
      rating: 8.2,
      image: 'https://static.tvmaze.com/original.jpg',
      network: 'Televisión Pública',
      country: 'Argentina',
    });
  });

  it('returns null for an empty query without any request', async () => {
    expect(await searchTvmazeShow('')).toBeNull();
    expect(await searchTvmazeShow('   ')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('translates the broadcast status into the app Spanish labels', async () => {
    const cases: [string, string | undefined][] = [
      ['Running', 'En emisión'],
      ['Ended', 'Finalizado'],
      ['To Be Determined', 'Por confirmar'],
      ['In Development', 'En desarrollo'],
      // An enum member we do not know must not leak English into the UI.
      ['Something New', undefined],
    ];

    for (const [raw, expected] of cases) {
      __clearTvmazeCacheForTests();
      fetchMock.mockResolvedValueOnce(jsonResponse(searchPayload([{ show: makeShow({ status: raw }) }])));
      const match = await searchTvmazeShow('El Marginal');
      expect(match?.status).toBe(expected);
    }
  });

  it('returns null for an empty result set', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    expect(await searchTvmazeShow('asdkjhasd nonsense')).toBeNull();
  });

  it('returns null for an HTTP 404 instead of throwing', async () => {
    fetchMock.mockResolvedValueOnce(statusResponse(404));

    expect(await searchTvmazeShow('El Marginal')).toBeNull();
  });

  it('rejects a fuzzy guess whose name does not match the query', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(searchPayload([{ show: makeShow({ id: 1, name: 'Breaking Bad' }) }])));

    expect(await searchTvmazeShow('Solo Leveling')).toBeNull();
  });

  it('accepts an exact match and a containing match', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(searchPayload([{ show: makeShow({ id: 10, name: 'Okupas' }) }])))
      .mockResolvedValueOnce(
        jsonResponse(searchPayload([{ show: makeShow({ id: 11, name: 'División Palermo (Serie de TV)' }) }])),
      );

    expect((await searchTvmazeShow('Okupas'))?.id).toBe(10);
    expect((await searchTvmazeShow('Division Palermo'))?.id).toBe(11);
  });

  it('picks the highest score among the accepted candidates', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        searchPayload([
          { score: 0.4, show: makeShow({ id: 1, name: 'El Marginal 2' }) },
          { score: 0.9, show: makeShow({ id: 2, name: 'El Marginal' }) },
        ]),
      ),
    );

    expect((await searchTvmazeShow('El Marginal'))?.id).toBe(2);
  });

  it('strips the HTML summary and decodes the common entities', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        searchPayload([
          {
            show: makeShow({
              summary: '<p>Policial &amp; carcelario &lt;crudo&gt; &quot;real&quot;</p><b>Un &#39;clásico&#39;.</b>&nbsp;Fin',
            }),
          },
        ]),
      ),
    );

    const match = await searchTvmazeShow('El Marginal');

    expect(match?.synopsis).toBe('Policial & carcelario <crudo> "real" Un \'clásico\'. Fin');
  });

  it('serves a repeated lookup from the cache without a second request', async () => {
    fetchMock.mockResolvedValue(jsonResponse(searchPayload([{ show: makeShow() }])));

    await searchTvmazeShow('El Marginal');
    await searchTvmazeShow('el marginal');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches a miss so a repeated deck run costs nothing', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    expect(await searchTvmazeShow('Nada Que Ver')).toBeNull();
    expect(await searchTvmazeShow('Nada Que Ver')).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// --- Detail -------------------------------------------------------------------

describe('fetchTvmazeShow', () => {
  it('requests the episode list with embed[]=episodes and derives the counts', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeShow({
          // Season 0 is a special: neither a season nor an episode of the run.
          seasons: [0, 1, 1, 2, 2, 2, 3],
        }),
      ),
    );

    const match = await fetchTvmazeShow(22557);

    expect(fetchMock.mock.calls[0][0]).toBe(`${TVMAZE_API_BASE}/shows/22557?embed[]=episodes`);
    expect(match?.totalEpisodes).toBe(6);
    expect(match?.seasons).toBe(3);
  });

  it('derives firstSeasonEpisodes from season 1 only', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        // Season 0 is a special and season 2+ belongs to the rest of the run.
        makeShow({ seasons: [0, 1, 1, 1, 2, 2, 3] }),
      ),
    );

    const match = await fetchTvmazeShow(22557);

    expect(match?.firstSeasonEpisodes).toBe(3);
    expect(match?.totalEpisodes).toBe(6);
    expect(match?.seasons).toBe(3);
  });

  it('leaves firstSeasonEpisodes undefined when there is no season 1', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeShow({ seasons: [0, 2, 2] })));

    const match = await fetchTvmazeShow(22557);

    expect(match?.firstSeasonEpisodes).toBeUndefined();
    expect(match?.seasons).toBe(1);
  });

  it('leaves the counts undefined when the payload has no episodes', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeShow()));

    const match = await fetchTvmazeShow(22557);

    expect(match?.totalEpisodes).toBeUndefined();
    expect(match?.seasons).toBeUndefined();
  });

  it('serves a repeated id from the cache', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeShow({ seasons: [1, 1] })));

    await fetchTvmazeShow(22557);
    await fetchTvmazeShow(22557);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores a non-positive or non-numeric id without any request', async () => {
    expect(await fetchTvmazeShow(0)).toBeNull();
    expect(await fetchTvmazeShow(Number.NaN)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// --- Rate limiting ------------------------------------------------------------

describe('rate limiting', () => {
  it('retries a 429 exactly once and then throws with the status', async () => {
    fetchMock.mockResolvedValue(statusResponse(429));

    await expect(searchTvmazeShow('El Marginal')).rejects.toBeInstanceOf(TvmazeError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns the payload when the single retry succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(statusResponse(429))
      .mockResolvedValueOnce(jsonResponse(searchPayload([{ show: makeShow() }])));

    const match = await searchTvmazeShow('El Marginal');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(match?.id).toBe(22557);
  });
});

// --- Pure projection ----------------------------------------------------------

describe('applyTvmazeMetadata', () => {
  it('fills the empty fields and records the TVmaze identity', () => {
    const aiData = makeAiData();
    const result = applyTvmazeMetadata(aiData, makeMatch());

    expect(result.coverImage).toBe('https://static.tvmaze.com/original.jpg');
    expect(result.genres).toEqual(['Drama', 'Crime']);
    expect(result.status).toBe('En emisión');
    // TVmaze only serves English summaries, so the synopsis is never copied.
    expect(result.synopsis).toBe('Sinopsis no disponible.');
    expect(result.releaseDate).toBe('2016-06-02');
    expect(result.tvmaze).toEqual({ id: 22557 });
    expect(result).not.toBe(aiData);
  });

  it('never overwrites a cover, genres, status, dates or synopsis the user owns', () => {
    const aiData = makeAiData({
      coverImage: 'data:image/webp;base64,USER',
      genres: ['Policial'],
      status: 'Finalizado',
      synopsis: 'Mi propia sinopsis.',
      releaseDate: '2020-01-01',
      endDate: '2021-01-01',
    });

    const result = applyTvmazeMetadata(aiData, makeMatch({ ended: '2022-01-01' }));

    expect(result.coverImage).toBe('data:image/webp;base64,USER');
    expect(result.genres).toEqual(['Policial']);
    expect(result.status).toBe('Finalizado');
    expect(result.synopsis).toBe('Mi propia sinopsis.');
    expect(result.releaseDate).toBe('2020-01-01');
    expect(result.endDate).toBe('2021-01-01');
  });

  it('treats "Desconocido" as an empty status but never fills the synopsis', () => {
    const result = applyTvmazeMetadata(
      makeAiData({ status: 'Desconocido', synopsis: 'Sinopsis no disponible.' }),
      makeMatch(),
    );

    expect(result.status).toBe('En emisión');
    expect(result.synopsis).toBe('Sinopsis no disponible.');
  });

  it('never touches totalContent without overwrite', () => {
    const result = applyTvmazeMetadata(makeAiData(), makeMatch({ totalEpisodes: 43, seasons: 5 }));

    expect(result.totalContent).toBe('inventado por gemini');
  });

  it('replaces totalContent with overwrite and a positive episode count', () => {
    const result = applyTvmazeMetadata(makeAiData(), makeMatch({ totalEpisodes: 43, seasons: 5 }), {
      overwrite: true,
    });

    expect(result.totalContent).toBe('5 Temporadas · 43 Caps');

    const single = applyTvmazeMetadata(makeAiData(), makeMatch({ totalEpisodes: 10, seasons: 1 }), {
      overwrite: true,
    });

    expect(single.totalContent).toBe('1 Temporada · 10 Caps');
  });

  it('keeps totalContent with overwrite when the episode count is missing or zero', () => {
    expect(
      applyTvmazeMetadata(makeAiData(), makeMatch({ totalEpisodes: undefined }), { overwrite: true }).totalContent,
    ).toBe('inventado por gemini');

    expect(
      applyTvmazeMetadata(makeAiData(), makeMatch({ totalEpisodes: 0 }), { overwrite: true }).totalContent,
    ).toBe('inventado por gemini');
  });

  it('never touches title, mediaType, sourceUrls, primaryColor or anilist', () => {
    const aiData = makeAiData({
      title: 'El Marginal',
      originalTitle: 'El Marginal (TV)',
      mediaType: 'Serie',
      sourceUrls: [{ title: 'Wikipedia', uri: 'https://example.com' }],
      primaryColor: '#c084fc',
      franchise_link: 'Marginal',
      coverDescription: 'Cárcel',
    });
    const anilist = { id: 1, matchedTitle: 'El Marginal', matchedBy: 'title' as const, confidence: 'exact' as const, resolvedAt: 1 };

    const result = applyTvmazeMetadata({ ...aiData, anilist }, makeMatch(), { overwrite: true });

    expect(result.title).toBe('El Marginal');
    expect(result.originalTitle).toBe('El Marginal (TV)');
    expect(result.mediaType).toBe('Serie');
    expect(result.sourceUrls).toEqual(aiData.sourceUrls);
    expect(result.primaryColor).toBe('#c084fc');
    expect(result.franchise_link).toBe('Marginal');
    expect(result.coverDescription).toBe('Cárcel');
    expect(result.anilist).toBe(anilist);
  });

  it('prefers the original image and falls back to the medium one', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(searchPayload([{ show: makeShow({ imageOriginal: 'https://static.tvmaze.com/original.jpg' }) }])))
      .mockResolvedValueOnce(jsonResponse(searchPayload([{ show: makeShow({ imageOriginal: null, imageMedium: 'https://static.tvmaze.com/medium.jpg' }) }])));

    expect((await searchTvmazeShow('El Marginal'))?.image).toBe('https://static.tvmaze.com/original.jpg');
    expect((await searchTvmazeShow('El Marginal 2'))?.image).toBe('https://static.tvmaze.com/medium.jpg');
  });
});
