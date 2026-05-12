import { MediaItem, RATING_TO_SCORE, normalizeGenre } from '../../types';

// --- Type Definitions ---

export interface ObsessionItem {
  id: string;
  title: string;
  time: number; // In minutes
  coverImage?: string;
  primaryColor?: string;
  unitCount: number; // Episodes or Chapters
}

export interface PlatformStat {
  domain: string;
  count: number;
  name: string;
}

export interface StatsData {
  total: number;
  completed: number;
  onHold: number;
  watching: number;
  typeCount: Record<string, number>;
  topGenre: string;
  maxGenreCount: number;
  ratingCount: Record<string, number>;
  averageScore: string;
  averageLabel: string;
  highestRatedGenre: string;

  // Obsession Data Structure: Top 3 per category
  topItemsByType: Record<string, ObsessionItem[]>;
  globalMaxCategory: string;

  animeEpisodes: number;
  seriesEpisodes: number;
  moviesWatched: number;
  readingChapters: number;
  bookChapters: number;
  visualTimeDisplay: string;
  readingTimeDisplay: string;
  // Consumed Items Counts
  consumedAnimes: number;
  consumedSeries: number;
  consumedMovies: number;
  consumedManhwas: number;
  consumedBooks: number;
  // Raw Minutes for calculation
  visualMinutes: number;
  readingMinutes: number;
  // Total consumption units for Ranking
  totalConsumptionUnits: number;

  // Distribution Data Maps (Minutes per Tag)
  genreConsumption: Record<string, number>;
  emotionConsumption: Record<string, number>;

  // Ecosystem Data
  itemsWithLinks: number;
  itemsWithoutLinks: number;
  topPlatforms: PlatformStat[];
}

export interface DurationPreferences {
  animeEpisodeDuration: number;
  seriesEpisodeDuration: number;
  movieDuration: number;
  mangaChapterDuration: number;
  bookChapterDuration: number;
}

// --- Helpers ---

/** Capitalize Title Case nicely (e.g. "ciencia ficción" -> "Ciencia Ficción") */
export const toTitleCase = (str: string) => {
  return str.toLowerCase().replace(/(?:^|\s)\w/g, function(match) {
    return match.toUpperCase();
  });
};

