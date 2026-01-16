
import React, { useState, useEffect, useRef } from 'react';
import { MediaItem } from '../types';
import { Tv, BookOpen, Clapperboard, PlayCircle, Book, FileText, Plus, Check, Trash2, Star } from 'lucide-react';

interface CompactMediaCardProps {
  item: MediaItem;
  onClick: () => void;
  onIncrement: (item: MediaItem) => void;
  onToggleFavorite?: (item: MediaItem) => void;
  onDelete?: (item: MediaItem) => void;
}

export const CompactMediaCard: React.FC<CompactMediaCardProps> = React.memo(({ item, onClick, onIncrement, onToggleFavorite, onDelete }) => {
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
  
  // Logic for Quick Action Button visibility
  const showQuickAction = !isMovie && !isPlanned && trackingData.status === 'Viendo/Leyendo';
  
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

  const isValidSource = (src?: string) => 
    src && (src.startsWith('http') || src.startsWith('data:'));

  const actualImageSource = isValidSource(aiData.coverImage)
    ? aiData.coverImage!
    : getPlaceholder();

  const [imgSrc, setImgSrc] = useState<string | undefined>(undefined);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Optimized Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          setImgSrc(actualImageSource);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Reduced margin to trigger closer to viewport
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
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
      if (onToggleFavorite) onToggleFavorite(item);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDelete) onDelete(item);
  }

  // --- Formatting Helpers for New Layout ---
  
  const getStatusColorDot = () => {
      switch (trackingData.status) {
          case 'Viendo/Leyendo': return isReadingContent ? 'bg-blue-500' : 'bg-green-500';
          case 'Completado': return 'bg-slate-500';
          case 'Sin empezar': return 'bg-yellow-500';
          case 'En Pausa': return 'bg-orange-500';
          case 'Planeado / Pendiente': return 'bg-purple-500';
          case 'Descartado': return 'bg-red-500';
          default: return 'bg-slate-500';
      }
  };

  const getStatusText = () => {
      if (trackingData.status === 'Viendo/Leyendo') return isReadingContent ? 'Leyendo' : 'Viendo';
      return trackingData.status;
  };

  // Helper to render the stats (Season / Progress) inside the overlay
  const renderOverlayStats = () => {
      if (isMovie) return null;
      
      const seasonPrefix = isBook 
        ? (trackingData.isSaga ? `L.${trackingData.currentSeason}` : 'Novela') 
        : (isReadingContent ? 'Vol.' : `T.${trackingData.currentSeason}`);
      
      const progressText = trackingData.totalEpisodesInSeason > 0
        ? `${trackingData.watchedEpisodes}/${trackingData.totalEpisodesInSeason}`
        : `${trackingData.watchedEpisodes}`;

      return (
          <span className="text-[10px] font-bold text-slate-300 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/10">
              {seasonPrefix} <span className="text-slate-500 mx-0.5">|</span> {progressText}
          </span>
      );
  };

  return (
    <div 
      ref={cardRef}
      onClick={onClick}
      className={`group bg-[#1A1D26] rounded-2xl overflow-hidden shadow-lg border border-white/5 cursor-pointer transition-transform duration-300 ease-out hover:scale-[1.02] hover:shadow-2xl relative flex flex-col ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{
        willChange: 'transform, opacity',
        contentVisibility: 'auto',
        containIntrinsicSize: '300px 450px'
      }}
    >
      {/* Return Due Banner */}
      {isReturnDue && (
          <div className="absolute top-0 left-0 right-0 bg-red-600/90 text-white text-[10px] font-bold px-2 py-1 text-center z-40 backdrop-blur-sm">
              ¡Hora de Volver!
          </div>
      )}

      {/* --- IMAGE AREA --- */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
        
        {/* Image */}
        {imgSrc && (
            <img 
                src={imgSrc} 
                alt={aiData.title}
                onError={handleImageError}
                onLoad={() => setImageLoaded(true)}
                loading="lazy"
                className={`w-full h-full object-cover transition-opacity duration-500 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
            />
        )}
        
        {/* Gradient Overlay for Text Readability - Stronger at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

        {/* Top Left Badge (Type) */}
        <div className="absolute top-3 left-3 z-30">
            <span 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-white text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-sm bg-black/40 border border-white/10"
                style={{ borderLeftColor: dynamicColor, borderLeftWidth: '3px' }}
            >
                <TypeIcon />
                {aiData.mediaType.toUpperCase()}
            </span>
        </div>

        {/* Top Right Actions (Favorite/Delete) - Hidden by default, show on hover */}
        <div className="absolute top-3 right-3 z-30 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
             {onToggleFavorite && (
                <button
                    onClick={handleFavoriteClick}
                    className="p-2 rounded-full bg-black/50 backdrop-blur-md hover:bg-white text-white hover:text-yellow-500 transition-colors"
                >
                    <Star className={`w-4 h-4 ${isFavorite ? 'fill-current text-yellow-400' : ''}`} />
                </button>
             )}
             {onDelete && (
                <button
                    onClick={handleDeleteClick}
                    className="p-2 rounded-full bg-black/50 backdrop-blur-md hover:bg-red-600 text-white transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
             )}
        </div>
        
        {/* Always visible Favorite Indicator if active */}
        {isFavorite && (
            <div className="absolute top-3 right-3 z-20 group-hover:opacity-0 transition-opacity">
                <div className="p-1.5 bg-yellow-500/20 rounded-full border border-yellow-500/50 backdrop-blur-sm">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                </div>
            </div>
        )}

        {/* Quick Action Button (Floating on Image) */}
        {showQuickAction && (
             <button
                onClick={handleQuickAction}
                className={`absolute bottom-20 right-3 z-40 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 duration-300 ${
                    isCompleteSeason ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-900'
                }`}
                title={isCompleteSeason ? "Completar" : "+1 Capítulo"}
             >
                 {isCompleteSeason ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
             </button>
        )}

        {/* Content Info Overlay (Merged Footer into Image) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-30 pb-5">
            <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow-md mb-2">
                {aiData.title}
            </h3>
            
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${getStatusColorDot()} shadow-[0_0_8px_currentColor]`} />
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">
                        {isPlanned && timeRemaining ? timeRemaining : getStatusText()}
                    </span>
                </div>
                {renderOverlayStats()}
            </div>
        </div>
        
        {/* Progress Bar (Attached to bottom edge of image container) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-30">
            <div 
            className="h-full transition-all duration-700 ease-out" 
            style={{ 
                width: `${progressPercent}%`,
                backgroundColor: isPlanned ? '#fbbf24' : (progressPercent === 100 ? '#4ade80' : dynamicColor),
                boxShadow: `0 0 10px ${dynamicColor}40`
                }}
            />
        </div>
      </div>

    </div>
  );
});
