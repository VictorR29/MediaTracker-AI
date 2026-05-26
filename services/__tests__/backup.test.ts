import { describe, it, expect } from 'vitest';
import { parseBackupFile, parseCatalogFile, createBackupBlob, createCatalogBlob } from '../backup';
import { UserProfile, MediaItem } from '../../types';

const mockProfile: UserProfile = { username: 'Vikthor', password: 'abc123:def456' };
const mockLibrary: MediaItem[] = [{
  id: 'test', aiData: { title: 'Test', mediaType: 'Anime', synopsis: '', genres: [], status: 'Finalizado', totalContent: '', coverDescription: '', coverImage: '', sourceUrls: [], primaryColor: '#a78bfa' },
  trackingData: { status: 'Completado', currentSeason: 1, totalSeasons: 1, watchedEpisodes: 1, totalEpisodesInSeason: 1, is_favorite: false, rating: '', emotionalTags: [], comment: '', customLinks: [], favoriteCharacters: [], recommendedBy: '' },
  createdAt: 1000, lastInteraction: 2000,
}];

describe('backup service', () => {
  describe('parseBackupFile', () => {
    it('parses valid backup with profile key', () => {
      const json = JSON.stringify({ profile: mockProfile, library: mockLibrary });
      const result = parseBackupFile(json);
      expect(result).not.toBeNull();
      expect(result!.profile.username).toBe('Vikthor');
      expect(result!.library).toHaveLength(1);
    });

    it('parses backup with userProfile key (legacy)', () => {
      const json = JSON.stringify({ userProfile: mockProfile, library: [] });
      const result = parseBackupFile(json);
      expect(result).not.toBeNull();
    });

    it('parses backup without library field', () => {
      const json = JSON.stringify({ profile: mockProfile });
      const result = parseBackupFile(json);
      expect(result).not.toBeNull();
      expect(result!.library).toEqual([]);
    });

    it('returns null for catalog (array)', () => {
      const json = JSON.stringify(mockLibrary);
      expect(parseBackupFile(json)).toBeNull();
    });

    it('returns null for missing profile', () => {
      const json = JSON.stringify({ library: mockLibrary });
      expect(parseBackupFile(json)).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(parseBackupFile('not json')).toBeNull();
    });
  });

  describe('parseCatalogFile', () => {
    it('parses valid catalog array', () => {
      const json = JSON.stringify(mockLibrary);
      const result = parseCatalogFile(json);
      expect(result).not.toBeNull();
      expect(result!).toHaveLength(1);
    });

    it('returns null for object (not array)', () => {
      const json = JSON.stringify({ profile: mockProfile });
      expect(parseCatalogFile(json)).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(parseCatalogFile('{broken')).toBeNull();
    });
  });

  describe('createBackupBlob', () => {
    it('creates a blob with correct type', () => {
      const blob = createBackupBlob(mockProfile, mockLibrary);
      expect(blob.type).toBe('application/json');
    });
  });

  describe('createCatalogBlob', () => {
    it('creates a blob with correct type', () => {
      const blob = createCatalogBlob(mockLibrary);
      expect(blob.type).toBe('application/json');
    });
  });
});
