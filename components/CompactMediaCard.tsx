
import React, { useState, useEffect, useRef } from 'react';
import { MediaItem } from '../types';
import { Tv, BookOpen, Clapperboard, PlayCircle, Book, FileText, Plus, Check, Bell, Hourglass, CalendarDays, HelpCircle, Star, Image as ImageIcon, Trash2 } from 'lucide-react';

interface CompactMediaCardProps {
  item: MediaItem;
  onClick: () => void;
  onIncrement: (item: MediaItem) => void;
  onToggleFavorite?: (item: MediaItem) => void;
  onDelete?: (item: MediaItem) => void;
}

export const CompactMediaCard: React.FC<CompactMediaCardProps> = ({ item, onClick, onIncrement, onToggleFavorite, onDelete }) => {
  const { aiData, trackingData } = item;
  const isFavorite = trackingData.is_favorite || false;
  
  // Lazy Load State
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Use dynamic color if available, else fallback to primary variable (approx)
  const dynamicColor = aiData.primaryColor || '#6366f1';

  const isMovie = aiData.mediaType === 'Pelicula';
  const isBook = aiData.mediaType === 'Libro';
  const isReadingContent = ['Manhwa', 'Manga', 'Comic', 'Libro'].includes(aiData.mediaType);

  // Return Date Logic
  const isPaused = trackingData.status === 'En Pausa';
  const returnDate = trackingData.scheduledReturnDate;
  let isReturnDue = false;
  if (isPaused && returnDate) {
      const today = new Date().toISOString().split('T')[0];
      if (today >= returnDate) {
          isReturnDue = true;
      }
  }

  // Upcoming / Wishlist Logic
  const isPlanned = trackingData.status === 'Planeado / Pendiente';
  
  // Calculate Time Remaining for Upcoming Releases
  const getCountdown = (dateStr?: string) => {
    if (!dateStr || !isPlanned) return null;
    const target = new Date(dateStr);
    const now = new Date();
    if (isNaN(target.getTime())) return null; // Invalid date
    
    // Set both to midnight to compare just days roughly, or precise time
    const diffTime = target.getTime() - now.getTime();
    if (diffTime <= 0) return null; // Already passed

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 365) return `en ${Math.floor(diffDays/365)} años`;
    if (diffDays > 30) return `en ${Math.floor(diffDays/30)} meses`;
    return `en ${diffDays} días`;
  };

  // Prioritize user-defined next release date, otherwise use AI release date
  const targetDateDisplay = trackingData.nextReleaseDate || aiData.releaseDate;
  const timeRemaining = getCountdown(targetDateDisplay);

  // Calculate progress
  let progressPercent = 0;
  if (isMovie) {
      progressPercent = trackingData.status === 'Completado' ? 100 : 0;
  } else {
      progressPercent = trackingData.totalEpisodesInSeason > 0
        ? Math.min(100, (trackingData.watchedEpisodes / trackingData.totalEpisodesInSeason) * 100)
        : 0;
  }

  const isCompleteSeason = !isMovie && trackingData.totalEpisodesInSeason > 0 && trackingData.watchedEpisodes >= trackingData.totalEpisodesInSeason;

  // Icon based on type
  const TypeIcon = () => {
    switch (aiData.mediaType) {
      case 'Anime': return <Tv className="w-3 h-3" />;
      case 'Manhwa': 
      case 'Manga': return <BookOpen className="w-3 h-3" />;
      case 'Comic': return <FileText className="w-3 h-3" />;
      case 'Libro': return <Book className="w-3 h-3" />;
      default: return <Clapperboard className="w-3 h-3" />;
    }
  };

  const getPlaceholder = () => 
    `https://placehold.co/300x450/1e293b/94a3b8?text=${encodeURIComponent(aiData.title || 'Sin Imagen')}&font=roboto`;

  // Helper to check if string is a valid image source (URL or Data URI)
  const isValidSource = (src?: string) => 
    src && (src.startsWith('http') || src.startsWith('data:'));

  // Determine initial image (but don't load yet)
  const actualImageSource = isValidSource(aiData.coverImage)
    ? aiData.coverImage!
    : getPlaceholder();

  const [imgSrc, setImgSrc] = useState<string | undefined>(undefined);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Intersection Observer for Lazy Loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setImgSrc(actualImageSource); // Trigger image load
            observer.disconnect(); // Stop observing once visible
          }
        });
      },
      {
        rootMargin: '200px', // Start loading 200px before it enters viewport
        threshold: 0.01,
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, [actualImageSource]);

  const handleImageError = () => {
    if (imgSrc !== getPlaceholder()) {
      setImgSrc(getPlaceholder());
    }
  };

  const handleQuickAction = (e: React.MouseEvent) => {
      e.stopPropagation();
      onIncrement(item);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onToggleFavorite) {
          onToggleFavorite(item);
      }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDelete) {
          onDelete(item);
      }
  }

  const renderProgressText = () => {
      if (isMovie) {
          return trackingData.status === 'Completado' ? <span className="text-green-400 font-bold">Visto</span> : 'Pendiente';
      }
      
      const label = isBook ? 'Pág.' : 'Cap.';
      const progress = `${trackingData.watchedEpisodes}/${trackingData.totalEpisodesInSeason}`;
      return (
         <span className="flex items-center gap-1 font-mono">
            {isReadingContent ? <BookOpen className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
            {progress}
         </span>
      );
  };

  const renderSeasonText = () => {
      if (isMovie) return null;
      if (isBook) {
          return trackingData.isSaga ? <span>L. {trackingData.currentSeason}</span> : <span>Novela</span>;
      }
      return isReadingContent ? <span>Capítulos Acumulados</span> : <span>T. {trackingData.currentSeason}</span>;
  };

  const renderStatus = () => {
    if (trackingData.status === 'Viendo/Leyendo') {
        return isReadingContent ? 'Leyendo' : 'Viendo';
    }
    return trackingData.status;
  };

  return (
    <div 
      ref={cardRef}
      onClick={onClick}
      className={`group bg-surface rounded-xl overflow-hidden shadow-lg border border-slate-800 hover:border-opacity-50 cursor-pointer transition-all duration-700 ease-out hover:shadow-2xl relative ${isReturnDue ? 'ring-2 ring-red-500 shadow-red-900/40' : ''} ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
      style={{
        // Add a slight random delay for the staggered effect if loading multiple at once
        transitionDelay: `${Math.random() * 100}ms` 
      }}
    >
      {isReturnDue && (
          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 text-center z-30 flex items-center justify-center gap-1 shadow-md animate-pulse">
              <Bell className="w-3 h-3 fill-current" /> ¡Hora de Volver!
          </div>
      )}

      <div className="relative aspect-[2/3] md:aspect-[3/4] overflow-hidden bg-slate-900">
        {/* Placeholder / Skeleton while loading */}
        <div className={`absolute inset-0 bg-slate-800 animate-pulse transition-opacity duration-500 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`} />

        {/* The Actual Image */}
        {imgSrc && (
            <img 
            src={imgSrc} 
            alt={aiData.title}
            onError={handleImageError}
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-cover transition-all duration-700 ${
                imageLoaded ? 'opacity-90 group-hover:opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
            />
        )}
        
        {/* Favorite Toggle (Top Left) */}
        {onToggleFavorite && (
             <button
                onClick={handleFavoriteClick}
                className="absolute top-2 left-2 z-20 p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                title={isFavorite ? "Quitar de Favoritos" : "Marcar como Favorito"}
             >
                 <Star 
                    className={`w-4 h-4 md:w-5 md:h-5 transition-all ${isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300 hover:text-white'}`} 
                 />
             </button>
        )}
        {/* Always show star if favorite, even if not hovering */}
        {isFavorite && !onToggleFavorite && (
            <div className="absolute top-2 left-2 z-20 p-1.5 rounded-full bg-black/20 backdrop-blur-sm">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            </div>
        )}
        {isFavorite && onToggleFavorite && (
             <div className="absolute top-2 left-2 z-10 p-1.5 rounded-full bg-black/20 backdrop-blur-sm group-hover:opacity-0 transition-opacity">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            </div>
        )}

        {/* Delete Button (Top Right) - Added as requested */}
        {onDelete && (
             <button
                onClick={handleDeleteClick}
                className="absolute top-2 right-2 z-40 p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-300 hover:text-white"
                title="Eliminar Obra"
             >
                 <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
             </button>
        )}


        {/* Type Badge - Moved to Bottom Left (above title) to make room for Delete button */}
        <div className="absolute bottom-16 left-2 z-30">
            <span 
                className="flex items-center gap-1 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md text-white text-[9px] md:text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm"
                style={{ backgroundColor: dynamicColor }}
            >
                <TypeIcon />
                {aiData.mediaType}
            </span>
        </div>
        
        {/* Wishlist / Upcoming Context Overlays */}
        {isPlanned && (
             <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white backdrop-blur-[2px] p-4 text-center z-20">
                  {timeRemaining ? (
                    // Scenario A: Future Date Found
                    <>
                        <div className="bg-slate-900/80 p-2 md:p-3 rounded-full border border-slate-700 mb-2 shadow-xl">
                            <Hourglass className="w-5 h-5 md:w-6 md:h-6 text-yellow-400 animate-pulse" />
                        </div>
                        <span className="font-bold text-base md:text-lg leading-tight text-white drop-shadow-md">{timeRemaining}</span>
                        <span className="text-[10px] md:text-xs text-yellow-400 mt-1 font-bold bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-md border border-white/10">{targetDateDisplay}</span>
                    </>
                  ) : (
                    // Scenario B: No Date / Waiting for Announcement
                    <>
                         <div className="bg-slate-900/80 p-2 md:p-3 rounded-full border border-slate-700 mb-2 shadow-xl">
                            <CalendarDays className="w-5 h-5 md:w-6 md:h-6 text-slate-300" />
                        </div>
                        <span className="font-bold text-sm md:text-base leading-tight text-white drop-shadow-md">Pendiente Fecha</span>
                        <span className="text-[10px] md:text-xs text-slate-300 mt-1 font-medium bg-black/40 px-2 py-0.5 rounded-full">Esperando Anuncio</span>
                    </>
                  )}
             </div>
        )}

        {/* Quick Action Button - Floating on Image - Z-INDEX INCREASED TO 40 TO FIX OVERLAP */}
        {!isMovie && !isPlanned && trackingData.status === 'Viendo/Leyendo' && (
             <button
                onClick={handleQuickAction}
                className={`absolute bottom-16 md:bottom-14 right-2 w-10 h-10 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-lg transition-all transform active:scale-90 z-40 md:opacity-0 md:group-hover:opacity-100 opacity-100 ${
                    isCompleteSeason ? 'bg-green-500 hover:bg-green-600' : 'bg-white/90 hover:bg-white text-slate-900'
                }`}
                title={isCompleteSeason ? "Completar" : "+1"}
             >
                 {isCompleteSeason ? (
                     <Check className="w-5 h-5 text-white" />
                 ) : (
                     <Plus className="w-5 h-5" style={{ color: dynamicColor }} />
                 )}
             </button>
        )}

        {/* Title Container - Z-30 to sit above overlays */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent p-3 pt-12 z-30">
           <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow-md">{aiData.title}</h3>
           <p className="text-slate-400 text-[10px] md:text-xs mt-0.5 truncate">{renderStatus()}</p>
        </div>
      </div>
      
      {/* Progress Bar Mini - Dynamic Color */}
      <div className="h-1 w-full bg-slate-700">
         <div 
           className="h-full transition-all duration-500" 
           style={{ 
               width: `${progressPercent}%`,
               backgroundColor: isPlanned ? (timeRemaining ? '#fbbf24' : '#94a3b8') : (progressPercent === 100 ? '#4ade80' : dynamicColor) 
            }}
         />
      </div>
      
      <div className="p-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
              <div className="flex items-center gap-1 font-medium text-[11px] md:text-xs">
                  {renderSeasonText()}
              </div>
              <div className="font-medium text-[11px] md:text-xs">
                  {isPlanned ? (
                      timeRemaining ? <span className="text-yellow-500">Próximo</span> : <span className="text-slate-500">Wishlist</span>
                  ) : (
                      renderProgressText()
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};
