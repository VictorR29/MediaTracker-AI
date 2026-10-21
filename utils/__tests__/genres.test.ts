import { describe, it, expect } from 'vitest';
import type { MediaItem } from '../../types';
import { getGenres } from '../genres';

// --- Fixtures -----------------------------------------------------------------

const makeItem = (genres: string[] | undefined, anilistGenres?: unknown): MediaItem => ({
  id: 'local-1',
  aiData: {
    title: 'Default Title',
    mediaType: 'Anime',
    synopsis: 'A synopsis',
    genres: genres as string[],
    status: 'En emisión',
    totalContent: '1 Temporada',
    coverDescription: 'Cover',
    ...(anilistGenres === undefined
      ? {}
      : {
          anilist: {
            id: 16498,
            matchedTitle: 'Shingeki no Kyojin',
            matchedBy: 'title' as const,
            confidence: 'exact' as const,
            resolvedAt: 1_000,
            genres: anilistGenres as string[],
          },
        }),
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
  createdAt: 1_000,
});

// --- Tests --------------------------------------------------------------------

describe('getGenres', () => {
  it('maps linked AniList genres through the genre dictionary', () => {
    const item = makeItem(['Action'], ['Sci-Fi', 'Slice of Life']);

    expect(getGenres(item)).toEqual(['ciencia ficción', 'recuentos de la vida']);
  });

  it('returns AI genres verbatim when the work is not linked', () => {
    const item = makeItem(['Action', 'Sci-Fi']);

    expect(getGenres(item)).toEqual(['Action', 'Sci-Fi']);
  });

  it('falls back to AI genres when the AniList genre list is empty', () => {
    const item = makeItem(['Action'], []);

    expect(getGenres(item)).toEqual(['Action']);
  });

  it('drops blank and whitespace-only AniList entries', () => {
    const item = makeItem(['Action'], ['', '   ', 'Drama']);

    expect(getGenres(item)).toEqual(['drama']);
  });

  it('removes duplicates after normalization', () => {
    const item = makeItem(['Action'], ['Action', 'action', 'ACTION', 'Drama']);

    expect(getGenres(item)).toEqual(['acción', 'drama']);
  });

  it('ignores non-string AniList entries', () => {
    const item = makeItem(['Action'], [null, 42, { name: 'Drama' }, 'Comedy']);

    expect(getGenres(item)).toEqual(['comedia']);
  });

  it('returns an empty array when both sources are missing', () => {
    expect(getGenres(makeItem(undefined))).toEqual([]);
  });

  it('never returns the persisted array reference', () => {
    const aiGenres = ['Action', 'Drama'];
    const linkedGenres = ['Action', 'Drama'];

    const aiResult = getGenres(makeItem(aiGenres));
    const linkedResult = getGenres(makeItem([], linkedGenres));

    expect(aiResult).not.toBe(aiGenres);
    expect(aiResult).toEqual(aiGenres);
    expect(linkedResult).not.toBe(linkedGenres);
  });
});
