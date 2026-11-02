import { describe, it, expect } from 'vitest';
import { applyCharacterImage, readFileAsDataUrl } from '../characterImage';
import type { MediaItem } from '../../types';

const itemWith = (names: string[]): MediaItem => ({
  id: 'work-1',
  aiData: {
    title: 'Solo Leveling',
    mediaType: 'Manhwa',
    synopsis: '',
    genres: [],
    status: 'Finalizado',
    totalContent: '',
    coverDescription: '',
    coverImage: '',
    sourceUrls: [],
    primaryColor: '#c084fc',
  },
  trackingData: {
    status: 'Completado',
    currentSeason: 1,
    totalSeasons: 1,
    watchedEpisodes: 179,
    totalEpisodesInSeason: 179,
    is_favorite: false,
    rating: '',
    emotionalTags: [],
    comment: '',
    customLinks: [],
    favoriteCharacters: names.map((name) => ({ name })),
    recommendedBy: '',
  },
  createdAt: 1_000,
  lastInteraction: 2_000,
});

describe('applyCharacterImage', () => {
  it('writes the character that was opened, not the first one', () => {
    // The card that opened the dialog belongs to Jinwoo; writing index 0 would
    // put his photo on Cha Hae-In.
    const result = applyCharacterImage(itemWith(['Cha Hae-In', 'Jinwoo']), 'Jinwoo', 'data:image/webp;base64,AAA');

    expect(result!.trackingData.favoriteCharacters[1].image).toBe('data:image/webp;base64,AAA');
    expect(result!.trackingData.favoriteCharacters[0].image).toBeUndefined();
  });

  it('keeps the order of the work and every other character untouched', () => {
    const item = itemWith(['A', 'B', 'C']);
    const result = applyCharacterImage(item, 'B', 'img');

    expect(result!.trackingData.favoriteCharacters.map((c) => c.name)).toEqual(['A', 'B', 'C']);
    expect(result!.trackingData.favoriteCharacters[1]).toEqual({ name: 'B', image: 'img' });
  });

  it('never mutates the item it was given', () => {
    const item = itemWith(['A']);
    applyCharacterImage(item, 'A', 'img');

    expect(item.trackingData.favoriteCharacters[0].image).toBeUndefined();
  });

  it('does not touch anything else in the work', () => {
    const item = itemWith(['A']);
    const result = applyCharacterImage(item, 'A', 'img');

    expect(result!.aiData).toBe(item.aiData);
    expect(result!.trackingData.watchedEpisodes).toBe(179);
  });

  it('returns null when the character is no longer in the work', () => {
    // The character was removed while the dialog was open; there is no honest
    // place to put the photo.
    expect(applyCharacterImage(itemWith(['A']), 'Gone', 'img')).toBeNull();
  });

  it('returns null for a work with no favourite characters', () => {
    expect(applyCharacterImage(itemWith([]), 'A', 'img')).toBeNull();
  });

  it('works when favoriteCharacters is missing entirely', () => {
    const item = itemWith(['A']);
    // Older persisted items can predate the field.
    const legacy = { ...item, trackingData: { ...item.trackingData, favoriteCharacters: undefined } };
    expect(applyCharacterImage(legacy as unknown as MediaItem, 'A', 'img')).toBeNull();
  });
});

describe('readFileAsDataUrl', () => {
  it('resolves the file contents as a data URL', async () => {
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    await expect(readFileAsDataUrl(file)).resolves.toBe('data:text/plain;base64,aGVsbG8=');
  });
});
