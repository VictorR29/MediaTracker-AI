/*
 * Project: MediaTracker AI
 * Copyright (C) 2026 Victor Ramones
 * Licensed under the GNU General Public License v3.0
 */
import { MediaItem } from '../types';

/**
 * Computes the next season transition for a series.
 * Pure data transformation — no React, no toast, no state.
 */
export const computeNextSeason = (
  item: MediaItem
): { updatedItem: MediaItem; message: string; isCompleted: boolean } => {
  const { trackingData } = item;
  const episodesToAdd = trackingData.totalEpisodesInSeason || trackingData.watchedEpisodes;
  const newHistory = (trackingData.accumulated_consumption || 0) + episodesToAdd;

  if (trackingData.currentSeason >= trackingData.totalSeasons && trackingData.totalSeasons > 0) {
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

  return {
    updatedItem: {
      ...item,
      trackingData: {
        ...item.trackingData,
        watchedEpisodes: 0,
        currentSeason: trackingData.currentSeason + 1,
        accumulated_consumption: newHistory,
      },
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
