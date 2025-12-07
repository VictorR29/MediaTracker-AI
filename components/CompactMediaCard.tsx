import React, { useState, useEffect } from 'react';
import { MediaItem } from '../types';
import { Tv, BookOpen, Clapperboard, PlayCircle, Book, FileText, Plus, Check } from 'lucide-react';

interface CompactMediaCardProps {
  item: MediaItem;
  onClick: () => void;
  onIncrement: (item: MediaItem) => void;
}

export const CompactMediaCard: React.FC<CompactMediaCardProps> = ({ item, onClick, onIncrement }) => {
  const { aiData, trackingData } = item;

  // Use dynamic color if available, else fallback to primary variable (approx)
  const dynamicColor = aiData.primaryColor || '#6366f1';

  // Calculate progress
  const progressPercent = trackingData.totalEpisodesInSeason > 0
    ? Math.min(100, (trackingData.watchedEpisodes / trackingData.totalEpisodesInSeason) * 100)
    : 0;

  const isReadingContent = ['Manhwa', 'Manga', 'Comic', 'Libro'].includes(aiData.mediaType);
  const isCompleteSeason = trackingData.totalEpisodesInSeason > 0 && trackingData.watchedEpisodes >= trackingData.totalEpisodesInSeason;

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

  const getGenerativeFallback = () => 
    `https://image.pollinations.ai/prompt/official%20key%20visual%20poster%20for%20${encodeURIComponent(aiData.title)}%20${aiData.mediaType}%20anime%20series%20high%20quality?width=300&height=450&nologo=true&model=flux&seed=${item.createdAt}`;
  
  const getPlaceholder = () => 
    `https://placehold.co/300x450/1e293b/white?text=${encodeURIComponent(aiData.title)}`;

  // Helper to check if string is a valid image source (URL or Data URI)
  const isValidSource = (src?: string) => 
    src && (src.startsWith('http') || src.startsWith('data:'));

  // Determine initial image
  const initialImage = isValidSource(aiData.coverImage)
    ? aiData.coverImage!
    : getGenerativeFallback();

  const [imgSrc, setImgSrc] = useState(initialImage);

  // Sync image source if the item prop changes (e.g. user updated cover in Details view)
  useEffect(() => {
    if (isValidSource(aiData.coverImage)) {
      setImgSrc(aiData.coverImage!);
    } else {
      setImgSrc(getGenerativeFallback());
    }
  }, [aiData.coverImage, aiData.title]);

  const handleImageError = () => {
    // If the current failed image was the AI provided one (or user uploaded), try the generative one
    if (imgSrc === aiData.coverImage) {
      setImgSrc(getGenerativeFallback());
    } 
    // If the generative one failed, fallback to placeholder text
    else if (imgSrc !== getPlaceholder()) {
      setImgSrc(getPlaceholder());
    }
  };

  const handleQuickAction = (e: React.MouseEvent) => {
      e.stopPropagation();
      onIncrement(item);
  };

  return (
    <div 
      onClick={onClick}
      className="group bg-surface rounded-xl overflow-hidden shadow-lg border border-slate-800 hover:border-opacity-50 cursor-pointer transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-2xl relative"
    >
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
        
        {/* Quick Action Button - Floating on Image */}
        {trackingData.status === 'Viendo/Leyendo' && (
             <button
                onClick={handleQuickAction}
                className={`absolute bottom-14 right-2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all transform active:scale-90 z-20 md:opacity-0 md:group-hover:opacity-100 opacity-100 ${
                    isCompleteSeason ? 'bg-green-500 hover:bg-green-600' : 'bg-white/90 hover:bg-white text-slate-900'
                }`}
                title={isCompleteSeason ? "Completar Temporada" : "+1 Capítulo"}
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
              <span>
                  {isReadingContent ? 'Progreso' : `Temp ${trackingData.currentSeason}`}
              </span>
              <span className="flex items-center gap-1">
                 {isReadingContent ? <BookOpen className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
                 {trackingData.watchedEpisodes}/{trackingData.totalEpisodesInSeason}
              </span>
          </div>
      </div>
    </div>
  );
};