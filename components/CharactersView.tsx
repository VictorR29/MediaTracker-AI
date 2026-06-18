import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Shuffle, Filter, Camera, Link, Upload, X, LayoutGrid, CreditCard } from 'lucide-react';
import { MediaItem } from '../types';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useToast } from '../context/ToastContext';
import { useUIStore } from '../stores/useUIStore';
import { createPortal } from 'react-dom';

interface CharacterEntry {
  mediaId: string;
  mediaTitle: string;
  coverImage?: string;
  primaryColor?: string;
  character: { name: string; image?: string };
  genres: string[];
}

interface CharacterWithRank extends CharacterEntry {
  rankInWork: number;
  totalInWork: number;
}

// Image compression helper
const compressImage = (base64Str: string, maxWidth: number = 200, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        try {
          ctx.drawImage(img, 0, 0, width, height);
          const newBase64 = canvas.toDataURL('image/webp', quality);
          resolve(newBase64);
        } catch {
          resolve(base64Str);
        }
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

// Fisher-Yates shuffle
const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Per-work rank badge
const WorkRankBadge: React.FC<{ rank: number; total: number }> = ({ rank, total }) => {
  if (total <= 1) return null;
  return (
    <div className="absolute bottom-2 right-2 z-20 bg-yellow-500/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-lg">
      <span className="text-[9px] font-black text-black tracking-wider">
        {rank}/{total}
      </span>
    </div>
  );
};

export const CharactersView: React.FC = () => {
  const library = useLibraryStore(state => state.library);
  const updateItem = useLibraryStore(state => state.updateItem);
  const { showToast } = useToast();
  const { setImmersiveMode } = useUIStore();
  const navigate = useNavigate();

  const [activeGenre, setActiveGenre] = useState<string>('Todos');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'trending'>('grid');
  const [trendingIndex, setTrendingIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');

  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchEndRef = useRef<{ x: number; y: number } | null>(null);

  // Collect all genres from library
  const genres = useMemo(() => {
    const genreSet = new Set<string>();
    library.forEach(item => item.aiData.genres?.forEach(g => genreSet.add(g)));
    return ['Todos', ...Array.from(genreSet).sort()];
  }, [library]);

  // Collect all characters from works
  const baseCharacters: CharacterEntry[] = useMemo(() => {
    return library
      .filter(item => {
        const chars = item.trackingData.favoriteCharacters;
        return chars && chars.length > 0 && chars[0]?.name;
      })
      .flatMap(item =>
        item.trackingData.favoriteCharacters
          .filter(char => char.name)
          .map(char => ({
            mediaId: item.id,
            mediaTitle: item.aiData.title,
            coverImage: item.aiData.coverImage,
            primaryColor: item.aiData.primaryColor,
            character: char,
            genres: item.aiData.genres || [],
          }))
      );
  }, [library]);

  // Shuffle key for re-shuffling
  const shuffleKey = useMemo(
    () => library.length + library.reduce((acc, i) => acc + (i.trackingData.watchedEpisodes || 0), 0),
    [library]
  );

  const [shuffledChars, setShuffledChars] = useState<CharacterEntry[]>([]);
  const [lastShuffleKey, setLastShuffleKey] = useState<number>(shuffleKey);

  const allCharacters = useMemo(() => {
    if (shuffleKey !== lastShuffleKey) {
      const shuffled = shuffleArray(baseCharacters);
      setShuffledChars(shuffled);
      setLastShuffleKey(shuffleKey);
      return shuffled;
    }
    return shuffledChars.length > 0 ? shuffledChars : baseCharacters;
  }, [shuffleKey, lastShuffleKey, baseCharacters, shuffledChars]);

  // Filter characters by genre
  const characters = useMemo(() => {
    if (activeGenre === 'Todos') return allCharacters;
    return allCharacters.filter(c => c.genres.includes(activeGenre));
  }, [allCharacters, activeGenre]);

  // Per-work ranking: group by mediaId, assign ranks
  const charactersWithRank = useMemo(() => {
    const workMap = new Map<string, number>();
    return characters.map(c => {
      const count = workMap.get(c.mediaId) || 0;
      workMap.set(c.mediaId, count + 1);
      return { ...c, rankInWork: count + 1, totalInWork: 0 };
    });
  }, [characters]);

  const charactersWithTotal = useMemo(() => {
    const totals = new Map<string, number>();
    charactersWithRank.forEach(c => totals.set(c.mediaId, (totals.get(c.mediaId) || 0) + 1));
    return charactersWithRank.map(c => ({ ...c, totalInWork: totals.get(c.mediaId) || 1 }));
  }, [charactersWithRank]);

  // Progress calculation
  const totalWorks = library.length;
  const discoveredWorks = useMemo(() => {
    const discovered = new Set<string>();
    library.forEach(item => {
      if (item.trackingData.favoriteCharacters?.length > 0) {
        discovered.add(item.id);
      }
    });
    return discovered.size;
  }, [library]);

  const progressPercent = totalWorks > 0 ? (discoveredWorks / totalWorks) * 100 : 0;
  const dynamicColor = characters.length > 0 && characters[0].primaryColor ? characters[0].primaryColor : '#eab308';

  const handleShuffle = () => {
    setShuffledChars(shuffleArray(allCharacters));
  };

  // Image upload handlers
  const updateCharacterImage = async (mediaId: string, imageUrl: string) => {
    setUploadingId(mediaId);
    try {
      const compressed = await compressImage(imageUrl);
      const item = library.find(i => i.id === mediaId);
      if (item) {
        const updatedChars = [...item.trackingData.favoriteCharacters];
        const charIndex = updatedChars.findIndex(c => c.image === undefined || c.image === '');
        if (charIndex >= 0) {
          updatedChars[charIndex] = { ...updatedChars[charIndex], image: compressed };
        } else if (updatedChars.length > 0) {
          updatedChars[0] = { ...updatedChars[0], image: compressed };
        }
        await updateItem({
          ...item,
          trackingData: { ...item.trackingData, favoriteCharacters: updatedChars },
        });
        showToast('Imagen del personaje actualizada', 'success');
      }
    } catch (err) {
      console.error('Failed to update character image:', err);
      showToast('Error al guardar imagen', 'error');
    }
    setUploadingId(null);
    setEditingId(null);
    setUrlInput('');
  };

  const handleFileUpload = (mediaId: string, file: File) => {
    setUploadingId(mediaId);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await updateCharacterImage(mediaId, base64);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileUpload = (mediaId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFileUpload(mediaId, file);
    };
    input.click();
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim() && editingId) {
      updateCharacterImage(editingId, urlInput.trim());
    }
  };

  // 3D Tilt effect
  const applyTilt = useCallback((clientX: number, clientY: number, isActive: boolean) => {
    if (!cardRef.current) return;
    if (!isActive) {
      cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
      return;
    }
    const { left, top, width, height } = cardRef.current.getBoundingClientRect();
    const x = (clientX - left) / width;
    const y = (clientY - top) / height;
    const tiltX = (0.5 - y) * 15;
    const tiltY = (x - 0.5) * 15;
    cardRef.current.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
  }, []);

  // Trending view navigation
  const goToNextCard = useCallback(() => {
    if (isTransitioning || characters.length === 0) return;
    setIsTransitioning(true);
    setSlideDirection('left');
    setTimeout(() => {
      setTrendingIndex(prev => (prev + 1) % characters.length);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 200);
  }, [isTransitioning, characters.length]);

  const goToPrevCard = useCallback(() => {
    if (isTransitioning || characters.length === 0) return;
    setIsTransitioning(true);
    setSlideDirection('right');
    setTimeout(() => {
      setTrendingIndex(prev => (prev - 1 + characters.length) % characters.length);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 200);
  }, [isTransitioning, characters.length]);

  // Touch handlers for swipe + tilt
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchEndRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchEndRef.current = { x: touch.clientX, y: touch.clientY };

    // Apply tilt on touch move
    if (!touchStartRef.current) return;
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
    // Only tilt if not primarily horizontal swipe
    if (dx < 50 || dy > dx) {
      applyTilt(touch.clientX, touch.clientY, true);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;

    const dx = touchStartRef.current.x - touchEndRef.current.x;
    const dy = Math.abs(touchStartRef.current.y - touchEndRef.current.y);
    const minSwipeDistance = 50;

    // Reset tilt
    applyTilt(0, 0, false);

    // Only swipe if horizontal distance is dominant
    if (Math.abs(dx) >= minSwipeDistance && Math.abs(dx) > dy) {
      if (dx > 0) {
        goToNextCard();
      } else {
        goToPrevCard();
      }
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  // Mouse handlers for desktop tilt
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    applyTilt(e.clientX, e.clientY, true);
  }, [applyTilt]);

  const handleMouseLeave = useCallback(() => {
    applyTilt(0, 0, false);
  }, [applyTilt]);

  // Reset trending index when characters change
  useEffect(() => {
    if (trendingIndex >= characters.length) {
      setTrendingIndex(0);
    }
  }, [characters.length, trendingIndex]);

  // Toggle immersive mode to hide app header + bottom nav in trending view
  useEffect(() => {
    if (viewMode === 'trending') {
      setImmersiveMode(true);
    }
    return () => setImmersiveMode(false);
  }, [viewMode, setImmersiveMode]);

  return (
    <div className="bg-[#09090B] min-h-screen">
      {/* Fixed header - only in grid mode */}
      {viewMode === 'grid' && (
        <div className="fixed top-[60px] left-0 right-0 z-50 bg-[#09090B]/95 backdrop-blur-md border-b border-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <Crown
                className="w-5 h-5"
                style={{ color: '#eab308', filter: 'drop-shadow(0 0 6px rgba(234, 179, 8, 0.5))' }}
              />
              <h1 className="text-lg font-bold text-white tracking-tight">
                Colección de Personajes
              </h1>
            </div>

            <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Vista de cuadrícula"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('trending')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'trending'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Vista trending"
              >
                <CreditCard className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleShuffle}
              className="p-2 -mr-2 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
              title="Reordenar"
            >
              <Shuffle className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 pb-3">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
              <span>{discoveredWorks} de {totalWorks} descubiertos</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: `linear-gradient(90deg, ${dynamicColor}, ${dynamicColor}88)`,
                  boxShadow: `0 0 8px ${dynamicColor}66`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Genre filter bar - only in grid mode */}
      {viewMode === 'grid' && (
        <div className="pt-[180px] px-4 pb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {genres.map(genre => (
              <button
                key={genre}
                onClick={() => setActiveGenre(genre)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
                  activeGenre === genre
                    ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40'
                    : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Character cards grid */}
      {viewMode === 'grid' && (
        <div className="px-4 pb-8">
          {characters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                <Filter className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-500 text-sm max-w-xs">
                Agregá personajes a tus obras para ver tu colección
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {charactersWithTotal.map((entry, idx) => {
                const cardKey = `${entry.mediaId}-${entry.character.name}`;
                const isUploading = uploadingId === entry.mediaId;
                const hasImage = !!entry.character.image;
                const initial = entry.character.name.charAt(0).toUpperCase();
                const cardColor = entry.primaryColor || dynamicColor;

                return (
                  <div
                    key={cardKey}
                    className="relative rounded-2xl overflow-hidden group cursor-pointer active:scale-95 transition-transform"
                    style={{
                      animation: `staggerIn 0.4s ease-out ${idx * 0.06}s both`,
                      boxShadow: `0 0 15px ${cardColor}33`,
                    }}
                  >
                    <WorkRankBadge rank={entry.rankInWork} total={entry.totalInWork} />

                    <div className="absolute inset-0">
                      {entry.coverImage ? (
                        <img
                          src={entry.coverImage}
                          alt=""
                          className="w-full h-full object-cover scale-110 blur-md brightness-50"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
                      )}
                      <div className="absolute inset-0 bg-black/40" />
                    </div>

                    <div className="relative z-10 flex flex-col items-center justify-center p-5 pt-6 min-h-[220px]">
                      {hasImage ? (
                        <div
                          className="w-20 h-20 rounded-full overflow-hidden ring-2 shadow-lg mb-3"
                          style={{ borderColor: `${cardColor}66` }}
                        >
                          <img
                            src={entry.character.image}
                            alt={entry.character.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className="w-20 h-20 rounded-full bg-white/10 ring-2 shadow-lg flex items-center justify-center mb-3"
                          style={{ borderColor: `${cardColor}66` }}
                        >
                          <span className="text-2xl font-bold text-white/80">{initial}</span>
                        </div>
                      )}

                      <p className="text-sm font-bold text-white text-center truncate w-full px-1">
                        {entry.character.name}
                      </p>

                      <p className="text-[10px] text-zinc-400 text-center truncate w-full px-1 mt-1">
                        {entry.mediaTitle}
                      </p>

                      <div className="flex flex-wrap justify-center gap-1 mt-2">
                        {entry.genres.slice(0, 2).map(genre => (
                          <span
                            key={genre}
                            className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase"
                            style={{
                              background: `${cardColor}22`,
                              color: cardColor,
                            }}
                          >
                            {genre}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(entry.mediaId);
                        }}
                        className="absolute top-3 right-3 p-1.5 bg-black/60 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5 text-white" />
                      </button>

                      {isUploading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Trending card view — Discovery/ImmersiveView double-bezel pattern */}
      {viewMode === 'trending' && characters.length > 0 && (
        <div
          className="fixed inset-0 z-[60] bg-[#09090B] overflow-hidden touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close button */}
          <button
            onClick={() => setViewMode('grid')}
            className="fixed top-4 left-4 z-[100] p-2.5 bg-white/20 rounded-full backdrop-blur-md hover:bg-white/30 transition-colors ring-1 ring-white/20 pointer-events-auto"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Blurred cover background */}
          <div className="absolute inset-0 overflow-hidden">
            {characters[trendingIndex]?.coverImage ? (
              <img
                src={characters[trendingIndex].coverImage}
                alt=""
                className="w-full h-full object-cover scale-110 blur-xl brightness-30"
                key={trendingIndex}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-950" />
            )}
            <div className="absolute inset-0 bg-black/60" />
          </div>

          {/* CARD — centered in viewport */}
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div
              className={`w-full max-w-md px-6 h-[65vh] pointer-events-auto -mt-[8vh] transition-all duration-200 ${
                isTransitioning
                  ? slideDirection === 'left'
                    ? 'opacity-0 -translate-x-8'
                    : 'opacity-0 translate-x-8'
                  : 'opacity-100 translate-x-0'
              }`}
            >
            {/* The actual card — double-bezel: outer ring + inner content */}
            <div
              ref={cardRef}
              className="relative w-full h-full rounded-[2rem] bg-[#111113] p-1.5 ring-1 ring-white/[0.06] cursor-pointer"
              style={{
                transformStyle: 'preserve-3d',
                transition: 'transform 0.1s ease-out',
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {/* Inner content area with blurred cover background */}
              <div className="absolute inset-0 rounded-[calc(2rem-0.375rem)] overflow-hidden bg-[#18181B]">
                {/* Blurred cover image as card background */}
                {characters[trendingIndex]?.coverImage ? (
                  <img
                    src={characters[trendingIndex].coverImage}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-md brightness-[0.35]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
                )}
                <div className="absolute inset-0 bg-black/40" />

                {/* Content — centered with gap */}
                <div className="relative z-10 flex flex-col items-center h-full justify-center gap-6">
                  {/* Top: upload button (absolute top-right) */}
                  <button
                    onClick={() => setEditingId(characters[trendingIndex]?.mediaId)}
                    className="absolute top-4 right-4 z-20 p-2 bg-black/60 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors"
                  >
                    <Camera className="w-4 h-4 text-white" />
                  </button>

                  {/* Upper area: character image (large circle) */}
                  <div className="flex items-center justify-center">
                    {characters[trendingIndex]?.character.image ? (
                      <div
                        className="w-36 h-36 rounded-full overflow-hidden ring-4 shadow-2xl"
                        style={{
                          borderColor: `${characters[trendingIndex]?.primaryColor || dynamicColor}88`,
                          boxShadow: `0 0 40px ${characters[trendingIndex]?.primaryColor || dynamicColor}44`,
                        }}
                      >
                        <img
                          src={characters[trendingIndex].character.image}
                          alt={characters[trendingIndex].character.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-36 h-36 rounded-full bg-white/10 ring-4 shadow-2xl flex items-center justify-center"
                        style={{
                          borderColor: `${characters[trendingIndex]?.primaryColor || dynamicColor}88`,
                          boxShadow: `0 0 40px ${characters[trendingIndex]?.primaryColor || dynamicColor}44`,
                        }}
                      >
                        <span className="text-5xl font-bold text-white/80">
                          {characters[trendingIndex]?.character.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Middle: character name + work title */}
                  <div className="text-center px-6">
                    <h2 className="text-2xl font-black text-white tracking-tight mb-1">
                      {characters[trendingIndex]?.character.name}
                    </h2>
                    <p className="text-sm text-zinc-300">
                      {characters[trendingIndex]?.mediaTitle}
                    </p>
                  </div>

                  {/* Lower middle: genre tags */}
                  <div className="flex flex-wrap justify-center gap-1.5 px-6">
                    {characters[trendingIndex]?.genres.slice(0, 3).map(genre => (
                      <span
                        key={genre}
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{
                          background: `${characters[trendingIndex]?.primaryColor || dynamicColor}33`,
                          color: characters[trendingIndex]?.primaryColor || dynamicColor,
                        }}
                      >
                        {genre}
                      </span>
                    ))}
                  </div>

                  {/* Bottom: ranking badge */}
                  {characters[trendingIndex] && (() => {
                    const char = characters[trendingIndex];
                    const workChars = charactersWithTotal.filter(c => c.mediaId === char.mediaId);
                    const rankEntry = workChars.find(c => c.character.name === char.character.name);
                    if (rankEntry && rankEntry.totalInWork > 1) {
                      return (
                        <div className="bg-yellow-500/90 backdrop-blur-sm px-3 py-1 rounded-full">
                          <span className="text-xs font-black text-black tracking-wider">
                            {rankEntry.rankInWork}/{rankEntry.totalInWork}
                          </span>
                        </div>
                      );
                    }
                    return <div />;
                  })()}
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Tap zones for swipe */}
          <div className="absolute inset-0 z-20 flex pointer-events-none">
            <button
              onClick={goToPrevCard}
              className="w-1/3 h-full pointer-events-auto opacity-0"
              aria-label="Previous character"
            />
            <div className="w-1/3 h-full" />
            <button
              onClick={goToNextCard}
              className="w-1/3 h-full pointer-events-auto opacity-0"
              aria-label="Next character"
            />
          </div>


        </div>
      )}

      {/* Image upload modal */}
      {editingId &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#1C1C1F] rounded-2xl p-6 w-full max-w-sm ring-1 ring-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Imagen del Personaje</h3>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setUrlInput('');
                  }}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <button
                onClick={() => {
                  const id = editingId;
                  setEditingId(null);
                  if (id) triggerFileUpload(id);
                }}
                className="w-full flex items-center gap-3 p-4 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl ring-1 ring-white/[0.08] transition-colors mb-3"
              >
                <div className="p-2 bg-violet-500/20 rounded-lg">
                  <Upload className="w-5 h-5 text-violet-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-white">Subir archivo</p>
                  <p className="text-xs text-zinc-400">JPG, PNG, GIF</p>
                </div>
              </button>

              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                    placeholder="https://..."
                    className="w-full bg-zinc-900 ring-1 ring-white/[0.06] rounded-xl pl-9 pr-4 py-3 text-sm text-white outline-none focus:ring-white/20 placeholder:text-zinc-600"
                  />
                </div>
                <button
                  onClick={handleUrlSubmit}
                  disabled={!urlInput.trim()}
                  className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl font-medium transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
