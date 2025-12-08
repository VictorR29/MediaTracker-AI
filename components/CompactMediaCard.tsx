

import React, { useState, useEffect } from 'react';
import { MediaItem } from '../types';
import { Tv, BookOpen, Clapperboard, PlayCircle, Book, FileText, Plus, Check, Bell } from 'lucide-react';

interface CompactMediaCardProps {
  item: MediaItem;
  onClick: () => void;
  onIncrement: (item: MediaItem) => void;
}

export const CompactMediaCard: React.FC<CompactMediaCardProps> = ({ item, onClick, onIncrement }) => {
  const { aiData, trackingData } = item;

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

  // Determine initial image
  const initialImage = isValidSource(aiData.coverImage)
    ? aiData.coverImage!
    : getPlaceholder();

  const [imgSrc, setImgSrc] = useState(initialImage);

  // Sync image source if the item prop changes (e.g. user updated cover in Details view)
  useEffect(() => {
    if (isValidSource(aiData.coverImage)) {
      setImgSrc(aiData.coverImage!);
    } else {
      setImgSrc(getPlaceholder());
    }
  }, [aiData.coverImage, aiData.title]);

  const handleImageError = () => {
    // If current image fails, fallback to placeholder
    if (imgSrc !== getPlaceholder()) {
      setImgSrc(getPlaceholder());
    }
  };

  const handleQuickAction = (e: React.MouseEvent) => {
      e.stopPropagation();
      onIncrement(item);
  };

  const renderProgressText = () => {
      if (isMovie) {
          return trackingData.status === 'Completado' ? <span className="text-green-400 font-bold">Visto</span> : 'Pendiente';
      }
      
      const label = isBook ? 'Pág.' : 'Cap.';
      const progress = `${trackingData.watchedEpisodes}/${trackingData.totalEpisodesInSeason}`;
      return (
         <span className="flex items-center gap-1">
            {isReadingContent ? <BookOpen className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
            {progress}
         </span>
      );
  };

  const renderSeasonText = () => {
      if (isMovie) return null;
      if (isBook) {
          return trackingData.isSaga ? <span>Libro {trackingData.currentSeason}</span> : <span>Novela</span>;
      }
      return isReadingContent ? <span>Leído</span> : <span>Temp {trackingData.currentSeason}</span>;
  };

  return (
    <div 
      onClick={onClick}
      className={`group bg-surface rounded-xl overflow-hidden shadow-lg border border-slate-800 hover:border-opacity-50 cursor-pointer transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-2xl relative ${isReturnDue ? 'ring-2 ring-red-500 shadow-red-900/40' : ''}`}
    >
      {isReturnDue && (
          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 text-center z-30 flex items-center justify-center gap-1 shadow-md animate-pulse">
              <Bell className="w-3 h-3 fill-current" /> ¡Hora de Volver!
          </div>
      )}

      <div className="relative aspect-[2/3] overflow-hidden bg-slate-900">
        <img 
          src={imgSrc} 
          alt={aiData.title}
          onError={handleImageError}
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
        />
        <div className="absolute top-2 right-2">
            <span 
                className="flex items-center gap-1 px-2 py-1 rounded-md text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm"
                style={{ backgroundColor: dynamicColor }}
            >
                <TypeIcon />
                {aiData.mediaType}
            </span>
        </div>
        
        {/* Quick Action Button - Floating on Image - Not for Movies */}
        {!isMovie && trackingData.status === 'Viendo/Leyendo' && (
             <button
                onClick={handleQuickAction}
                className={`absolute bottom-14 right-2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all transform active:scale-90 z-20 md:opacity-0 md:group-hover:opacity-100 opacity-100 ${
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

        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 pt-12">
           <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">{aiData.title}</h3>
           <p className="text-slate-400 text-xs mt-1 truncate">{trackingData.status}</p>
        </div>
      </div>
      
      {/* Progress Bar Mini - Dynamic Color */}
      <div className="h-1 w-full bg-slate-700">
         <div 
           className="h-full transition-all duration-500" 
           style={{ 
               width: `${progressPercent}%`,
               backgroundColor: progressPercent === 100 ? '#4ade80' : dynamicColor 
            }}
         />
      </div>
      
      <div className="p-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
              {renderSeasonText()}
              {renderProgressText()}
          </div>
      </div>
    </div>
  );
};