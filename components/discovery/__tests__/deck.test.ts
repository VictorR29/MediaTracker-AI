import { describe, it, expect } from 'vitest';
import { ANILIST_GENRES } from '../../../services/anilistDiscovery';
import type { DiscoveryCandidate } from '../../../services/anilistDiscovery';
import { MOOD_OPTIONS } from '../constants';
import {
  MOOD_GENRES,
  MOOD_TAGS,
  buildDiscoveryItem,
  buildSerieItem,
  formatCardMeta,
  formatReason,
  getMoodGenres,
  getMoodTags,
  toAniListDeckCard,
} from '../deck';
import type { AiDeckCard, AniListDeckCard } from '../types';
import type { TvmazeMatch } from '../../../services/tvmazeService';

const deckCard = (overrides: Partial<AniListDeckCard> = {}): AniListDeckCard => ({
  kind: 'anilist',
  anilistId: 1,
  title: 'Cowboy Bebop',
  mediaType: 'Anime',
  synopsis: '',
  reason: '',
  genres: [],
  ...overrides,
});

const candidate = (overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate => ({
  anilistId: 16498,
  title: 'Attack on Titan',
  alternateTitle: 'Shingeki no Kyojin',
  coverImage: 'https://img.example/16498.jpg',
  color: '#3b4a6b',
  genres: ['Action', 'Drama', 'Fantasy'],
  tags: [
    { name: 'Tragedy', rank: 90 },
    { name: 'Military', rank: 70 },
  ],
  format: 'TV',
  episodes: 25,
  status: 'FINISHED',
  seasonYear: 2013,
  synopsis: 'Humanity fights for survival behind giant walls.',
  recommendedBy: ['Death Note', 'Code Geass'],
  votes: 120,
  popularity: 900000,
  ...overrides,
});

describe('MOOD_GENRES', () => {
  it('maps every mood label to canonical AniList genres', () => {
    for (const option of MOOD_OPTIONS) {
      const genres = MOOD_GENRES[option.label];
      expect(genres, `missing mapping for "${option.label}"`).toBeDefined();
      expect(genres.length).toBeGreaterThan(0);

      for (const genre of genres) {
        expect(ANILIST_GENRES, `"${genre}" is not canonical`).toContain(genre);
      }
    }
  });

  it('does not invent labels that are missing from MOOD_OPTIONS', () => {
    const labels = new Set(MOOD_OPTIONS.map(option => option.label));
    for (const key of Object.keys(MOOD_GENRES)) {
      expect(labels).toContain(key);
    }
  });

  it('keeps the documented mapping for each mood', () => {
    expect(MOOD_GENRES['Quiero algo que me vuele la cabeza']).toEqual(['Mystery', 'Psychological', 'Thriller']);
    expect(MOOD_GENRES['Algo ligero para ver sin pensar']).toEqual(['Comedy', 'Slice of Life']);
    expect(MOOD_GENRES['Busco una historia que me rompa el corazón']).toEqual(['Drama', 'Romance']);
    expect(MOOD_GENRES['Necesito adrenalina pura y emoción']).toEqual(['Action', 'Thriller']);
    expect(MOOD_GENRES['Algo que me transporte a otro mundo']).toEqual(['Fantasy', 'Sci-Fi', 'Adventure']);
    expect(MOOD_GENRES['Quiero aprender o reflexionar sobre la vida']).toEqual(['Slice of Life', 'Drama', 'Psychological']);
    expect(MOOD_GENRES['Quiero sentir tensión y un poco de miedo']).toEqual(['Horror', 'Thriller', 'Mystery']);
    expect(MOOD_GENRES['Algo crudo, oscuro y realista']).toEqual(['Drama', 'Thriller', 'Psychological']);
  });
});

/**
 * Tag names dumped from the live `MediaTagCollection` (428 entries) and verified
 * to exist. Any name outside this set is an invention and must fail the test.
 */
const VERIFIED_TAG_NAMES = new Set([
  'Denpa', 'Time Loop', 'Time Manipulation', 'Alternate Universe', 'Memory Manipulation', 'Dissociative Identities', 'Philosophy',
  'Iyashikei', 'Episodic', 'Slapstick', 'Parody', 'Surreal Comedy',
  'Tragedy', 'Unrequited Love', 'Coming of Age', 'Family Life', 'Found Family',
  'Guns', 'Swordplay', 'Martial Arts', 'Battle Royale', 'Survival', 'Espionage',
  'Isekai', 'Magic', 'Fairy Tale', 'Virtual World', 'Space', 'Mythology',
  'Educational', 'Religion',
  'Cosmic Horror', 'Body Horror', 'Death Game', 'Ghost', 'Conspiracy',
  'Noir', 'Crime', 'Yakuza', 'Drugs', 'Mafia', 'Psychosexual',
]);

describe('MOOD_TAGS', () => {
  it('maps every mood label to 4-6 verified AniList tags', () => {
    for (const option of MOOD_OPTIONS) {
      const tags = MOOD_TAGS[option.label];
      expect(tags, `missing mapping for "${option.label}"`).toBeDefined();
      expect(tags.length).toBeGreaterThanOrEqual(4);
      expect(tags.length).toBeLessThanOrEqual(6);

      for (const tag of tags) {
        expect(VERIFIED_TAG_NAMES, `"${tag}" is not a verified AniList tag`).toContain(tag);
      }
    }
  });

  it('does not invent labels that are missing from MOOD_OPTIONS', () => {
    const labels = new Set(MOOD_OPTIONS.map(option => option.label));
    for (const key of Object.keys(MOOD_TAGS)) {
      expect(labels).toContain(key);
    }
  });
});

describe('getMoodTags', () => {
  it('returns the tags of every known mood', () => {
    for (const option of MOOD_OPTIONS) {
      expect(getMoodTags(option.label)).toEqual([...MOOD_TAGS[option.label]]);
    }
  });

  it('returns an empty list for null, undefined or unknown labels', () => {
    expect(getMoodTags(null)).toEqual([]);
    expect(getMoodTags(undefined)).toEqual([]);
    expect(getMoodTags('')).toEqual([]);
    expect(getMoodTags('Algo que no existe')).toEqual([]);
  });

  it('returns a copy so callers cannot mutate the mapping', () => {
    const tags = getMoodTags('Quiero algo que me vuele la cabeza');
    tags.push('Invention');
    expect(getMoodTags('Quiero algo que me vuele la cabeza')).toEqual([...MOOD_TAGS['Quiero algo que me vuele la cabeza']]);
  });
});

describe('getMoodGenres', () => {
  it('returns the genres of every known mood', () => {
    for (const option of MOOD_OPTIONS) {
      expect(getMoodGenres(option.label)).toEqual([...MOOD_GENRES[option.label]]);
    }
  });

  it('returns an empty list for null, undefined or unknown labels', () => {
    expect(getMoodGenres(null)).toEqual([]);
    expect(getMoodGenres(undefined)).toEqual([]);
    expect(getMoodGenres('')).toEqual([]);
    expect(getMoodGenres('Algo que no existe')).toEqual([]);
  });

  it('returns a copy so callers cannot mutate the mapping', () => {
    const genres = getMoodGenres('Necesito adrenalina pura y emoción');
    genres.push('Ecchi');
    expect(getMoodGenres('Necesito adrenalina pura y emoción')).toEqual(['Action', 'Thriller']);
  });
});

describe('formatReason', () => {
  it('returns an empty string when nothing recommended the title', () => {
    expect(formatReason([])).toBe('');
    expect(formatReason(['', '   '])).toBe('');
  });

  it('formats a single source', () => {
    expect(formatReason(['Death Note'])).toBe('Recomendada por fans de Death Note');
  });

  it('formats two sources', () => {
    expect(formatReason(['Death Note', 'Code Geass'])).toBe('Recomendada por fans de Death Note y Code Geass');
  });

  it('summarizes three sources as one extra', () => {
    expect(formatReason(['Death Note', 'Code Geass', 'Monster'])).toBe(
      'Recomendada por fans de Death Note, Code Geass y 1 más',
    );
  });

  it('summarizes four sources as two extra', () => {
    expect(formatReason(['Death Note', 'Code Geass', 'Monster', 'Steins;Gate'])).toBe(
      'Recomendada por fans de Death Note, Code Geass y 2 más',
    );
  });
});

describe('formatCardMeta', () => {
  it('joins format, year and episodes for a TV series', () => {
    expect(formatCardMeta(deckCard({ format: 'TV', seasonYear: 2013, episodes: 25 }))).toBe('TV · 2013 · 25 eps');
  });

  it('renders a movie without an episode count', () => {
    expect(formatCardMeta(deckCard({ format: 'MOVIE', seasonYear: 2019 }))).toBe('Película · 2019');
  });

  it('returns an empty string when the card has nothing but a title', () => {
    expect(formatCardMeta(deckCard())).toBe('');
  });

  it('translates known formats and falls back to the raw value', () => {
    expect(formatCardMeta(deckCard({ format: 'TV_SHORT' }))).toBe('TV corto');
    expect(formatCardMeta(deckCard({ format: 'SPECIAL' }))).toBe('Especial');
    expect(formatCardMeta(deckCard({ format: 'MUSIC' }))).toBe('MUSIC');
  });

  it('drops a zero or missing episode count', () => {
    expect(formatCardMeta(deckCard({ format: 'OVA', episodes: 0 }))).toBe('OVA');
    expect(formatCardMeta(deckCard({ format: 'ONA' }))).toBe('ONA');
  });

  it('shows caps for a chapter count and eps when only episodes exist', () => {
    expect(formatCardMeta(deckCard({ format: 'MANGA', seasonYear: 2018, chapters: 179 }))).toBe(
      'Manhwa · 2018 · 179 caps',
    );
    expect(formatCardMeta(deckCard({ format: 'TV', seasonYear: 2013, episodes: 25 }))).toBe('TV · 2013 · 25 eps');
    // Chapters win when a payload carries both: chapters are the reader's unit.
    expect(formatCardMeta(deckCard({ format: 'MANGA', chapters: 179, episodes: 12 }))).toBe('Manhwa · 179 caps');
  });

  it('falls back to eps when chapters is zero or missing', () => {
    expect(formatCardMeta(deckCard({ format: 'MANGA', chapters: 0, episodes: 12 }))).toBe('Manhwa · 12 eps');
    expect(formatCardMeta(deckCard({ format: 'MANGA' }))).toBe('Manhwa');
  });

  it('renders the MANGA format as Manhwa', () => {
    expect(formatCardMeta(deckCard({ format: 'MANGA' }))).toBe('Manhwa');
  });
});

describe('toAniListDeckCard', () => {
  it('maps every candidate field onto the deck card', () => {
    expect(toAniListDeckCard(candidate())).toEqual({
      kind: 'anilist',
      anilistId: 16498,
      title: 'Attack on Titan',
      alternateTitle: 'Shingeki no Kyojin',
      mediaType: 'Anime',
      synopsis: 'Humanity fights for survival behind giant walls.',
      reason: 'Recomendada por fans de Death Note y Code Geass',
      coverImage: 'https://img.example/16498.jpg',
      color: '#3b4a6b',
      genres: ['Action', 'Drama', 'Fantasy'],
      format: 'TV',
      episodes: 25,
      seasonYear: 2013,
      status: 'FINISHED',
    });
  });

  it('reports Anime for non-MANGA formats', () => {
    expect(toAniListDeckCard(candidate({ format: 'MOVIE' })).mediaType).toBe('Anime');
  });

  it('reports Manhwa for MANGA candidates', () => {
    expect(toAniListDeckCard(candidate({ format: 'MANGA', episodes: undefined, chapters: 179 })).mediaType).toBe(
      'Manhwa',
    );
  });

  it('builds the reason from an empty recommendedBy list', () => {
    expect(toAniListDeckCard(candidate({ recommendedBy: [] })).reason).toBe('');
  });

  it('prefers a curated reason over the fan-credit line', () => {
    const card = toAniListDeckCard(candidate({ reason: 'Su tensión constante encaja con esa sed de adrenalina.' }));
    expect(card.reason).toBe('Su tensión constante encaja con esa sed de adrenalina.');
  });

  it('falls back to the fan-credit line when no curated reason is present', () => {
    expect(toAniListDeckCard(candidate({ reason: undefined })).reason).toBe(
      'Recomendada por fans de Death Note y Code Geass',
    );
  });

  it('copies genres instead of sharing the candidate array', () => {
    const source = candidate();
    const card = toAniListDeckCard(source);
    card.genres.push('Ecchi');
    expect(source.genres).toEqual(['Action', 'Drama', 'Fantasy']);
  });

  it('copies the chapter count onto the card', () => {
    const card = toAniListDeckCard(candidate({ format: 'MANGA', episodes: undefined, chapters: 179 }));
    expect(card.chapters).toBe(179);
    expect(card.episodes).toBeUndefined();
  });
});

describe('buildDiscoveryItem', () => {
  it('stores an anime deck card as an Anime item with an episode count', () => {
    const item = buildDiscoveryItem(deckCard({ format: 'TV', episodes: 25, seasonYear: 2013 }), {
      id: 'item-1',
      now: 1000,
    });

    expect(item.id).toBe('item-1');
    expect(item.createdAt).toBe(1000);
    expect(item.aiData.mediaType).toBe('Anime');
    expect(item.aiData.totalContent).toBe('25 episodios');
    expect(item.trackingData.totalEpisodesInSeason).toBe(25);
    expect(item.aiData.anilist?.resolvedAt).toBe(1000);
  });

  it('stores a manhwa deck card as a Manhwa item with a chapter count', () => {
    const item = buildDiscoveryItem(
      deckCard({ format: 'MANGA', mediaType: 'Manhwa', chapters: 179, episodes: undefined }),
    );

    expect(item.aiData.mediaType).toBe('Manhwa');
    expect(item.aiData.totalContent).toBe('179 Capítulos');
    expect(item.trackingData.totalEpisodesInSeason).toBe(179);
  });

  it('leaves the chapter count empty when AniList reports none', () => {
    const item = buildDiscoveryItem(deckCard({ format: 'MANGA', mediaType: 'Manhwa' }));

    expect(item.aiData.totalContent).toBe('');
    expect(item.trackingData.totalEpisodesInSeason).toBe(0);
  });

  it('keeps a movie at zero seasons and zero progress capacity', () => {
    const item = buildDiscoveryItem(deckCard({ format: 'MOVIE', episodes: undefined }));

    expect(item.aiData.totalContent).toBe('');
    expect(item.trackingData.currentSeason).toBe(0);
    expect(item.trackingData.totalSeasons).toBe(0);
    expect(item.trackingData.totalEpisodesInSeason).toBe(0);
  });

  it('links the item to its AniList id as a manual match', () => {
    const item = buildDiscoveryItem(deckCard({ anilistId: 105398, title: 'Solo Leveling', genres: ['Action'] }));

    expect(item.aiData.anilist).toMatchObject({
      id: 105398,
      matchedTitle: 'Solo Leveling',
      matchedBy: 'manual',
      confidence: 'manual',
      genres: ['Action'],
    });
  });
});

const aiCard = (overrides: Partial<AiDeckCard> = {}): AiDeckCard => ({
  kind: 'ai',
  title: 'El Marginal',
  mediaType: 'Serie',
  synopsis: 'Un policial carcelario argentino.',
  reason: 'Encaja con tu gusto por el drama carcelario.',
  ...overrides,
});

const tvmazeDetail = (overrides: Partial<TvmazeMatch> = {}): TvmazeMatch => ({
  id: 22557,
  name: 'El Marginal',
  premiered: '2016-06-02',
  ended: '2022-05-04',
  status: 'En emisión',
  genres: ['Drama', 'Crime'],
  image: 'https://static.tvmaze.com/original.jpg',
  totalEpisodes: 43,
  seasons: 5,
  firstSeasonEpisodes: 13,
  ...overrides,
});

describe('buildSerieItem', () => {
  it('builds a linked item from a hydrated card and its detail', () => {
    const item = buildSerieItem(
      aiCard({ tvmazeId: 22557, coverImage: 'https://static.tvmaze.com/original.jpg', status: 'En emisión' }),
      tvmazeDetail(),
      { id: 'serie-1', now: 2000 },
    );

    expect(item.id).toBe('serie-1');
    expect(item.createdAt).toBe(2000);
    expect(item.aiData.mediaType).toBe('Serie');
    expect(item.aiData.coverImage).toBe('https://static.tvmaze.com/original.jpg');
    expect(item.aiData.status).toBe('En emisión');
    expect(item.aiData.totalContent).toBe('5 Temporadas · 43 Caps');
    expect(item.aiData.tvmaze).toEqual({ id: 22557 });
    expect(item.aiData.releaseDate).toBe('2016-06-02');
    expect(item.aiData.endDate).toBe('2022-05-04');
    expect(item.trackingData.totalSeasons).toBe(5);
    expect(item.trackingData.totalEpisodesInSeason).toBe(13);
    expect(item.trackingData.status).toBe('Sin empezar');
    expect(item.trackingData.currentSeason).toBe(1);
  });

  it('uses the singular label for a one-season show', () => {
    const item = buildSerieItem(
      aiCard({ tvmazeId: 1 }),
      tvmazeDetail({ totalEpisodes: 10, seasons: 1, firstSeasonEpisodes: 10 }),
    );

    expect(item.aiData.totalContent).toBe('1 Temporada · 10 Caps');
  });

  it('degrades to the episode count when the season count is unknown', () => {
    const item = buildSerieItem(
      aiCard({ tvmazeId: 1 }),
      tvmazeDetail({ totalEpisodes: 12, seasons: undefined }),
    );

    expect(item.aiData.totalContent).toBe('12 Caps');
  });

  it('still produces a valid item when the detail fetch failed', () => {
    const item = buildSerieItem(aiCard({ tvmazeId: 22557 }), null, { now: 3000 });

    expect(item.aiData.totalContent).toBe('');
    expect(item.aiData.releaseDate).toBeUndefined();
    expect(item.aiData.endDate).toBeUndefined();
    expect(item.trackingData.totalSeasons).toBe(1);
    expect(item.trackingData.totalEpisodesInSeason).toBe(0);
    expect(item.aiData.tvmaze).toEqual({ id: 22557 });
  });

  it('omits the tvmaze key when the card has no id', () => {
    const item = buildSerieItem(aiCard(), tvmazeDetail());

    expect('tvmaze' in item.aiData).toBe(false);
    expect(item.aiData.totalContent).toBe('5 Temporadas · 43 Caps');
  });

  it('keeps the Spanish Gemini synopsis instead of the English TVmaze summary', () => {
    const item = buildSerieItem(
      aiCard({ tvmazeId: 22557, synopsis: 'Un policial carcelario argentino.' }),
      tvmazeDetail({ synopsis: 'A prison police drama.' }),
    );

    expect(item.aiData.synopsis).toBe('Un policial carcelario argentino.');
  });

  it('copies the card genres instead of aliasing them and never mutates the card', () => {
    const card = aiCard({ genres: ['Drama'], tvmazeId: 22557 });
    const item = buildSerieItem(card, tvmazeDetail());

    item.aiData.genres.push('Crime');

    expect(card.genres).toEqual(['Drama']);
    expect(card).toEqual(aiCard({ genres: ['Drama'], tvmazeId: 22557 }));
  });
});
