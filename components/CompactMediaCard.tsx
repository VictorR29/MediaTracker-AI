
import React, { useState, useEffect, useRef } from 'react';
import { MediaItem, RATING_TO_SCORE } from '../types';
import { Tv, BookOpen, Clapperboard, PlayCircle, Book, FileText, Plus, Check, Trash2, Star, Heart } from 'lucide-react';

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

  // Rating Score
  const score = RATING_TO_SCORE[trackingData.rating] || 0;

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
  
  const getStatusStyles = () => {
      switch (trackingData.status) {
          case 'Viendo/Leyendo': return { bg: 'bg-indigo-600', text: 'text-white', label: isReadingContent ? 'LEYENDO' : 'VIENDO' };
          case 'Completado': return { bg: 'bg-emerald-500', text: 'text-white', label: 'COMPLETADO' };
          case 'Sin empezar': return { bg: 'bg-amber-500', text: 'text-black', label: 'SIN EMPEZAR' };
          case 'En Pausa': return { bg: 'bg-orange-500', text: 'text-white', label: 'EN PAUSA' };
          case 'Planeado / Pendiente': return { bg: 'bg-purple-500', text: 'text-white', label: 'PLANEADO' };
          case 'Descartado': return { bg: 'bg-red-600', text: 'text-white', label: 'DESCARTADO' };
          default: return { bg: 'bg-slate-700', text: 'text-slate-300', label: 'DESCONOCIDO' };
      }
  };

  const statusStyle = getStatusStyles();

  // Helper to render the stats (Season / Progress)
  const getSeasonLabel = () => {
      if (isMovie) return 'Pelicula';
      return isBook 
        ? (trackingData.isSaga ? `L.${trackingData.currentSeason}` : 'Novela') 
        : (isReadingContent ? `Vol. ${trackingData.currentSeason}` : `T.${trackingData.currentSeason}`);
  };

  const getProgressLabel = () => {
      if (isMovie) return trackingData.status === 'Completado' ? '1/1' : '0/1';
      return trackingData.totalEpisodesInSeason > 0
        ? `${trackingData.watchedEpisodes} / ${trackingData.totalEpisodesInSeason}`
        : `${trackingData.watchedEpisodes} / ?`;
  };

  return (
    <div 
      ref={cardRef}
      onClick={onClick}
      className={`group relative rounded-3xl overflow-hidden shadow-2xl cursor-pointer transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-primary/20 flex flex-col bg-[#1A1D26] ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{
        willChange: 'transform, opacity',
        contentVisibility: 'auto',
        aspectRatio: '2/3',
        containIntrinsicSize: '300px 450px'
      }}
    >
      {/* Return Due Banner */}
      {isReturnDue && (
          <div className="absolute top-0 left-0 right-0 bg-red-600/90 text-white text-[10px] font-bold px-2 py-1 text-center z-40 backdrop-blur-sm">
              ¡Hora de Volver!
          </div>
      )}

      {/* --- IMAGE BACKGROUND --- */}
      <div className="absolute inset-0 bg-slate-900">
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
        {/* Gradient Overlay: Darker at bottom for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/10" />
      </div>

      {/* --- TOP BADGES --- */}
      
      {/* Type Badge (Top Left) */}
      <div className="absolute top-4 left-4 z-30">
          <span className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider shadow-lg">
              {aiData.mediaType}
          </span>
      </div>

      {/* Rating Badge (Top Right) */}
      {score > 0 && (
          <div className="absolute top-4 right-4 z-30">
              <div 
                className="w-9 h-9 rounded-full flex items-center justify-center bg-[#2e1065]/80 backdrop-blur-md border border-purple-500/30 text-white text-xs font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)]"
              >
                  {score}
              </div>
          </div>
      )}

      {/* --- HOVER ACTIONS (Favorite / Delete / Quick Add) --- */}
      <div className="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-end p-4 pt-16 gap-2 bg-black/20">
           {onToggleFavorite && (
              <button
                  onClick={handleFavoriteClick}
                  className="p-2.5 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-white hover:text-yellow-500 transition-all border border-white/10 shadow-lg transform hover:scale-110"
                  title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
              >
                  <Star className={`w-5 h-5 ${isFavorite ? 'fill-current text-yellow-400' : ''}`} />
              </button>
           )}
           {onDelete && (
              <button
                  onClick={handleDeleteClick}
                  className="p-2.5 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-red-600 hover:text-white transition-all border border-white/10 shadow-lg transform hover:scale-110"
                  title="Eliminar"
              >
                  <Trash2 className="w-5 h-5" />
              </button>
           )}
           
           {/* Quick Action Button (Floating) */}
           {showQuickAction && (
                <button
                    onClick={handleQuickAction}
                    className={`mt-auto mb-32 p-3 rounded-full shadow-xl transition-all transform hover:scale-110 active:scale-95 border border-white/20 ${
                        isCompleteSeason ? 'bg-green-500 text-white' : 'bg-white text-slate-900'
                    }`}
                    title={isCompleteSeason ? "Completar" : "+1 Capítulo"}
                >
                    {isCompleteSeason ? <Check className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                </button>
           )}
      </div>

      {/* --- CONTENT OVERLAY (BOTTOM) --- */}
      <div className="absolute bottom-0 left-0 right-0 p-5 z-30 flex flex-col gap-3">
          
          {/* Title */}
          <h3 className="text-white font-black text-xl leading-tight line-clamp-2 drop-shadow-lg tracking-tight">
              {aiData.title}
          </h3>

          {/* Status & Progress Bar Row */}
          <div className="flex items-center gap-3 w-full">
              {/* Status Pill */}
              <div className={`flex-shrink-0 px-3 py-1 rounded-full ${statusStyle.bg} shadow-lg shadow-black/20`}>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${statusStyle.text}`}>
                      {statusStyle.label}
                  </span>
              </div>

              {/* Progress Bar Line */}
              <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden shadow-inner backdrop-blur-sm">
                  <div 
                      className={`h-full rounded-full transition-all duration-700 ease-out ${statusStyle.bg}`}
                      style={{ 
                          width: `${progressPercent}%`,
                          boxShadow: '0 0 10px rgba(255,255,255,0.3)'
                      }} 
                  />
              </div>
          </div>

          {/* Info Row (Season & Count) */}
          <div className="flex items-center justify-between mt-1 pl-1">
              <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dynamicColor, boxShadow: `0 0 8px ${dynamicColor}` }}></div>
                  <span className="text-xs font-bold text-slate-300 tracking-wide">
                      {getSeasonLabel()}
                  </span>
              </div>
              
              <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 backdrop-blur-sm">
                  <span className="text-xs font-mono font-medium text-slate-300">
                      {getProgressLabel()}
                  </span>
              </div>
          </div>
      </div>

    </div>
  );
});
