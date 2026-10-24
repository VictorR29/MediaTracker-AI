import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MediaItem } from '../../types';
import {
  MANHWAWEB_READ_LINK_TITLE,
  applyManhwaWebLink,
  fetchManhwaWebDetail,
  searchManhwaWeb,
} from '../manhwawebService';
import type { ManhwaWebDetail } from '../manhwawebService';

// --- Fixtures -----------------------------------------------------------------

const indexEntry = (overrides: Record<string, unknown> = {}) => {
  const id = typeof overrides._id === 'string' ? overrides._id : 'solo-leveling-ragnarok_1783909089054';
  return {
    _id: id,
    real_id: id,
    _imagen: 'https://img2mw.xyz/cover.webp',
    _status: 'publicandose',
    _numero_cap: 68.05,
    _tipo: 'manhwa',
    _erotico: 'no',
    _demografi: 'shonen',
    the_real_name: 'Solo Leveling: Ragnarok',
    name_esp: 'Solo Leveling: Ragnarok',
    ...overrides,
  };
};

const detailPayload = (overrides: Record<string, unknown> = {}) => ({
  _id: 'solo-leveling-ragnarok_1783909089054',
  _imagen: 'https://img2mw.xyz/cover.webp',
  _status: 'publicandose',
  _numero_cap: 68.05,
  _sinopsis: 'La existencia de la Tierra se ve amenazada una vez más.',
  _categoris: [{ '1': 'Drama' }, { '3': 'Accion' }, { '18': 'Comedia' }],
  _extras: { autores: ['DAUL (다울)'], hiatus: false },
  _erotico: 'no',
  the_real_name: 'Solo Leveling: Ragnarok',
  name_esp: 'Solo Leveling: Ragnarok',
  name_raw: '나 혼자만 레벨업 : 라그나로크',
  ...overrides,
});

const jsonResponse = (payload: unknown): Response =>
  ({ ok: true, status: 200, json: async () => payload }) as unknown as Response;

const errorResponse = (status: number): Response =>
  ({ ok: false, status, json: async () => ({}) }) as unknown as Response;

const makeItem = (
  aiData: Partial<MediaItem['aiData']> = {},
  trackingData: Partial<MediaItem['trackingData']> = {},
): MediaItem => ({
  id: 'local-1',
  aiData: {
    title: 'Solo Leveling: Ragnarok',
    mediaType: 'Manhwa',
    synopsis: '',
    genres: ['Accion'],
    status: 'En emisión',
    totalContent: '68 Capítulos',
    coverDescription: 'Cover',
    coverImage: 'https://img.example/local.jpg',
    ...aiData,
  },
  trackingData: {
    status: 'Viendo/Leyendo',
    currentSeason: 1,
    totalSeasons: 1,
    watchedEpisodes: 0,
    totalEpisodesInSeason: 68,
    emotionalTags: [],
    favoriteCharacters: [],
    rating: '',
    comment: '',
    ...trackingData,
  },
  createdAt: 1_000,
});

const detail = (overrides: Partial<ManhwaWebDetail> = {}): ManhwaWebDetail => ({
  slug: 'solo-leveling-ragnarok_1783909089054',
  title: 'Solo Leveling: Ragnarok',
  coverImage: 'https://img2mw.xyz/cover.webp',
  chapters: 68.05,
  status: 'publicandose',
  synopsis: 'La existencia de la Tierra se ve amenazada una vez más.',
  genres: ['Drama', 'Accion', 'Comedia'],
  authors: ['DAUL (다울)'],
  readUrl: 'https://manhwaweb.com/manhwa/solo-leveling-ragnarok_1783909089054',
  ...overrides,
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- Search -------------------------------------------------------------------

describe('searchManhwaWeb', () => {
  it('requests the manhwa catalog with the non-adult filter and the encoded query', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [indexEntry()], next: false }));

    await searchManhwaWeb('Solo Leveling');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('https://api.manhwaweb.com/manhwa/library?');
    expect(url).toContain('tipo=manhwa');
    expect(url).toContain('erotico=no');
    expect(url).toContain('buscar=Solo%20Leveling');
  });

  it('prefers real_id over _id, because the detail endpoint only accepts real_id', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          indexEntry({
            _id: 'comic-el-chetado_1',
            real_id: 'comic-solo_leveling_1',
            the_real_name: 'Solo Leveling',
          }),
        ],
        next: false,
      }),
    );

    const [candidate] = await searchManhwaWeb('solo');

    expect(candidate.slug).toBe('comic-solo_leveling_1');
  });

  it('drops an adult entry defensively', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          indexEntry({ _id: 'adult_1', the_real_name: 'Adult Work', _erotico: 'si' }),
          indexEntry({ _id: 'safe_1', the_real_name: 'Safe Work' }),
        ],
        next: false,
      }),
    );

    const results = await searchManhwaWeb('work');

    expect(results.map(candidate => candidate.slug)).toEqual(['safe_1']);
  });

  it('omits spanishTitle when it equals the canonical title', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          indexEntry({ _id: 'same_1', the_real_name: 'Same Title', name_esp: 'Same Title' }),
          indexEntry({ _id: 'diff_1', the_real_name: 'Other Title', name_esp: 'Otro Título' }),
        ],
        next: false,
      }),
    );

    const [same, different] = await searchManhwaWeb('title');

    expect(same.spanishTitle).toBeUndefined();
    expect(different.spanishTitle).toBe('Otro Título');
  });

  it('skips malformed entries instead of failing the whole list', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [null, { _erotico: 'no' }, indexEntry({ _id: 'ok_1', the_real_name: 'OK' })],
        next: false,
      }),
    );

    const results = await searchManhwaWeb('ok');

    expect(results).toHaveLength(1);
    expect(results[0].slug).toBe('ok_1');
  });

  it('returns an empty list without any request for an empty query', async () => {
    const results = await searchManhwaWeb('   ');

    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honours the limit argument', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: ['a', 'b', 'c'].map(slug => indexEntry({ _id: slug, the_real_name: slug })),
        next: false,
      }),
    );

    const results = await searchManhwaWeb('x', 2);

    expect(results).toHaveLength(2);
  });

  it('throws with the status when the response is not ok', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(503));

    await expect(searchManhwaWeb('x')).rejects.toThrow('503');
  });
});

