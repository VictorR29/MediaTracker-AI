import { describe, it, expect } from 'vitest';
import { computeNextSeason, createCustomLink, mergeCharacters, promoteStatusOnFirstEpisode, reorderCharacters, resolveStatusForPendingSeasons } from '../mediaItemOperations';
import { MediaItem, UserTrackingData } from '../../types';

const baseItem: MediaItem = {
  id: 'test',
  aiData: {
    title: 'Test Anime',
    mediaType: 'Anime',
    synopsis: '',
    genres: [],
    status: 'En emisión',
    totalContent: '2 Temporadas',
    coverDescription: '',
    coverImage: '',
    sourceUrls: [],
    primaryColor: '#c084fc',
  },
  trackingData: {
    status: 'Viendo/Leyendo',
    currentSeason: 1,
    totalSeasons: 3,
    watchedEpisodes: 12,
    totalEpisodesInSeason: 12,
    is_favorite: false,
    rating: '',
    emotionalTags: [],
    comment: '',
    customLinks: [],
    favoriteCharacters: [],
    recommendedBy: '',
  },
  createdAt: 1000,
  lastInteraction: 2000,
};

describe('mediaItemOperations', () => {
  describe('computeNextSeason', () => {
    it('moves to next season when not last', () => {
      const result = computeNextSeason(baseItem);
      expect(result.isCompleted).toBe(false);
      expect(result.updatedItem.trackingData.currentSeason).toBe(2);
      expect(result.updatedItem.trackingData.watchedEpisodes).toBe(0);
      expect(result.updatedItem.trackingData.accumulated_consumption).toBe(12);
    });

    it('marks completed on last season', () => {
      const lastSeason = { ...baseItem, trackingData: { ...baseItem.trackingData, currentSeason: 3, totalSeasons: 3 } };
      const result = computeNextSeason(lastSeason);
      expect(result.isCompleted).toBe(true);
    });

    it('leaves accumulated_consumption untouched when completing the last season', () => {
      const lastSeason = {
        ...baseItem,
        trackingData: {
          ...baseItem.trackingData,
          currentSeason: 3,
          totalSeasons: 3,
          accumulated_consumption: 24,
        },
      };
      const result = computeNextSeason(lastSeason);

      // Stats sums watchedEpisodes + accumulated_consumption. The final season is
      // already inside watchedEpisodes, so adding it to the historical counter as
      // well would count the same 12 episodes twice.
      expect(result.updatedItem.trackingData.accumulated_consumption).toBe(24);
      expect(result.updatedItem.trackingData.watchedEpisodes).toBe(12);
      expect(result.updatedItem.trackingData.status).toBe('Completado');
    });

    it('takes a completed work out of Completado when a new season is added', () => {
      const completedWithNewSeason = {
        ...baseItem,
        trackingData: { ...baseItem.trackingData, status: 'Completado' as const, currentSeason: 2, totalSeasons: 3 },
      };
      const result = computeNextSeason(completedWithNewSeason);

      expect(result.isCompleted).toBe(false);
      expect(result.updatedItem.trackingData.currentSeason).toBe(3);
      expect(result.updatedItem.trackingData.status).toBe('Sin empezar');
    });

    it('preserves an explicit status when advancing a season', () => {
      const paused = {
        ...baseItem,
        trackingData: { ...baseItem.trackingData, status: 'En Pausa' as const },
      };
      expect(computeNextSeason(paused).updatedItem.trackingData.status).toBe('En Pausa');
    });

    it('handles zero totalEpisodes (infinite series)', () => {
      const infinite = { ...baseItem, trackingData: { ...baseItem.trackingData, totalEpisodesInSeason: 0, watchedEpisodes: 0 } };
      const result = computeNextSeason(infinite);
      expect(result.updatedItem.trackingData.accumulated_consumption).toBe(0);
    });
  });

  describe('resolveStatusForPendingSeasons', () => {
    const tracking = (overrides: Partial<UserTrackingData> = {}): UserTrackingData => ({
      ...baseItem.trackingData,
      ...overrides,
    });

    it('moves Completado to Sin empezar when seasons remain', () => {
      expect(resolveStatusForPendingSeasons(tracking({ status: 'Completado', currentSeason: 2, totalSeasons: 3 })))
        .toBe('Sin empezar');
    });

    it('moves Completado to Sin empezar when the last season is still unwatched', () => {
      // currentSeason >= totalSeasons only means "standing on the last season".
      expect(resolveStatusForPendingSeasons(tracking({
        status: 'Completado', currentSeason: 3, totalSeasons: 3, watchedEpisodes: 0,
      }))).toBe('Sin empezar');
    });

    it('keeps Completado when the last season is fully watched', () => {
      expect(resolveStatusForPendingSeasons(tracking({
        status: 'Completado', currentSeason: 3, totalSeasons: 3, watchedEpisodes: 12, totalEpisodesInSeason: 12,
      }))).toBe('Completado');
    });

    it('never overrides a deliberate status', () => {
      expect(resolveStatusForPendingSeasons(tracking({ status: 'En Pausa', currentSeason: 1 }))).toBe('En Pausa');
      expect(resolveStatusForPendingSeasons(tracking({ status: 'Descartado', currentSeason: 1 }))).toBe('Descartado');
      expect(resolveStatusForPendingSeasons(tracking({ status: 'Viendo/Leyendo', currentSeason: 1 }))).toBe('Viendo/Leyendo');
    });

    it('keeps Completado when the total is unknown', () => {
      // totalSeasons 0 means "not set" (movies, legacy rows), not "no seasons left".
      expect(resolveStatusForPendingSeasons(tracking({ status: 'Completado', currentSeason: 1, totalSeasons: 0 })))
        .toBe('Completado');
    });
  });

  describe('promoteStatusOnFirstEpisode', () => {
    it('moves Sin empezar to Viendo/Leyendo once an episode is watched', () => {
      expect(promoteStatusOnFirstEpisode('Sin empezar', 1)).toBe('Viendo/Leyendo');
    });

    it('does not resurrect a discarded work', () => {
      expect(promoteStatusOnFirstEpisode('Descartado', 5)).toBe('Descartado');
    });

    it('does not demote when the counter drops to zero', () => {
      expect(promoteStatusOnFirstEpisode('Viendo/Leyendo', 0)).toBe('Viendo/Leyendo');
    });
  });

  describe('createCustomLink', () => {
    it('normalizes URL without protocol', () => {
      const link = createCustomLink('crunchyroll.com/anime');
      expect(link.url).toBe('https://crunchyroll.com/anime');
      expect(link.title).toBe('crunchyroll.com');
    });

    it('preserves URL with protocol', () => {
      const link = createCustomLink('https://www.example.com/page');
      expect(link.url).toBe('https://www.example.com/page');
      expect(link.title).toBe('example.com');
    });

    it('generates an id', () => {
      const link = createCustomLink('https://test.com');
      expect(link.id).toBeTruthy();
    });
  });

  describe('reorderCharacters', () => {
    it('moves item from index 0 to 2', () => {
      const result = reorderCharacters(['A', 'B', 'C'], 0, 2);
      expect(result).toEqual(['B', 'C', 'A']);
    });

    it('moves item from index 2 to 0', () => {
      const result = reorderCharacters(['A', 'B', 'C'], 2, 0);
      expect(result).toEqual(['C', 'A', 'B']);
    });

    it('returns same array when indices match', () => {
      const result = reorderCharacters(['A', 'B'], 0, 0);
      expect(result).toEqual(['A', 'B']);
    });
  });

  describe('mergeCharacters', () => {
    it('dedupes names case- and accent-insensitively with collapsed whitespace', () => {
      const existing = [{ name: 'Eren Yeager' }, { name: 'Mikasa Ackerman' }];
      const incoming = [{ name: '  EREN   yeager  ' }, { name: 'Mikasa Áckerman' }];

      expect(mergeCharacters(existing, incoming)).toEqual(existing);
    });

    it('keeps existing order and appends new characters in incoming order', () => {
      const existing = [{ name: 'Mikasa Ackerman' }, { name: 'Eren Yeager' }];
      const incoming = [{ name: 'Levi Ackerman' }, { name: 'Armin Arlert' }, { name: 'Eren Yeager' }];

      expect(mergeCharacters(existing, incoming).map(character => character.name)).toEqual([
        'Mikasa Ackerman',
        'Eren Yeager',
        'Levi Ackerman',
        'Armin Arlert',
      ]);
    });

    it('keeps incoming images and existing ones', () => {
      const existing = [{ name: 'Eren Yeager', image: 'https://img/local.jpg' }];
      const incoming = [
        { name: 'Mikasa Ackerman', image: 'https://img/mikasa.png' },
        { name: 'Armin Arlert' },
      ];

      expect(mergeCharacters(existing, incoming)).toEqual([
        { name: 'Eren Yeager', image: 'https://img/local.jpg' },
        { name: 'Mikasa Ackerman', image: 'https://img/mikasa.png' },
        { name: 'Armin Arlert' },
      ]);
    });

    it('does not mutate its inputs', () => {
      const existing = [{ name: 'Eren Yeager' }];
      const incoming = [{ name: 'Mikasa Ackerman', image: 'https://img/mikasa.png' }];

      const result = mergeCharacters(existing, incoming);

      expect(existing).toEqual([{ name: 'Eren Yeager' }]);
      expect(incoming).toEqual([{ name: 'Mikasa Ackerman', image: 'https://img/mikasa.png' }]);
      expect(result).not.toBe(existing);
      expect(result).not.toBe(incoming);
    });

    it('handles empty sides', () => {
      const characters = [{ name: 'Eren Yeager', image: 'https://img/eren.jpg' }];

      expect(mergeCharacters([], [])).toEqual([]);
      expect(mergeCharacters([], characters)).toEqual(characters);
      expect(mergeCharacters(characters, [])).toEqual(characters);
    });
  });
});