export const formatTime = (totalMins: number) => {
  const days = Math.floor(totalMins / (24 * 60));
  const hours = Math.floor((totalMins % (24 * 60)) / 60);
  const mins = totalMins % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

// --- Computation ---

export function computeStats(library: MediaItem[], durations: DurationPreferences): StatsData {
  const total = library.length;
  const completed = library.filter(i => i.trackingData.status === 'Completado').length;
  const onHold = library.filter(i => i.trackingData.status === 'En Pausa').length;
  const watching = library.filter(i => i.trackingData.status === 'Viendo/Leyendo').length;

  // Type Distribution
  const typeCount: Record<string, number> = {};
  library.forEach(item => {
    const type = item.aiData.mediaType;
    typeCount[type] = (typeCount[type] || 0) + 1;
  });

  // Genre Distribution (Count based) - Normalized
  const genreCount: Record<string, number> = {};
  library.forEach(item => {
    const genres = item.aiData?.genres || [];
    genres.forEach(g => {
      const normalizedKey = normalizeGenre(g);
      genreCount[normalizedKey] = (genreCount[normalizedKey] || 0) + 1;
    });
  });
  // Find top genre
  let topGenre = 'N/A';
  let maxGenreCount = 0;
  Object.entries(genreCount).forEach(([g, count]) => {
    if (count > maxGenreCount) {
      maxGenreCount = count;
      topGenre = toTitleCase(g);
    }
  });

  // Rating Distribution
  const ratingCount: Record<string, number> = {};
  let totalScore = 0;
  let ratedItemsCount = 0;
  const godTierGenres: Record<string, number> = {};

  library.forEach(item => {
    const r = item.trackingData.rating;
    if (r) {
      ratingCount[r] = (ratingCount[r] || 0) + 1;

      // Calculate Average Score
      if (RATING_TO_SCORE[r]) {
        totalScore += RATING_TO_SCORE[r];
        ratedItemsCount++;
      }

      // God Tier Genre Logic
      if (r.startsWith('God Tier')) {
        const genres = item.aiData?.genres || [];
        genres.forEach(g => {
          const normalizedKey = normalizeGenre(g);
          godTierGenres[normalizedKey] = (godTierGenres[normalizedKey] || 0) + 1;
        });
      }
    }
  });

  const averageScoreVal = ratedItemsCount > 0 ? (totalScore / ratedItemsCount) : 0;
  const averageScore = ratedItemsCount > 0 ? averageScoreVal.toFixed(1) : "N/A";

  // Verdict Logic (Labels)
  let averageLabel = "Sin datos";
  if (ratedItemsCount > 0) {
    if (averageScoreVal >= 9) averageLabel = "Estándar Épico";
    else if (averageScoreVal >= 8) averageLabel = "Gusto Refinado";
    else if (averageScoreVal >= 7) averageLabel = "Disfruta mucho";
    else if (averageScoreVal >= 6) averageLabel = "Equilibrado";
    else if (averageScoreVal >= 5) averageLabel = "Exigente";
    else averageLabel = "Crítico Duro";
  }

  let highestRatedGenre = "N/A";
  let maxGodTierCount = 0;
  Object.entries(godTierGenres).forEach(([g, count]) => {
    if (count > maxGodTierCount) {
      maxGodTierCount = count;
      highestRatedGenre = toTitleCase(g);
    }
  });

  // --- Personal Recap (Granular) Logic ---
  const animeMin = durations.animeEpisodeDuration;
  const seriesMin = durations.seriesEpisodeDuration;
  const movieMin = durations.movieDuration;
  const mangaMin = durations.mangaChapterDuration;
  const bookMin = durations.bookChapterDuration;

  // Counters
  let animeEpisodes = 0;
  let seriesEpisodes = 0;
  let moviesWatched = 0;
  let readingChapters = 0;
  let bookChapters = 0;

  // Time
  let visualMinutes = 0;
  let readingMinutes = 0;

  // Maps for Distribution Widget
  const genreConsumption: Record<string, number> = {};
  const emotionConsumption: Record<string, number> = {};

  // Raw Collection for Sorting Top 3
  const rawItemsByType: Record<string, ObsessionItem[]> = {
    'Anime': [],
    'Series': [],
    'Webtoon/Manga': [],
    'Libros/Novelas': []
  };

  // Ecosystem Logic
  let itemsWithLinks = 0;
  let itemsWithoutLinks = 0;
  const platformMap: Record<string, number> = {};

  library.forEach(item => {
    const type = item.aiData.mediaType;
    // Total Consumption = Historical (Archived) + Current Progress
    const history = item.trackingData.accumulated_consumption || 0;
    const current = item.trackingData.watchedEpisodes;

    // Calculate Total Units Consumed
    let totalEffectiveUnits = 0;

    if (type === 'Pelicula') {
      const isDone = item.trackingData.status === 'Completado';
      if (isDone || current > 0) {
        totalEffectiveUnits = Math.max(1, current + history);
      }
    } else {
      totalEffectiveUnits = current + history;
    }

    // Apply Time Logic if any progress exists
    if (totalEffectiveUnits > 0) {
      let itemTime = 0;
      let categoryKey = '';

      // Visual
      if (type === 'Anime') {
        animeEpisodes += totalEffectiveUnits;
        itemTime = totalEffectiveUnits * animeMin;
        visualMinutes += itemTime;
        categoryKey = 'Anime';
      } else if (type === 'Serie') {
        seriesEpisodes += totalEffectiveUnits;
        itemTime = totalEffectiveUnits * seriesMin;
        visualMinutes += itemTime;
        categoryKey = 'Series';
      } else if (type === 'Pelicula') {
        moviesWatched += totalEffectiveUnits;
        itemTime = totalEffectiveUnits * movieMin;
        visualMinutes += itemTime;
      }
      // Reading
      else if (['Manhwa', 'Manga', 'Comic'].includes(type)) {
        readingChapters += totalEffectiveUnits;
        itemTime = totalEffectiveUnits * mangaMin;
        readingMinutes += itemTime;
        categoryKey = 'Webtoon/Manga';
      } else if (type === 'Libro') {
        bookChapters += totalEffectiveUnits;
        itemTime = totalEffectiveUnits * bookMin;
        readingMinutes += itemTime;
        categoryKey = 'Libros/Novelas';
      }

      // --- Distribution Logic (Strict Normalization) ---
      if (itemTime > 0) {
        const genres = item.aiData?.genres || [];
        genres.forEach(g => {
          const normalized = normalizeGenre(g);
          const label = toTitleCase(normalized);
          genreConsumption[label] = (genreConsumption[label] || 0) + itemTime;
        });

        const emotions = item.trackingData.emotionalTags || [];
        emotions.forEach(t => {
          const label = toTitleCase(t.trim());
          emotionConsumption[label] = (emotionConsumption[label] || 0) + itemTime;
        });
      }

      // Push to raw collection for sorting
      if (categoryKey) {
        rawItemsByType[categoryKey].push({
          id: item.id,
          title: item.aiData.title,
          time: itemTime,
          coverImage: item.aiData.coverImage,
          primaryColor: item.aiData.primaryColor,
          unitCount: totalEffectiveUnits
        });
      }
    }

    // --- Ecosystem Analysis ---
    if (item.trackingData.customLinks && item.trackingData.customLinks.length > 0) {
      itemsWithLinks++;
      item.trackingData.customLinks.forEach(link => {
        try {
          const url = new URL(link.url);
          let hostname = url.hostname;
          hostname = hostname.replace(/^(www\d*|web|m|mobile|touch|v\d+)\./i, '');
          const key = hostname;
          platformMap[key] = (platformMap[key] || 0) + 1;
        } catch (e) {
          // Ignore invalid URLs
        }
      });
    } else {
      itemsWithoutLinks++;
    }
  });

  // Sort and Extract Top 3 per category
  const topItemsByType: Record<string, ObsessionItem[]> = {};
  let globalMaxCategory = 'Anime';
  let highestSingleItemTime = 0;

  Object.keys(rawItemsByType).forEach(key => {
    const sorted = rawItemsByType[key].sort((a, b) => b.time - a.time);
    topItemsByType[key] = sorted.slice(0, 3);

    if (sorted.length > 0 && sorted[0].time > highestSingleItemTime) {
      highestSingleItemTime = sorted[0].time;
      globalMaxCategory = key;
    }
  });

  // Helper to count "Consumed" items
  const countConsumed = (types: string[]) =>
    library.filter(i => types.includes(i.aiData.mediaType) && (i.trackingData.watchedEpisodes > 0 || (i.trackingData.accumulated_consumption || 0) > 0 || i.trackingData.status === 'Completado')).length;

  const consumedAnimes = countConsumed(['Anime']);
  const consumedSeries = countConsumed(['Serie']);
  const consumedMovies = countConsumed(['Pelicula']);
  const consumedManhwas = countConsumed(['Manhwa', 'Manga', 'Comic']);
  const consumedBooks = countConsumed(['Libro']);

  const totalConsumptionUnits = animeEpisodes + seriesEpisodes + moviesWatched + readingChapters + bookChapters;

  // Process Top Platforms
  const topPlatforms = Object.entries(platformMap)
    .map(([domain, count]) => {
      const parts = domain.split('.');
      let name = parts[0];

      if (['app', 'watch', 'read', 'ver', 'm', 'mobile'].includes(name) && parts.length > 1) {
        name = parts[1];
      }

      name = name.charAt(0).toUpperCase() + name.slice(1);
      return { domain, count, name };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total, completed, onHold, watching, typeCount,
    topGenre, maxGenreCount, ratingCount,
    averageScore, averageLabel, highestRatedGenre,

    topItemsByType, globalMaxCategory,

    animeEpisodes, seriesEpisodes, moviesWatched, readingChapters, bookChapters,
    visualTimeDisplay: formatTime(visualMinutes),
    readingTimeDisplay: formatTime(readingMinutes),
    consumedAnimes, consumedSeries, consumedMovies, consumedManhwas, consumedBooks,
    visualMinutes, readingMinutes,
    totalConsumptionUnits,

    genreConsumption, emotionConsumption,

    itemsWithLinks, itemsWithoutLinks, topPlatforms
  };
}
