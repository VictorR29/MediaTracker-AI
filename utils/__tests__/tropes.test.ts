import { describe, it, expect } from 'vitest';
import type { MediaItem } from '../../types';
import { TROPE_MAP, getTropes, normalizeTrope } from '../tropes';

// --- Fixtures -----------------------------------------------------------------

interface AniListFixture {
  genres?: string[];
  tags?: { name: string; rank?: number }[];
}

const makeItem = (genres: string[] | undefined, anilist?: AniListFixture): MediaItem => ({
  id: 'local-1',
  aiData: {
    title: 'Default Title',
    mediaType: 'Anime',
    synopsis: 'A synopsis',
    genres: genres as string[],
    status: 'En emisión',
    totalContent: '1 Temporada',
    coverDescription: 'Cover',
    ...(anilist === undefined
      ? {}
      : {
          anilist: {
            id: 16498,
            matchedTitle: 'Shingeki no Kyojin',
            matchedBy: 'title' as const,
            confidence: 'exact' as const,
            resolvedAt: 1_000,
            ...(anilist.genres === undefined ? {} : { genres: anilist.genres }),
            ...(anilist.tags === undefined ? {} : { tags: anilist.tags }),
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

// --- normalizeTrope -----------------------------------------------------------

describe('normalizeTrope', () => {
  it('maps a known AniList tag to its canonical Spanish label', () => {
    expect(normalizeTrope('Time Loop')).toBe('bucle temporal');
    expect(normalizeTrope('Isekai')).toBe('isekai');
    expect(normalizeTrope('Battle Royale')).toBe('battle royale');
  });

  it('trims and lowercases before looking the tag up', () => {
    expect(normalizeTrope('  REVERSE HAREM  ')).toBe('harem inverso');
  });

  it('drops unknown tag names instead of passing them through', () => {
    expect(normalizeTrope('Supernatural')).toBeNull();
    expect(normalizeTrope('Some Community Tag Nobody Curated')).toBeNull();
    expect(TROPE_MAP).not.toHaveProperty('supernatural');
  });

  it('drops blank, whitespace-only and non-string values', () => {
    expect(normalizeTrope('')).toBeNull();
    expect(normalizeTrope('   ')).toBeNull();
    expect(normalizeTrope(null as unknown as string)).toBeNull();
    expect(normalizeTrope(42 as unknown as string)).toBeNull();
  });

  it('accepts an already-canonical value and is idempotent', () => {
    const once = normalizeTrope('Time Loop');

    expect(once).toBe('bucle temporal');
    expect(normalizeTrope(once!)).toBe(once);
    expect(normalizeTrope(normalizeTrope('Time Loop')!)).toBe('bucle temporal');
  });
});

// --- getTropes ----------------------------------------------------------------

describe('getTropes', () => {
  it('maps AniList tags through the curated vocabulary', () => {
    const item = makeItem([], { tags: [{ name: 'Isekai' }, { name: 'Time Loop' }] });

    expect(getTropes(item)).toEqual(['isekai', 'bucle temporal']);
  });

  it('prefers AniList tags over legacy aiData.genres when tags exist', () => {
    const item = makeItem(['Isekai', 'Fantasía'], { tags: [{ name: 'Harem' }] });

    expect(getTropes(item)).toEqual(['harem']);
  });

  it('falls back to aiData.genres when AniList tags are absent', () => {
    const item = makeItem(['Isekai', 'Acción']);

    expect(getTropes(item)).toEqual(['isekai']);
  });

  it('falls back to legacy sources when AniList tags are empty', () => {
    const item = makeItem(['Isekai'], { genres: ['Drama'], tags: [] });

    expect(getTropes(item)).toEqual(['isekai']);
  });

  it('reads legacy anilist.genres too, not only aiData.genres', () => {
    const item = makeItem([], { genres: ['Isekai', 'Drama'] });

    expect(getTropes(item)).toEqual(['isekai']);
  });

  it('dedupes across sources and spellings', () => {
    const item = makeItem(['Isekai'], { genres: ['ISEKAI', 'isekai'] });

    expect(getTropes(item)).toEqual(['isekai']);
  });

  it('dedupes duplicate AniList tags', () => {
    const item = makeItem([], { tags: [{ name: 'Isekai' }, { name: 'isekai' }, { name: 'ISEKAI' }] });

    expect(getTropes(item)).toEqual(['isekai']);
  });

  it('drops unknown, blank and non-string candidates', () => {
    const item = makeItem(['Isekai', '', '   ', null as unknown as string, 42 as unknown as string], {
      tags: [{ name: '  ' }, { name: 'Supernatural' }, { name: 'Harem' }],
    });

    expect(getTropes(item)).toEqual(['harem']);
  });

  it('returns an empty array when nothing matches the vocabulary', () => {
    expect(getTropes(makeItem(['Acción', 'Drama']))).toEqual([]);
    expect(getTropes(makeItem(undefined))).toEqual([]);
  });

  it('never returns a persisted array reference', () => {
    const aiGenres = ['Isekai'];
    const tags = [{ name: 'Isekai' }];

    const fallbackResult = getTropes(makeItem(aiGenres));
    const taggedResult = getTropes(makeItem([], { tags }));

    expect(fallbackResult).not.toBe(aiGenres);
    expect(taggedResult).not.toBe(tags);

    // Mutating the result must not leak back into the item.
    fallbackResult.push('harem');
    taggedResult.push('harem');

    expect(getTropes(makeItem(aiGenres))).toEqual(['isekai']);
    expect(getTropes(makeItem([], { tags }))).toEqual(['isekai']);
  });
});
