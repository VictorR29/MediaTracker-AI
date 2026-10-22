import React, { useState, useMemo, useEffect } from 'react';
import { MediaItem } from '../types';
import { getRecommendations } from '../services/geminiService';
import { fetchDiscoveryDeck } from '../services/anilistDiscovery';
import { AniListError } from '../services/anilistService';
import { computeTasteProfile } from '../services/tasteProfile';
import { FilterView } from './discovery/FilterView';
import { ImmersiveView } from './discovery/ImmersiveView';
import { MOOD_OPTIONS } from './discovery/constants';
import { getMoodGenres, getMoodTags, toAniListDeckCard } from './discovery/deck';
import { useSynopsisTranslation } from './discovery/useSynopsisTranslation';
import type { AniListDeckCard, DeckCard } from './discovery/types';

/** Cards revealed per batch. The engine returns up to 50, so one deck holds 2-3 rounds. */
const REVEAL_BATCH_SIZE = 20;

interface DiscoveryViewProps {
  library: MediaItem[];
  apiKey: string;
  onSelectRecommendation: (title: string, type: string) => void;
  onAddAniList?: (card: AniListDeckCard) => Promise<void> | void;
  onToggleImmersive?: (isImmersive: boolean) => void;
}

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({ library, apiKey, onSelectRecommendation, onAddAniList, onToggleImmersive }) => {
  // Mode State
  const [viewMode, setViewMode] = useState<'filters' | 'immersive'>('filters');

  // Filter State
  const [selectedType, setSelectedType] = useState<string>('Anime');
  const [selectedSeeds, setSelectedSeeds] = useState<string[]>([]);
  const [seedSearchQuery, setSeedSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  // AniList-only catalog filters. The Gemini path does not use them.
  const [epochFilter, setEpochFilter] = useState<number | null>(2000);
  const [onlyFirstSeason, setOnlyFirstSeason] = useState(true);

  // Accordion States
  const [isRefineOpen, setIsRefineOpen] = useState(true);
  const [isMoodOpen, setIsMoodOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  // Recommendations State
  const [recommendations, setRecommendations] = useState<DeckCard[]>([]);
  // Full AniList deck; `recommendations` is the revealed slice of it.
  const [pool, setPool] = useState<AniListDeckCard[]>([]);
  const [shownCount, setShownCount] = useState(0);
  const [sessionExcludedTitles, setSessionExcludedTitles] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Genre-pool page and whether AniList has anything left beyond the current deck.
  const [page, setPage] = useState(1);
  const [isExhausted, setIsExhausted] = useState(false);

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
  const { topGenres, likedTitles, excludedTitles, topEmotions } = useMemo(
    () => computeTasteProfile(library, selectedType, selectedSeeds),
    [library, selectedType, selectedSeeds]
  );

  // --- LOGIC: On-demand Spanish synopses ---
  // `recommendations` is state on purpose: `displayCards` below is a new array on
  // every render, and feeding it to the hook would restart its effect forever.
  const translations = useSynopsisTranslation(recommendations, currentIndex, apiKey);

  // Cards handed to the deck carry the Spanish synopsis when one is cached.
  // `onAddAniList` receives these cards, so an item added here stores the Spanish
  // text at add time; `anilistService` never writes `synopsis` on its daily sync,
  // so that translation survives the refresh.
  const displayCards = useMemo(
    () => recommendations.map(card =>
      card.kind === 'anilist' && translations[card.anilistId]
        ? { ...card, synopsis: translations[card.anilistId] }
        : card
    ),
    [recommendations, translations],
  );

  // --- ACTIONS ---

  /** Gemini deck. Used by every non-Anime type, and as the AniList fallback. */
  const handleGeminiDiscovery = async (isLoadMore = false) => {
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
      // Resolve mood: send keywords (precise for Gemini) instead of raw Spanish label
      const moodKeywords = selectedMood
        ? MOOD_OPTIONS.find(m => m.label === selectedMood)?.keywords || selectedMood
        : undefined;
      const results = await getRecommendations(
        likedTitles, topGenres, allExcluded, selectedType, apiKey,
        moodKeywords, topEmotions, isLoadMore
      );

      if (results.length > 0) {
        setRecommendations(results.map(result => ({ ...result, kind: 'ai' as const })));
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

  /** AniList deck. Anime only: this is the one type the engine can serve. */
  const handleAniListDiscovery = async (isLoadMore = false) => {
    // Still unshown cards in the current deck: reveal them, no request needed.
    if (isLoadMore && shownCount < pool.length) {
      const nextCount = Math.min(shownCount + REVEAL_BATCH_SIZE, pool.length);
      setShownCount(nextCount);
      setRecommendations(pool.slice(0, nextCount));
      return;
    }

    // The current batch ran out: ask for the next page of the pool and append
    // it, instead of resetting the deck the user is already standing on.
    const isNextPage = isLoadMore && pool.length > 0;
    if (isNextPage && isExhausted) return;

    if (!isLoadMore) {
      setPool([]);
      setShownCount(0);
      setRecommendations([]);
      setPage(1);
      setIsExhausted(false);
      setCurrentIndex(0);
    }

    setIsLoading(true);
    setError(null);
    setViewMode('immersive');

    try {
      const seeds = library.flatMap(item => {
        const anilistId = item.aiData.anilist?.id;
        if (!selectedSeeds.includes(item.id) || typeof anilistId !== 'number') return [];
        return [{ anilistId, title: item.aiData.title }];
      });

      const libraryIds = library
        .map(item => item.aiData.anilist?.id)
        .filter((id): id is number => typeof id === 'number');

      const candidates = await fetchDiscoveryDeck({
        // Seed picks are not paged, so they are only harvested on the first page.
        seeds: isNextPage ? [] : seeds,
        fallbackGenres: topGenres,
        // Later pages also drop everything already shown, so the deck keeps moving.
        excludeAniListIds: isNextPage
          ? [...libraryIds, ...pool.map(card => card.anilistId)]
          : libraryIds,
        excludeTitles: library.map(item => item.aiData.title),
        moodGenres: getMoodGenres(selectedMood),
        // Tags only score the pool locally; the genres above source it.
        moodTags: getMoodTags(selectedMood),
        // With a key, Gemini curates the pool and writes a Spanish reason per card.
        curation: apiKey ? { apiKey, moodLabel: selectedMood ?? undefined } : undefined,
        limit: 50,
        page: isNextPage ? page + 1 : 1,
        minYear: epochFilter ?? undefined,
        collapseSeasons: onlyFirstSeason,
      });

      const cards = candidates.map(toAniListDeckCard);

      if (isNextPage) {
        if (cards.length === 0) {
          setIsExhausted(true);
          return;
        }

        const merged = [...pool, ...cards];
        const revealed = Math.min(shownCount + REVEAL_BATCH_SIZE, merged.length);
        setPool(merged);
        setShownCount(revealed);
        setRecommendations(merged.slice(0, revealed));
        // currentIndex stays put: it already pointed at the first new card.
        setPage(page + 1);
        return;
      }

      const revealed = Math.min(REVEAL_BATCH_SIZE, cards.length);
      setPool(cards);
      setShownCount(revealed);
      setRecommendations(cards.slice(0, revealed));
      setCurrentIndex(0);

      if (cards.length === 0) {
        setIsExhausted(true);
        setError('No encontramos recomendaciones nuevas con esos filtros.');
      }
    } catch (err) {
      if (err instanceof AniListError) {
        if (apiKey) {
          // The deck must not die because AniList is down: fall back silently.
          await handleGeminiDiscovery(isLoadMore);
          return;
        }
        setError('No se pudo consultar AniList. Probá de nuevo en un minuto.');
      } else {
        console.error(err);
        setError("No se pudieron generar recomendaciones. Intenta ajustar los filtros.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscovery = async (isLoadMore = false) => {
    // A rapid double tap must not fire two decks; the deck is stateful.
    if (isLoading) return;

    if (selectedType === 'Anime') {
      await handleAniListDiscovery(isLoadMore);
      return;
    }
    await handleGeminiDiscovery(isLoadMore);
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
        recommendations={displayCards}
        currentIndex={currentIndex}
        onSetCurrentIndex={setCurrentIndex}
        isLoading={isLoading}
        selectedMood={selectedMood}
        onSelectRecommendation={onSelectRecommendation}
        onAddAniList={onAddAniList}
        isExhausted={isExhausted}
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
      epochFilter={epochFilter}
      onSelectEpoch={setEpochFilter}
      onlyFirstSeason={onlyFirstSeason}
      onToggleOnlyFirstSeason={() => setOnlyFirstSeason(prev => !prev)}
      isCatalogOpen={isCatalogOpen}
      onToggleCatalogPanel={() => setIsCatalogOpen(prev => !prev)}
      isLoading={isLoading}
      error={error}
      onGenerate={() => handleDiscovery(false)}
    />
  );
};
