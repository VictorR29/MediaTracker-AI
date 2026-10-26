import { describe, it, expect } from 'vitest';
import { parseBackupFile, parseCatalogFile, createBackupBlob, createCatalogBlob } from '../backup';
import { UserProfile, MediaItem } from '../../types';

const mockProfile: UserProfile = { username: 'Vikthor', password: 'abc123:def456', accentColor: '#c084fc', apiKey: '' };
const mockLibrary: MediaItem[] = [{
  id: 'test', aiData: { title: 'Test', mediaType: 'Anime', synopsis: '', genres: [], status: 'Finalizado', totalContent: '', coverDescription: '', coverImage: '', sourceUrls: [], primaryColor: '#c084fc' },
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
      expect(result!.skippedCount).toBe(0);
    });

    it('returns null when library is not an array', () => {
      const json = JSON.stringify({ profile: mockProfile, library: 'nope' });
      expect(parseBackupFile(json)).toBeNull();
    });

    it('filters out items without a usable id and counts them', () => {
      const noId = { ...mockLibrary[0], id: undefined };
      const emptyId = { ...mockLibrary[0], id: '   ' };
      const json = JSON.stringify({ profile: mockProfile, library: [mockLibrary[0], noId, emptyId] });
      const result = parseBackupFile(json);
      expect(result).not.toBeNull();
      expect(result!.library).toHaveLength(1);
      expect(result!.library[0].id).toBe('test');
      expect(result!.skippedCount).toBe(2);
    });

    it('filters out items without aiData title, mediaType or trackingData', () => {
      const junkEntry = {
        id: 'junk',
        aiData: { mediaType: 'Anime' },
        trackingData: {},
      };
      const json = JSON.stringify({ profile: mockProfile, library: [junkEntry, mockLibrary[0]] });
      const result = parseBackupFile(json);
      expect(result).not.toBeNull();
      expect(result!.library.map(i => i.id)).toEqual(['test']);
      expect(result!.skippedCount).toBe(1);
    });

    it('accepts version 1 explicitly', () => {
      const json = JSON.stringify({ profile: mockProfile, library: mockLibrary, version: 1 });
      expect(parseBackupFile(json)).not.toBeNull();
    });

    it('returns null for an unsupported backup version', () => {
      const json = JSON.stringify({ profile: mockProfile, library: mockLibrary, version: 2 });
      expect(parseBackupFile(json)).toBeNull();
    });

    it('round-trips createBackupBlob through parseBackupFile', async () => {
      const blob = createBackupBlob(mockProfile, mockLibrary);
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });
      const result = parseBackupFile(content);
      expect(result).not.toBeNull();
      expect(result!.profile).toEqual(mockProfile);
      expect(result!.library).toEqual(mockLibrary);
      expect(result!.skippedCount).toBe(0);
    });

    it('returns null for catalog (array)', () => {
      const json = JSON.stringify(mockLibrary);
      expect(parseBackupFile(json)).toBeNull();
    });

    it('returns null for missing profile', () => {
      const json = JSON.stringify({ library: mockLibrary });
      expect(parseBackupFile(json)).toBeNull();
    });

    it('returns null when the profile is not an object', () => {
      const json = JSON.stringify({ profile: 'nope', library: mockLibrary });
      expect(parseBackupFile(json)).toBeNull();
    });

    it('returns null when the profile has no username', () => {
      const json = JSON.stringify({ profile: { accentColor: '#c084fc', apiKey: '' }, library: [] });
      expect(parseBackupFile(json)).toBeNull();
    });

    it('returns null when the profile username is blank', () => {
      const json = JSON.stringify({ profile: { ...mockProfile, username: '   ' }, library: [] });
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
