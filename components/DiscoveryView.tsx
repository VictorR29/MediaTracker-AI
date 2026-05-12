import React, { useState, useMemo, useEffect } from 'react';
import { MediaItem } from '../types';
import { getRecommendations, RecommendationResult } from '../services/geminiService';
import { computeTasteProfile } from '../services/tasteProfile';
import { FilterView } from './discovery/FilterView';
import { ImmersiveView } from './discovery/ImmersiveView';

interface DiscoveryViewProps {
  library: MediaItem[];
  apiKey: string;
  onSelectRecommendation: (title: string, type: string) => void;
  onToggleImmersive?: (isImmersive: boolean) => void;
}

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({ library, apiKey, onSelectRecommendation, onToggleImmersive }) => {
  // Mode State
  const [viewMode, setViewMode] = useState<'filters' | 'immersive'>('filters');

  // Filter State
  const [selectedType, setSelectedType] = useState<string>('Anime');
  const [selectedSeeds, setSelectedSeeds] = useState<string[]>([]);
  const [seedSearchQuery, setSeedSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  // Accordion States
  const [isRefineOpen, setIsRefineOpen] = useState(true);
  const [isMoodOpen, setIsMoodOpen] = useState(false);

  // Recommendations State
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [sessionExcludedTitles, setSessionExcludedTitles] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- IMMERSIVE MODE HANDLER ---
  useEffect(() => {
    if (onToggleImmersive) {
      onToggleImmersive(viewMode === 'immersive');
    }
    return () => {
      if (onToggleImmersive) onToggleImmersive(false);
    };
  }, [viewMode, onToggleImmersive]);

  // --- LOGIC: Taste Profile Computation ---
  const { topGenres, likedTitles, excludedTitles } = useMemo(
    () => computeTasteProfile(library, selectedType, selectedSeeds),
    [library, selectedType, selectedSeeds]
  );

  // --- ACTIONS ---

  const handleDiscovery = async (isLoadMore = false) => {
    if (!apiKey) {
      setError("Configura tu API Key en ajustes para usar la IA.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setViewMode('immersive');

    if (!isLoadMore) {
      setRecommendations([]);
      setSessionExcludedTitles([]);
    }

    try {
      const allExcluded = [...excludedTitles, ...sessionExcludedTitles];
      const results = await getRecommendations(likedTitles, topGenres, allExcluded, selectedType, apiKey, selectedMood || undefined);

      if (results.length > 0) {
        setRecommendations(results);
        setSessionExcludedTitles(prev => [...prev, ...results.map(r => r.title)]);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error(err);
      setError("No se pudieron generar recomendaciones. Intenta ajustar los filtros.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- SEED INTERACTION HANDLERS ---

  const handleToggleSeed = (id: string) => {
    setSelectedSeeds(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
    if (!selectedSeeds.includes(id)) setSeedSearchQuery('');
  };

  const handleGoBack = () => setViewMode('filters');

  // --- RENDER ---

  if (viewMode === 'immersive') {
    return (
      <ImmersiveView
        recommendations={recommendations}
        currentIndex={currentIndex}
        onSetCurrentIndex={setCurrentIndex}
        isLoading={isLoading}
        selectedMood={selectedMood}
        onSelectRecommendation={onSelectRecommendation}
        onLoadMore={() => handleDiscovery(true)}
        onGoBack={handleGoBack}
      />
    );
  }

  return (
    <FilterView
      library={library}
      selectedType={selectedType}
      onSelectType={setSelectedType}
      selectedSeeds={selectedSeeds}
      onToggleSeed={handleToggleSeed}
      onClearSeeds={() => setSelectedSeeds([])}
      seedSearchQuery={seedSearchQuery}
      onSeedSearchChange={setSeedSearchQuery}
      selectedMood={selectedMood}
      onToggleMood={setSelectedMood}
      isRefineOpen={isRefineOpen}
      onToggleRefine={() => setIsRefineOpen(prev => !prev)}
      isMoodOpen={isMoodOpen}
      onToggleMoodPanel={() => setIsMoodOpen(prev => !prev)}
      isLoading={isLoading}
      error={error}
      onGenerate={() => handleDiscovery(false)}
    />
  );
};