// --- Detail -------------------------------------------------------------------

describe('fetchManhwaWebDetail', () => {
  it('maps synopsis, genres, authors and builds the read url', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(detailPayload()));

    const result = await fetchManhwaWebDetail('solo-leveling-ragnarok_1783909089054');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.manhwaweb.com/manhwa/see/solo-leveling-ragnarok_1783909089054',
    );
    expect(result.synopsis).toBe('La existencia de la Tierra se ve amenazada una vez más.');
    expect(result.genres).toEqual(['Drama', 'Accion', 'Comedia']);
    expect(result.authors).toEqual(['DAUL (다울)']);
    expect(result.readUrl).toBe(
      'https://manhwaweb.com/manhwa/solo-leveling-ragnarok_1783909089054',
    );
  });

  it('encodes the slug in both the request and the read url', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(detailPayload({ _id: 'a b' })));

    const result = await fetchManhwaWebDetail('a b');

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.manhwaweb.com/manhwa/see/a%20b');
    expect(result.readUrl).toBe('https://manhwaweb.com/manhwa/a%20b');
  });
});

// --- Pure link attach ---------------------------------------------------------

describe('applyManhwaWebLink', () => {
  it('appends the link once and is idempotent on a second call', () => {
    const item = makeItem();

    const once = applyManhwaWebLink(item, detail(), { id: 'link-1' });
    const twice = applyManhwaWebLink(once, detail(), { id: 'link-2' });

    expect(once.trackingData.customLinks).toEqual([
      {
        id: 'link-1',
        url: 'https://manhwaweb.com/manhwa/solo-leveling-ragnarok_1783909089054',
        title: MANHWAWEB_READ_LINK_TITLE,
      },
    ]);
    expect(twice.trackingData.customLinks).toHaveLength(1);
    expect(twice.trackingData.customLinks?.[0].id).toBe('link-1');
  });

  it('keeps existing custom links and does not mutate the input', () => {
    const item = makeItem({}, { customLinks: [{ id: 'old', url: 'https://example.com', title: 'Web' }] });

    const linked = applyManhwaWebLink(item, detail(), { id: 'link-1' });

    expect(linked.trackingData.customLinks).toHaveLength(2);
    expect(linked.trackingData.customLinks?.[0]).toEqual({ id: 'old', url: 'https://example.com', title: 'Web' });
    expect(item.trackingData.customLinks).toHaveLength(1);
  });

  it('fills an empty or whitespace synopsis', () => {
    expect(applyManhwaWebLink(makeItem({ synopsis: '' }), detail()).aiData.synopsis).toBe(
      'La existencia de la Tierra se ve amenazada una vez más.',
    );
    expect(applyManhwaWebLink(makeItem({ synopsis: '   ' }), detail()).aiData.synopsis).toBe(
      'La existencia de la Tierra se ve amenazada una vez más.',
    );
  });

  it('never overwrites a non-empty synopsis', () => {
    const linked = applyManhwaWebLink(makeItem({ synopsis: 'Sinopsis propia' }), detail());

    expect(linked.aiData.synopsis).toBe('Sinopsis propia');
  });

  it('leaves title, cover and genres untouched', () => {
    const item = makeItem();
    const linked = applyManhwaWebLink(item, detail());

    expect(linked.aiData.title).toBe(item.aiData.title);
    expect(linked.aiData.coverImage).toBe(item.aiData.coverImage);
    expect(linked.aiData.genres).toBe(item.aiData.genres);
  });
});
