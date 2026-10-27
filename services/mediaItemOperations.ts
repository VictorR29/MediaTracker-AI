/*
 * Project: MediaTracker AI
 * Copyright (C) 2026 Victor Ramones
 * Licensed under the GNU General Public License v3.0
 */
import { MediaItem, UserTrackingData } from '../types';

/**
 * A work with unwatched content left cannot stay marked as completed.
 *
 * `currentSeason >= totalSeasons` alone only means "standing on the last
 * season", so the last season must also be fully watched. Only 'Completado' is
 * corrected: every other status is a deliberate choice (paused, discarded,
 * planned) and is preserved. `totalSeasons <= 0` means the length is unknown —
 * movies, legacy rows — so the status is left alone.
 */
export const resolveStatusForPendingSeasons = (
  tracking: UserTrackingData,
): UserTrackingData['status'] => {
  if (tracking.status !== 'Completado') return tracking.status;
  if (tracking.totalSeasons <= 0) return tracking.status;

  const onLastSeason = tracking.currentSeason >= tracking.totalSeasons;
  const lastSeasonUnfinished =
    tracking.totalEpisodesInSeason > 0 &&
    tracking.watchedEpisodes < tracking.totalEpisodesInSeason;

  return onLastSeason && !lastSeasonUnfinished ? tracking.status : 'Sin empezar';
};

/**
 * The first watched episode of a season means that season is no longer pending.
 * Never demotes anything else: a discarded or paused work stays where it is.
 */
export const promoteStatusOnFirstEpisode = (
  status: UserTrackingData['status'],
  watchedEpisodes: number,
): UserTrackingData['status'] => {
  if (status === 'Sin empezar' && watchedEpisodes > 0) return 'Viendo/Leyendo';
  return status;
};

/**
 * Computes the next season transition for a series.
 * Pure data transformation — no React, no toast, no state.
 */
export const computeNextSeason = (
  item: MediaItem
): { updatedItem: MediaItem; message: string; isCompleted: boolean } => {
  const { trackingData } = item;

  if (trackingData.currentSeason >= trackingData.totalSeasons && trackingData.totalSeasons > 0) {
    // The finished season is already inside watchedEpisodes, which stays put, and
    // Stats sums watchedEpisodes + accumulated_consumption. Adding it to the
    // historical counter as well would count the same episodes twice.
    return {
      updatedItem: {
        ...item,
        trackingData: { ...item.trackingData, status: 'Completado' },
        lastInteraction: Date.now(),
      },
      message: '¡Obra completada!',
      isCompleted: true,
    };
  }

  const nextSeason = trackingData.currentSeason + 1;
  // totalEpisodesInSeason describes the season just finished, so it is credited
  // to the historical counter before the current counter is reset to zero. Using
  // it instead of watchedEpisodes keeps the credit stable when the user corrected
  // the episode count downwards.
  const episodesToAdd = trackingData.totalEpisodesInSeason || trackingData.watchedEpisodes;
  const newHistory = (trackingData.accumulated_consumption || 0) + episodesToAdd;

  const nextTracking: UserTrackingData = {
    ...trackingData,
    watchedEpisodes: 0,
    currentSeason: nextSeason,
    accumulated_consumption: newHistory,
  };
  // Moving to an unstarted season means the work is not finished, even when that
  // season happens to be the last one.
  nextTracking.status = resolveStatusForPendingSeasons(nextTracking);

  return {
    updatedItem: {
      ...item,
      trackingData: nextTracking,
      lastInteraction: Date.now(),
    },
    message: `¡Temporada ${trackingData.currentSeason} completada! Pasando a la siguiente.`,
    isCompleted: false,
  };
};

/**
 * Normalizes a URL and extracts the hostname as title.
 * Pure function — no side effects.
 */
export const createCustomLink = (
  url: string
): { id: string; url: string; title: string } => {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  const hostname = new URL(normalizedUrl).hostname.replace('www.', '');
  return { id: Date.now().toString(), url: normalizedUrl, title: hostname };
};

/**
 * Validates an image file and reads it as base64.
 * Pure conversion — no toast, no state updates.
 * Throws on invalid file type.
 */
export const processImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Invalid file type: not an image'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        resolve(base64);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
};

/**
 * Comparison key for a character name: case- and accent-insensitive with
 * collapsed whitespace. Punctuation is significant, unlike the AniList title
 * matcher, because "Eren" and "Eren!" are different user entries.
 */
const normalizeCharacterName = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Appends characters whose names are not already present, keeping the existing
 * order first and then the incoming order. Pure function — inputs are never
 * mutated.
 */
export const mergeCharacters = (
  existing: { name: string; image?: string }[],
  incoming: { name: string; image?: string }[]
): { name: string; image?: string }[] => {
  const result = existing.map(character => ({ ...character }));
  const seen = new Set(result.map(character => normalizeCharacterName(character.name)));

  for (const character of incoming) {
    const key = normalizeCharacterName(character.name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name: character.name, image: character.image });
  }

  return result;
};

/**
 * Reorders an array by moving an element from one index to another.
 * Pure function — returns a new array.
 */
export const reorderCharacters = <T>(
  list: T[],
  fromIndex: number,
  toIndex: number
): T[] => {
  const result = [...list];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
};
