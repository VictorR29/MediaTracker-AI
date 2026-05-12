import { useMemo } from 'react';
import { MediaItem } from '../../types';
import { StatsData, DurationPreferences, computeStats } from './StatsData';

export function useStatsComputations(
  library: MediaItem[],
  durations: DurationPreferences
): StatsData {
  return useMemo(() => computeStats(library, durations), [library, durations]);
}
