import { MediaItem } from '../types';
import { saveMediaItem } from '../services/storage';
import { useLibraryStore } from './useLibraryStore';

export const incrementProgress = async (
  item: MediaItem,
  showSuccess: (msg: string) => void,
  showInfo: (msg: string) => void,
): Promise<void> => {
  const { watchedEpisodes, totalEpisodesInSeason, currentSeason, totalSeasons, accumulated_consumption } = item.trackingData;

  // Logic when no limit is set (infinite series)
  if (totalEpisodesInSeason === 0) {
    const newEp = watchedEpisodes + 1;
    const updated = {
      ...item,
      trackingData: { ...item.trackingData, watchedEpisodes: newEp },
      lastInteraction: Date.now()
    };
    await saveMediaItem(updated);
    useLibraryStore.setState(s => ({ library: s.library.map(i => i.id === item.id ? updated : i) }));
    showSuccess(`+1 Capítulo a ${item.aiData.title}`);
    return;
  }

  // Logic: Increment episode if not full
  if (watchedEpisodes < totalEpisodesInSeason) {
    const newEp = watchedEpisodes + 1;
    const updated = {
      ...item,
      trackingData: { ...item.trackingData, watchedEpisodes: newEp },
      lastInteraction: Date.now()
    };
    await saveMediaItem(updated);
    useLibraryStore.setState(s => ({ library: s.library.map(i => i.id === item.id ? updated : i) }));

    if (newEp === totalEpisodesInSeason) {
      const isLastSeason = currentSeason >= totalSeasons && totalSeasons > 0;
      showInfo(isLastSeason ? "¡Final alcanzado! Pulsa de nuevo para completar." : "Temporada terminada. Pulsa de nuevo para la siguiente.");
    } else {
      showSuccess(`+1 Capítulo a ${item.aiData.title}`);
    }
  }
  // Logic: Transition (Next Season or Complete) if full
  else {
    if (currentSeason < totalSeasons && totalSeasons > 0) {
      const newHistory = (accumulated_consumption || 0) + watchedEpisodes;
      const updated = {
        ...item,
        trackingData: {
          ...item.trackingData,
          currentSeason: currentSeason + 1,
          watchedEpisodes: 0,
          accumulated_consumption: newHistory
        },
        lastInteraction: Date.now()
      };
      await saveMediaItem(updated);
      useLibraryStore.setState(s => ({ library: s.library.map(i => i.id === item.id ? updated : i) }));
      showSuccess(`Comenzando Temporada ${currentSeason + 1}`);
    } else {
      const updated: MediaItem = {
        ...item,
        trackingData: { ...item.trackingData, status: 'Completado' },
        lastInteraction: Date.now()
      };
      await saveMediaItem(updated);
      useLibraryStore.setState(s => ({ library: s.library.map(i => i.id === item.id ? updated : i) }));
      showSuccess(`¡${item.aiData.title} Completado!`);
    }
  }
};

export const toggleFavorite = async (item: MediaItem): Promise<void> => {
  const updated = {
    ...item,
    trackingData: { ...item.trackingData, is_favorite: !item.trackingData.is_favorite }
  };
  await saveMediaItem(updated);
  useLibraryStore.setState(s => ({ library: s.library.map(i => i.id === item.id ? updated : i) }));
};
