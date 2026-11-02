import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Crown, Shuffle, Filter, Camera, X, LayoutGrid, CreditCard } from 'lucide-react';
import { MediaItem } from '../types';
import { getGenres } from '../utils/genres';
import { compressImage } from '../utils/imageCompression';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useToast } from '../context/ToastContext';
import { useUIStore } from '../stores/useUIStore';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { CharacterImageModal } from './CharacterImageModal';
import { applyCharacterImage, pickImageFile, readFileAsDataUrl } from '../services/characterImage';

// Memoized background — never re-renders with the card
const BackgroundImage = React.memo(({ src }: { src: string | undefined }) => {
  if (!src) return null;
  return (
    <motion.img
      key={src}
      src={src}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="absolute inset-0 w-full h-full object-cover"
      style={{ filter: 'blur(60px) brightness(0.35)' }}
    />
  );
});
BackgroundImage.displayName = 'BackgroundImage';

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

// Card content renderer (shared between front/back faces)
const CardContent: React.FC<{
  char: CharacterEntry | null;
  dynamicColor: string;
  onUpload: () => void;
  workChars: CharacterEntry[];
  showCover?: boolean;
}> = ({ char, dynamicColor, onUpload, workChars, showCover }) => {
  if (!char) return null;
  const color = char.primaryColor || dynamicColor;

  // Front face: show cover image prominently
  if (showCover) {
    return (
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <button onClick={onUpload} className="absolute top-4 right-4 z-20 p-2 bg-black/60 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors">
          <Camera className="w-4 h-4 text-white" />
        </button>
        {char.coverImage ? (
          <img src={char.coverImage} alt="" className="w-full h-full object-cover rounded-[calc(2rem-0.375rem)]" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-[calc(2rem-0.375rem)]" />
        )}
      </div>
    );
  }

  // Back face: show character
  const hasImage = !!char.character.image;
  const initial = char.character.name.charAt(0).toUpperCase();
  const rankEntry = workChars.find(c => c.mediaId === char.mediaId && c.character.name === char.character.name);

  return (
    <div className="relative z-10 flex flex-col items-center h-full justify-center gap-6">
      <button onClick={onUpload} className="absolute top-4 right-4 z-20 p-2 bg-black/60 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors">
        <Camera className="w-4 h-4 text-white" />
      </button>

      {hasImage ? (
        <div className="w-36 h-36 rounded-full overflow-hidden ring-4 shadow-2xl" style={{ borderColor: `${color}88`, boxShadow: `0 0 40px ${color}44` }}>
          <img src={char.character.image} alt={char.character.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-36 h-36 rounded-full bg-white/10 ring-4 shadow-2xl flex items-center justify-center" style={{ borderColor: `${color}88`, boxShadow: `0 0 40px ${color}44` }}>
          <span className="text-5xl font-bold text-white/80">{initial}</span>
        </div>
      )}

      <div className="text-center px-6">
        <h2 className="text-2xl font-black text-white tracking-tight mb-1">{char.character.name}</h2>
        <p className="text-sm text-zinc-300">{char.mediaTitle}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 px-6">
        {char.genres.slice(0, 3).map(genre => (
          <span key={genre} className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: `${color}33`, color }}>
            {genre}
          </span>
        ))}
      </div>

      {rankEntry && rankEntry.totalInWork > 1 && (
        <div className="bg-yellow-500/90 backdrop-blur-sm px-3 py-1 rounded-full">
          <span className="text-xs font-black text-black tracking-wider">{rankEntry.rankInWork}/{rankEntry.totalInWork}</span>
        </div>
      )}
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
  // Which character the photo dialog is editing. The name travels with the id
  // because a work can hold several favourites and the write must hit the one
  // the user opened.
  const [editing, setEditing] = useState<{ mediaId: string; characterName: string } | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'trending'>('grid');
  const [trendingIndex, setTrendingIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  const [isShuffling, setIsShuffling] = useState(false);
  const [bgVersion, setBgVersion] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [frontData, setFrontData] = useState<CharacterEntry | null>(null);
  const [backData, setBackData] = useState<CharacterEntry | null>(null);
  const [bgChar, setBgChar] = useState<CharacterEntry | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchEndRef = useRef<{ x: number; y: number } | null>(null);

  // Collect all genres from library
  const genres = useMemo(() => {
    const genreSet = new Set<string>();
    library.forEach(item => getGenres(item).forEach(g => genreSet.add(g)));
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
            genres: getGenres(item),
          }))
      );
  }, [library]);

  // Shuffle key for re-shuffling
  const libraryChangeKey = useMemo(
    () => library.length + library.reduce((acc, i) => acc + (i.trackingData.watchedEpisodes || 0), 0),
    [library]
  );

  const [shuffledChars, setShuffledChars] = useState<CharacterEntry[]>([]);
  const [lastShuffleKey, setLastShuffleKey] = useState<number>(libraryChangeKey);

  const allCharacters = useMemo(() => {
    if (libraryChangeKey !== lastShuffleKey) {
      const shuffled = shuffleArray(baseCharacters);
      setShuffledChars(shuffled);
      setLastShuffleKey(libraryChangeKey);
      return shuffled;
    }
    return shuffledChars.length > 0 ? shuffledChars : baseCharacters;
  }, [libraryChangeKey, lastShuffleKey, baseCharacters, shuffledChars]);

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

  // Flip: tap card to reveal cover of CURRENT character (no data change)
  const handleFlip = useCallback(() => {
    if (isShuffling) return;
    setIsFlipped(prev => !prev);
  }, [isShuffling]);

  // Shuffle: change character with fade (no flip involved)
  const handleShuffle = useCallback(() => {
    if (isShuffling || characters.length === 0) return;
    setIsShuffling(true);
    const shuffled = shuffleArray(allCharacters);
    const next = shuffled[0] || null;
    if (!next) { setIsShuffling(false); return; }
    // Fade out → swap → fade in
    setIsFading(true);
    setTimeout(() => {
      setFrontData(next);
      setBackData(next);
      setShuffledChars(shuffled);
      setTrendingIndex(0);
      setBgChar(next);
      setBgVersion(v => v + 1);
      setTimeout(() => {
        setIsFading(false);
        setIsShuffling(false);
      }, 50);
    }, 250);
  }, [isShuffling, characters.length, allCharacters]);

  /**
   * A card knows its character as `{ character: { name } }`; the editor needs the
   * two ids flat. Converting in one place keeps every entry point consistent —
   * and the parameter type is checked, which matters while @types/react is absent
   * and the state setter itself is untyped.
   */
  const openCharacterEditor = (entry: { mediaId: string; character: { name: string } }) => {
    setEditing({ mediaId: entry.mediaId, characterName: entry.character.name });
  };

  // Image upload handlers
  const updateCharacterImage = async (
    target: { mediaId: string; characterName: string },
    imageUrl: string,
  ) => {
    setUploadingId(target.mediaId);
    try {
      const compressed = await compressImage(imageUrl, 200);
      const item = library.find(i => i.id === target.mediaId);
      const updated = item ? applyCharacterImage(item, target.characterName, compressed) : null;

      if (updated) {
        await updateItem(updated);
        showToast('Imagen del personaje actualizada', 'success');
      } else {
        // The character left the work while the dialog was open. Writing at any
        // index would put the photo on someone else.
        showToast('Ese personaje ya no está en la obra', 'error');
      }
    } catch (err) {
      console.error('Failed to update character image:', err);
      showToast('Error al guardar imagen', 'error');
    }
    setUploadingId(null);
    setEditing(null);
  };

  const uploadCharacterFile = async (target: { mediaId: string; characterName: string }, file: File) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await updateCharacterImage(target, dataUrl);
    } catch (err) {
      console.error('Failed to read character image:', err);
      setUploadingId(null);
      showToast('No se pudo leer la imagen', 'error');
    }
  };

  // 3D Tilt effect
  const lightRef = useRef<HTMLDivElement>(null);
  const applyTilt = useCallback((clientX: number, clientY: number, isActive: boolean) => {
    if (!cardRef.current) return;
    if (!isActive) {
      cardRef.current.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
      cardRef.current.style.transition = 'transform 0.4s cubic-bezier(0.03, 0.98, 0.52, 0.99)';
      if (lightRef.current) lightRef.current.style.opacity = '0';
      return;
    }
    const { left, top, width, height } = cardRef.current.getBoundingClientRect();
    const x = (clientX - left) / width;
    const y = (clientY - top) / height;
    const tiltX = (0.5 - y) * 22;
    const tiltY = (x - 0.5) * 22;
    const scale = 1 + Math.abs(x - 0.5) * 0.04 + Math.abs(y - 0.5) * 0.04;
    cardRef.current.style.transition = 'transform 0.1s ease-out';
    cardRef.current.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${scale})`;
    // Light reflection follows cursor
    if (lightRef.current) {
      lightRef.current.style.opacity = '1';
      lightRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.15) 0%, transparent 60%)`;
    }
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

    // If it was a tap (not a swipe), toggle flip
    if (Math.abs(dx) < minSwipeDistance && dy < minSwipeDistance) {
      handleFlip();
    } else if (Math.abs(dx) >= minSwipeDistance && Math.abs(dx) > dy) {
      // Swipe
      if (dx > 0) goToNextCard();
      else goToPrevCard();
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
    // The overlay only renders while there is a character to show. Deleting the
    // last one used to unmount it while viewMode stayed 'trending': the grid is
    // gated on 'grid' too, so the screen went blank with the app chrome hidden.
    if (characters.length === 0 && viewMode === 'trending') {
      setViewMode('grid');
    }
  }, [characters.length, trendingIndex, viewMode]);

  const trendingRef = useFocusTrap<HTMLDivElement>(
    viewMode === 'trending' && characters.length > 0,
    () => setViewMode('grid'),
  );

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
          <div className="flex items-center justify-between px-4 md:px-8 py-3">
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
                onClick={() => { setViewMode('trending'); setFrontData(characters[0] || null); setBackData(characters[0] || null); setBgChar(characters[0] || null); }}
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

          <div className="px-4 md:px-8 pb-3">
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
        <div className="pt-[180px] pb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {genres.map(genre => (
              <button
                key={genre}
                onClick={() => setActiveGenre(genre)}
                className={`flex-shrink-0 px-3 py-1.5 min-h-[36px] flex items-center rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
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
        <div className="pb-8">
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
                          openCharacterEditor(entry);
                        }}
                                                aria-label={`Cambiar imagen de ${entry.character.name}`}
                        className="absolute top-3 right-3 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center bg-black/60 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors"
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
          ref={trendingRef}
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

          {/* Shuffle button */}
          <button
            onClick={handleShuffle}
            className="fixed top-4 right-4 z-[100] p-2.5 bg-white/20 rounded-full backdrop-blur-md hover:bg-white/30 transition-colors ring-1 ring-white/20 pointer-events-auto"
          >
            <Shuffle className="w-5 h-5 text-white" />
          </button>

          {/* Blurred cover background — memoized, never re-renders with card */}
          <div className="absolute inset-0 overflow-hidden">
            <BackgroundImage src={bgChar?.coverImage} />
            <div className="absolute inset-0 bg-black/40" />
          </div>

          {/* CARD — 3D flip with tilt */}
          <div
            className="absolute left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-6"
            style={{ top: '12vh', height: '72vh', opacity: isFading ? 0 : 1, transition: 'opacity 0.25s ease-in-out' }}
          >
            <div
              ref={cardRef}
              className="relative w-full h-full cursor-pointer"
              style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
              onClick={handleFlip}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
            <motion.div
              className="relative w-full h-full"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Light reflection overlay — follows cursor */}
              <div
                ref={lightRef}
                className="absolute inset-0 z-30 pointer-events-none rounded-[2rem] opacity-0 transition-opacity duration-300"
                style={{ mixBlendMode: 'soft-light' }}
              />
              {/* FRONT FACE — character */}
              <div
                className="absolute inset-0 rounded-[2rem] bg-[#111113] p-1.5 ring-1 ring-white/[0.06]"
                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'translateZ(2px)' }}
              >
                <div className="absolute inset-0 rounded-[calc(2rem-0.375rem)] overflow-hidden bg-[#18181B]">
                  {frontData?.coverImage ? (
                    <img src={frontData.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-md brightness-[0.35]" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
                  )}
                  <div className="absolute inset-0 bg-black/40" />
                  <CardContent char={frontData} dynamicColor={dynamicColor} onUpload={() => frontData && openCharacterEditor(frontData)} workChars={charactersWithTotal} />
                </div>
              </div>

              {/* BACK FACE — cover of CURRENT character */}
              <div
                className="absolute inset-0 rounded-[2rem] bg-[#111113] p-1.5 ring-1 ring-white/[0.06]"
                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg) translateZ(2px)' }}
              >
                <div className="absolute inset-0 rounded-[calc(2rem-0.375rem)] overflow-hidden bg-[#18181B]">
                  {backData?.coverImage ? (
                    <img src={backData.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover rounded-[calc(2rem-0.375rem)]" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-[calc(2rem-0.375rem)]" />
                  )}
                </div>
              </div>
            </motion.div>
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

      <CharacterImageModal
        characterName={editing?.characterName ?? null}
        workTitle={editing ? library.find(i => i.id === editing.mediaId)?.aiData.title : undefined}
        onClose={() => setEditing(null)}
        onSaveUrl={(url) => { if (editing) updateCharacterImage(editing, url); }}
        onPickFile={() => { if (editing) pickImageFile((file) => uploadCharacterFile(editing, file)); }}
      />
    </div>
  );
};
