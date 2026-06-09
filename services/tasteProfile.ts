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
): { topGenres: string[]; likedTitles: string[]; excludedTitles: string[]; topEmotions: string[] } => {
  const genreCounts: Record<string, number> = {};
  const emotionCounts: Record<string, number> = {};
  const liked: string[] = [];
  const excluded: string[] = [];

  library.forEach(item => excluded.push(item.aiData.title));

  const collectProfile = (item: MediaItem) => {
    liked.push(item.aiData.title);
    item.aiData.genres.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
    // Weight emotions by rating score — God Tier emotions count more
    const weight = Math.max(1, (RATING_TO_SCORE[item.trackingData.rating] || 5) / 5);
    (item.trackingData.emotionalTags || []).forEach(tag => {
      emotionCounts[tag] = (emotionCounts[tag] || 0) + weight;
    });
  };

  if (selectedSeeds.length > 0) {
    const seedItems = library.filter(item => selectedSeeds.includes(item.id));
    seedItems.forEach(collectProfile);
  } else {
    const targetTypes = selectedType === 'Manhwa' ? ['Manhwa', 'Manga', 'Comic'] : [selectedType];
    library.forEach(item => {
      if (targetTypes.includes(item.aiData.mediaType)) {
        const rating = item.trackingData.rating;
        const score = RATING_TO_SCORE[rating] || 0;
        if ((score >= 7 || (score === 0 && item.trackingData.status === 'Completado'))) {
          collectProfile(item);
        }
      }
    });
  }

  const sortedGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([g]) => g)
    .slice(0, 5);

  const topEmotions = Object.entries(emotionCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([tag]) => tag)
    .slice(0, 3);

  return { topGenres: sortedGenres, likedTitles: liked, excludedTitles: excluded, topEmotions };
};
