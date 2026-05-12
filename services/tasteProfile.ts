/*
 * Project: MediaTracker AI
 * Copyright (C) 2026 Victor Ramones
 * Licensed under the GNU General Public License v3.0
 */
import { MediaItem, RATING_TO_SCORE } from '../types';

/**
 * Computes a taste profile from the user's library for discovery recommendations.
 * Pure computation — no React dependencies.
 */
export const computeTasteProfile = (
  library: MediaItem[],
  selectedType: string,
  selectedSeeds: string[]
): { topGenres: string[]; likedTitles: string[]; excludedTitles: string[] } => {
  const genreCounts: Record<string, number> = {};
  const liked: string[] = [];
  const excluded: string[] = [];

  library.forEach(item => excluded.push(item.aiData.title));

  if (selectedSeeds.length > 0) {
    const seedItems = library.filter(item => selectedSeeds.includes(item.id));
    seedItems.forEach(item => {
      liked.push(item.aiData.title);
      item.aiData.genres.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
    });
  } else {
    const targetTypes = selectedType === 'Manhwa' ? ['Manhwa', 'Manga', 'Comic'] : [selectedType];
    library.forEach(item => {
      if (targetTypes.includes(item.aiData.mediaType)) {
        const rating = item.trackingData.rating;
        const score = RATING_TO_SCORE[rating] || 0;
        if ((score >= 7 || (score === 0 && item.trackingData.status === 'Completado'))) {
          liked.push(item.aiData.title);
          item.aiData.genres.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
        }
      }
    });
  }

  const sortedGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([g]) => g)
    .slice(0, 5);

  return { topGenres: sortedGenres, likedTitles: liked, excludedTitles: excluded };
};
