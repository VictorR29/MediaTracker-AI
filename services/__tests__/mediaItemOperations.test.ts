import { describe, it, expect } from 'vitest';
import { computeNextSeason, createCustomLink, reorderCharacters } from '../mediaItemOperations';
import { MediaItem } from '../../types';

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
    primaryColor: '#6366f1',
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

    it('handles zero totalEpisodes (infinite series)', () => {
      const infinite = { ...baseItem, trackingData: { ...baseItem.trackingData, totalEpisodesInSeason: 0, watchedEpisodes: 0 } };
      const result = computeNextSeason(infinite);
      expect(result.updatedItem.trackingData.accumulated_consumption).toBe(0);
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
});
