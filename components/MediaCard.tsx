

import React, { useEffect, useState, useRef } from 'react';
import { MediaItem, UserTrackingData, EMOTIONAL_TAGS_OPTIONS, RATING_OPTIONS } from '../types';
import { BookOpen, Tv, Clapperboard, CheckCircle2, AlertCircle, Link as LinkIcon, ExternalLink, ImagePlus, ChevronRight, Book, FileText, Crown, Trophy, Star, ThumbsUp, Smile, Meh, Frown, Trash2, X, AlertTriangle, Users, Share2, Globe, Plus, Calendar, Bell } from 'lucide-react';

interface MediaCardProps {
  item: MediaItem;
  onUpdate: (updatedItem: MediaItem) => void;
  isNew?: boolean;
  onDelete?: () => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, onUpdate, isNew = false, onDelete }) => {
  const [tracking, setTracking] = useState<UserTrackingData>(item.trackingData);
  const [progressPercent, setProgressPercent] = useState(0);
  const [characterInput, setCharacterInput] = useState('');
  const [customLinkUrl, setCustomLinkUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imgHasError, setImgHasError] = useState(false);

  // Use the AI provided color or fall back to a default Indigo-ish color if missing
  const dynamicColor = item.aiData.primaryColor || '#6366f1';

  const getPlaceholder = () => 
    `https://placehold.co/400x600/1e293b/94a3b8?text=${encodeURIComponent(item.aiData.title || 'Sin Imagen')}&font=roboto`;

  // Helper to check if string is a valid image source (URL or Data URI)
  const isValidSource = (src?: string) => 
    src && (src.startsWith('http') || src.startsWith('data:'));

  const initialImage = isValidSource(item.aiData.coverImage)
    ? item.aiData.coverImage!
    : getPlaceholder();

  const [imgSrc, setImgSrc] = useState(initialImage);

  const isMovie = item.aiData.mediaType === 'Pelicula';
  const isBook = item.aiData.mediaType === 'Libro';
  const isReadingContent = ['Manhwa', 'Manga', 'Comic', 'Libro'].includes(item.aiData.mediaType);
  const isSeriesContent = ['Anime', 'Serie'].includes(item.aiData.mediaType);

  // Sync state if item changes
  useEffect(() => {
    setTracking(item.trackingData);
    if (isValidSource(item.aiData.coverImage)) {
        setImgSrc(item.aiData.coverImage!);
        setImgHasError(false);
    } else {
        setImgSrc(getPlaceholder());
    }
  }, [item.id, item.aiData.coverImage]);

  useEffect(() => {
    const { watchedEpisodes, totalEpisodesInSeason } = tracking;
    if (isMovie) {
        setProgressPercent(tracking.status === 'Completado' ? 100 : 0);
    } else {
        if (totalEpisodesInSeason > 0) {
            const percent = Math.min(100, Math.max(0, (watchedEpisodes / totalEpisodesInSeason) * 100));
            setProgressPercent(percent);
        } else {
            setProgressPercent(0);
        }
    }
  }, [tracking.watchedEpisodes, tracking.totalEpisodesInSeason, tracking.status, isMovie]);

  const handleInputChange = (field: keyof UserTrackingData, value: any) => {
    const updated = { ...tracking, [field]: value };
    setTracking(updated);
    onUpdate({ ...item, trackingData: updated });
  };

  const handleCompleteSeason = () => {
    const nextSeason = tracking.currentSeason + 1;
    const isBookSaga = isBook && tracking.isSaga;
    
    // Logic for ending content
    let isFinished = false;
    if (isSeriesContent || isBookSaga) {
        if (tracking.totalSeasons > 0 && tracking.currentSeason >= tracking.totalSeasons) {
            isFinished = true;
        }
    } else {
        // Single volume or unknown or reading content without seasons
        isFinished = true;
    }

    if (isFinished) {
       handleInputChange('status', 'Completado');
       return;
    }

    const updated = {
      ...tracking,
      currentSeason: nextSeason,
      watchedEpisodes: 0,
      status: 'Viendo/Leyendo' as const
    };
    setTracking(updated);
    onUpdate({ ...item, trackingData: updated });
  };

  const handleMovieToggle = () => {
      const isCompleted = tracking.status === 'Completado';
      const updated = {
          ...tracking,
          status: isCompleted ? 'Viendo/Leyendo' : 'Completado' as const,
          watchedEpisodes: isCompleted ? 0 : 1,
          totalEpisodesInSeason: 1
      };
      // If completing, set date to today if empty
      if (!isCompleted && !tracking.finishedAt) {
          updated.finishedAt = new Date().toISOString().split('T')[0];
      }
      setTracking(updated);
      onUpdate({ ...item, trackingData: updated });
  };

  const toggleTag = (tag: string) => {
    const currentTags = tracking.emotionalTags;
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    handleInputChange('emotionalTags', newTags);
  };

  // Character Tag Logic
  const getSafeCharacters = (chars: any): string[] => {
    if (Array.isArray(chars)) return chars;
    if (typeof chars === 'string') return chars.split(',').filter(c => c.trim() !== '');
    return [];
  };

  const handleCharacterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const val = characterInput.trim();
        if (val) {
            const current = getSafeCharacters(tracking.favoriteCharacters);
            if (!current.includes(val)) {
                const newChars = [...current, val];
                handleInputChange('favoriteCharacters', newChars);
            }
            setCharacterInput('');
        }
    }
  };

  const removeCharacter = (charToRemove: string) => {
    const current = getSafeCharacters(tracking.favoriteCharacters);
    handleInputChange('favoriteCharacters', current.filter(c => c !== charToRemove));
  };

  // Custom Links Logic
  const handleAddCustomLink = (e: React.FormEvent) => {
      e.preventDefault();
      if (!customLinkUrl.trim()) return;
      
      let finalUrl = customLinkUrl.trim();
      if (!finalUrl.startsWith('http')) finalUrl = 'https://' + finalUrl;

      const newLink = {
          id: Date.now().toString(),
          url: finalUrl,
          title: new URL(finalUrl).hostname
      };

      const updatedLinks = [...(tracking.customLinks || []), newLink];
      handleInputChange('customLinks', updatedLinks);
      setCustomLinkUrl('');
  };

  const removeCustomLink = (id: string) => {
      const updatedLinks = (tracking.customLinks || []).filter(l => l.id !== id);
      handleInputChange('customLinks', updatedLinks);
  };

  const handleImageError = () => {
    if (imgSrc === item.aiData.coverImage && isValidSource(item.aiData.coverImage)) {
      setImgSrc(getPlaceholder());
    } else {
      setImgHasError(true);
    }
  };

  const extractDominantColor = (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSrc;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(dynamicColor); return; }

            canvas.width = 50;
            canvas.height = 50;
            ctx.drawImage(img, 0, 0, 50, 50);

            const imageData = ctx.getImageData(0, 0, 50, 50).data;
            let r = 0, g = 0, b = 0, count = 0;

            for (let i = 0; i < imageData.length; i += 4) {
                const currentR = imageData[i];
                const currentG = imageData[i + 1];
                const currentB = imageData[i + 2];
                
                const brightness = (currentR + currentG + currentB) / 3;
                const saturation = Math.max(currentR, currentG, currentB) - Math.min(currentR, currentG, currentB);

                if (brightness > 20 && brightness < 235 && saturation > 20) {
                    r += currentR;
                    g += currentG;
                    b += currentB;
                    count++;
                }
            }

            if (count > 0) {
                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);
                const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                resolve(hex);
            } else {
                resolve(dynamicColor);
            }
        };
        img.onerror = () => resolve(dynamicColor);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset to allow selecting same file
    if (e.target) e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("Por favor selecciona un archivo de imagen válido.");
      return;
    }

    // Just read the file and update the cover image
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      if (result) {
        setImgSrc(result);
        setImgHasError(false);
        
        try {
            // Extract color from the new image
            const newColor = await extractDominantColor(result);
            
            onUpdate({ 
                ...item, 
                aiData: { 
                    ...item.aiData, 
                    coverImage: result,
                    primaryColor: newColor || item.aiData.primaryColor 
                } 
            });

        } catch (error) {
            console.error("Error processing image color", error);
            onUpdate({ 
                ...item, 
                aiData: { 
                    ...item.aiData, 
                    coverImage: result
                } 
            });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleShare = () => {
    const { title } = item.aiData;
    const { rating, emotionalTags, comment } = tracking;
    const shareText = `📺 *${title}*\n⭐ Calificación: ${rating || 'Sin calificar'}\n🎭 Mood: ${emotionalTags.join(', ') || 'N/A'}\n📝 "${comment || 'Sin comentarios'}"\n\nTracked with MediaTracker AI`;
    
    navigator.clipboard.writeText(shareText);
    alert("¡Recomendación copiada al portapapeles! Lista para compartir.");
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const TypeIcon = ({ className = "w-5 h-5" }: { className?: string }) => {
    switch (item.aiData.mediaType) {
      case 'Anime': return <Tv className={className} />;
      case 'Manhwa': 
      case 'Manga': return <BookOpen className={className} />;
      case 'Comic': return <FileText className={className} />;
      case 'Libro': return <Book className={className} />;
      default: return <Clapperboard className={className} />;
    }
  };

  const RATING_CONFIG: Record<string, { icon: React.ElementType, label: string, shortLabel: string }> = {
    "God Tier (Épico memorable)": { icon: Crown, label: "God Tier", shortLabel: "God Tier" },
    "Obra Maestra": { icon: Trophy, label: "Obra Maestra", shortLabel: "Masterpiece" },
    "Excelente": { icon: Star, label: "Excelente", shortLabel: "Excelente" },
    "Muy Bueno": { icon: ThumbsUp, label: "Muy Bueno", shortLabel: "Muy Bueno" },
    "Bueno": { icon: Smile, label: "Bueno", shortLabel: "Bueno" },
    "Regular": { icon: Meh, label: "Regular", shortLabel: "Regular" },
    "Malo": { icon: Frown, label: "Malo", shortLabel: "Malo" },
    "Pérdida de tiempo": { icon: Trash2, label: "Pérdida de tiempo", shortLabel: "Basura" },
  };

  return (
    <div 
      className="bg-surface rounded-2xl shadow-xl overflow-hidden border w-full max-w-5xl mx-auto transition-all duration-500"
      style={{
        boxShadow: `0 0 40px -10px ${dynamicColor}40`,
        borderColor: `${dynamicColor}40`
      }}
    >
      
      <div className="md:flex">
        <div 
          className="md:w-1/3 p-6 flex flex-col relative overflow-hidden bg-slate-900"
        >
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${dynamicColor}20 0%, transparent 100%)`
            }}
          />

          <div 
            className={`aspect-[2/3] w-full rounded-lg overflow-hidden bg-slate-800 shadow-2xl mb-4 relative group cursor-pointer transition-all z-10 ${isDragging ? 'scale-105' : ''}`}
            style={{ 
               boxShadow: isDragging ? `0 0 0 4px ${dynamicColor}` : `0 20px 25px -5px rgba(0, 0, 0, 0.5)`,
               border: `2px solid ${dynamicColor}`
            }}
            onClick={triggerFileInput}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
             {!imgHasError ? (
                 <img 
                   src={imgSrc}
                   alt={item.aiData.title}
                   onError={handleImageError}
                   className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                 />
             ) : (
                 <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900 p-4 text-center">
                    <div className="p-4 rounded-full bg-slate-800 mb-2">
                       <TypeIcon className="w-10 h-10" />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider">{item.aiData.title}</span>
                 </div>
             )}

             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-sm">
                <ImagePlus className="w-10 h-10 mb-2" style={{ color: dynamicColor }} />
                <span className="font-semibold text-sm">Cambiar Imagen</span>
             </div>
             <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-4 pointer-events-none">
                <span 
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-white text-xs font-bold uppercase tracking-wider shadow-lg backdrop-blur-sm"
                  style={{ backgroundColor: dynamicColor }}
                >
                  <TypeIcon />
                  {item.aiData.mediaType}
                </span>
             </div>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect}/>
          </div>

          <div className="flex items-start justify-between gap-2 z-10 mb-1">
            <h2 
                className="text-2xl font-bold leading-tight" 
                style={{ color: dynamicColor, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
            >
                {item.aiData.title}
            </h2>
            {onDelete && (
                <button 
                  onClick={onDelete} 
                  className="text-slate-500 hover:text-red-500 transition-colors p-1"
                  title="Eliminar de biblioteca"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            )}
          </div>

          {item.aiData.originalTitle && (
            <p className="text-slate-400 text-sm mb-4 italic z-10">{item.aiData.originalTitle}</p>
          )}
          
          <div className="space-y-3 text-sm text-slate-300 z-10">
             <div>
                <span className="text-slate-500 font-semibold block text-xs uppercase">Estado Publicación</span>
                <span className="flex items-center gap-1">
                   {item.aiData.status}
                </span>
             </div>
             {/* Dates Section */}
             {(item.aiData.releaseDate || item.aiData.endDate) && (
                <div className="grid grid-cols-2 gap-2">
                    {item.aiData.releaseDate && (
                         <div>
                            <span className="text-slate-500 font-semibold block text-xs uppercase">Estreno</span>
                            {item.aiData.releaseDate}
                         </div>
                    )}
                    {item.aiData.endDate && (
                         <div>
                            <span className="text-slate-500 font-semibold block text-xs uppercase">Finalización</span>
                            {item.aiData.endDate}
                         </div>
                    )}
                </div>
             )}

             <div>
                <span className="text-slate-500 font-semibold block text-xs uppercase">Contenido Total</span>
                {item.aiData.totalContent}
             </div>
             <div>
                <span className="text-slate-500 font-semibold block text-xs uppercase">Géneros</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.aiData.genres.map(g => (
                    <span key={g} className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-300 border border-slate-700">{g}</span>
                  ))}
                </div>
             </div>
             
             {/* Sources & Links Section */}
             <div className="pt-4 border-t border-slate-700/50 space-y-4">
               {/* Official Sources */}
               {item.aiData.sourceUrls && item.aiData.sourceUrls.length > 0 && (
                  <div>
                    <span className="text-slate-500 font-semibold block text-xs uppercase mb-1 flex items-center gap-1">
                        <LinkIcon className="w-3 h-3"/> Fuentes Info
                    </span>
                    <ul className="space-y-1">
                        {item.aiData.sourceUrls.slice(0, 2).map((source, idx) => (
                        <li key={idx}>
                            <a 
                            href={source.uri} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-xs hover:underline truncate block flex items-center gap-1 opacity-70 hover:opacity-100"
                            style={{ color: dynamicColor }}
                            >
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{source.title}</span>
                            </a>
                        </li>
                        ))}
                    </ul>
                  </div>
               )}

               {/* Custom Links Section */}
               <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                   <span className="text-slate-400 font-bold block text-xs uppercase mb-2 flex items-center gap-1">
                       <Globe className="w-3 h-3"/> Mis Enlaces
                   </span>
                   
                   <ul className="space-y-2 mb-2">
                       {tracking.customLinks?.map((link) => (
                           <li key={link.id} className="flex items-center justify-between group/link">
                               <a 
                                 href={link.url} 
                                 target="_blank" 
                                 rel="noreferrer"
                                 className="text-xs text-slate-300 hover:text-white truncate flex items-center gap-1 flex-1"
                               >
                                   <ExternalLink className="w-3 h-3 flex-shrink-0 text-slate-500" />
                                   <span className="truncate" title={link.url}>{link.title || 'Enlace'}</span>
                               </a>
                               <button 
                                 onClick={() => removeCustomLink(link.id)}
                                 className="opacity-0 group-hover/link:opacity-100 text-slate-500 hover:text-red-400 transition-all p-1"
                               >
                                   <X className="w-3 h-3" />
                               </button>
                           </li>
                       ))}
                   </ul>

                   <form onSubmit={handleAddCustomLink} className="flex gap-1 relative">
                        <input 
                            type="text" 
                            placeholder="Añadir URL..." 
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                            value={customLinkUrl}
                            onChange={(e) => setCustomLinkUrl(e.target.value)}
                        />
                        <button 
                            type="submit"
                            disabled={!customLinkUrl.trim()}
                            className="bg-slate-700 hover:bg-slate-600 text-white rounded px-2 flex items-center justify-center disabled:opacity-50"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                   </form>
               </div>
             </div>
          </div>
        </div>

        <div className="md:w-2/3 p-6 md:p-8 flex flex-col gap-6 bg-gradient-to-br from-surface to-slate-800">
          
          <div className="prose prose-invert max-w-none">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <BookOpen className="w-5 h-5" style={{ color: dynamicColor }} />
              Sinopsis
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed bg-slate-900/30 p-4 rounded-lg border border-slate-700/50">
              {item.aiData.synopsis}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div 
              className="bg-slate-900/50 p-5 rounded-xl border relative overflow-hidden transition-colors duration-500"
              style={{ borderColor: `${dynamicColor}40` }}
            >
              <div 
                className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-16 translate-x-16 pointer-events-none opacity-20"
                style={{ backgroundColor: dynamicColor }}
              ></div>
              
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" style={{ color: dynamicColor }} />
                Mi Progreso
              </h3>
              
              <div className="space-y-4 relative z-10">
                {/* Book Saga Toggle */}
                {isBook && (
                    <div className="flex items-center gap-2 mb-2">
                        <button 
                            onClick={() => handleInputChange('isSaga', !tracking.isSaga)}
                            className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${tracking.isSaga ? 'bg-primary' : 'bg-slate-700'}`}
                        >
                            <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all duration-300 ${tracking.isSaga ? 'left-6' : 'left-1'}`}></div>
                        </button>
                        <span className="text-xs text-slate-300">Es una Saga/Serie de Libros</span>
                    </div>
                )}

                {/* Status Dropdown */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Estado</label>
                  <select 
                    value={tracking.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                    style={{ borderColor: `${dynamicColor}50` }}
                  >
                    <option value="Viendo/Leyendo">
                        {isReadingContent ? 'Leyendo' : 'Viendo'}
                    </option>
                    <option value="Completado">Completado</option>
                    <option value="En Pausa">En Pausa</option>
                    <option value="Descartado">Descartado</option>
                  </select>
                </div>

                {/* Scheduled Return Date (Only when Paused) */}
                {tracking.status === 'En Pausa' && (
                    <div className="animate-fade-in-up mt-2 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                        <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                            <Bell className="w-3 h-3 text-yellow-500" /> Fecha de Retorno Programada
                        </label>
                        <input 
                            type="date"
                            value={tracking.scheduledReturnDate || ''}
                            onChange={(e) => handleInputChange('scheduledReturnDate', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:border-primary transition-colors"
                        />
                    </div>
                )}

                {/* MOVIE LOGIC */}
                {isMovie && (
                    <div className="flex flex-col gap-4 mt-2">
                        <button 
                            onClick={handleMovieToggle}
                            className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all border ${
                                tracking.status === 'Completado' 
                                ? 'bg-green-600/20 border-green-500 text-green-400' 
                                : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                            }`}
                        >
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${tracking.status === 'Completado' ? 'border-green-500 bg-green-500' : 'border-slate-500'}`}>
                                {tracking.status === 'Completado' && <CheckCircle2 className="w-4 h-4 text-white" />}
                            </div>
                            <span className="font-bold">
                                {tracking.status === 'Completado' ? 'Vista / Completada' : 'Marcar como Vista'}
                            </span>
                        </button>

                        {tracking.status === 'Completado' && (
                            <div className="animate-fade-in-up">
                                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Fecha de Visualización
                                </label>
                                <input 
                                    type="date"
                                    value={tracking.finishedAt || ''}
                                    onChange={(e) => handleInputChange('finishedAt', e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:border-primary"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* STANDARD & BOOK LOGIC */}
                {!isMovie && (
                  <>
                     {/* Season / Book Number (Only for Series or Sagas) */}
                    { (isSeriesContent || (isBook && tracking.isSaga)) && (
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    {isBook ? 'Libro Actual' : 'Temp. Actual'}
                                </label>
                                <input 
                                type="number" min="1"
                                value={tracking.currentSeason}
                                onChange={(e) => handleInputChange('currentSeason', parseInt(e.target.value) || 1)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-sm text-center focus:border-opacity-100 outline-none focus:ring-1"
                                style={{ focusRing: dynamicColor, borderColor: `${dynamicColor}30` }}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    {isBook ? 'Total Libros' : 'Total Temps.'}
                                </label>
                                <input 
                                type="number" min="1"
                                value={tracking.totalSeasons || 1}
                                onChange={(e) => handleInputChange('totalSeasons', parseInt(e.target.value) || 1)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-sm text-center outline-none focus:ring-1"
                                style={{ borderColor: `${dynamicColor}30` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Episodes / Pages */}
                    <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                            {isBook ? 'Páginas Leídas' : (isReadingContent ? 'Caps. Leídos' : 'Caps. Vistos')}
                        </label>
                        <input 
                        type="number" min="0"
                        value={tracking.watchedEpisodes}
                        onChange={(e) => handleInputChange('watchedEpisodes', parseInt(e.target.value) || 0)}
                        className="w-full border border-slate-600 rounded-lg px-2 py-2 text-sm text-center font-bold text-white bg-slate-700/50 outline-none focus:ring-1"
                        style={{ borderColor: `${dynamicColor}50` }}
                        />
                    </div>
                    <div className="flex-1 relative">
                        <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
                            <span>Total {isBook ? 'Páginas' : (isReadingContent ? 'Existentes' : 'Temp')}</span>
                            {!tracking.totalEpisodesInSeason && (
                                <span className="text-amber-500" title="Dato faltante"><AlertTriangle className="w-3 h-3 inline"/></span>
                            )}
                        </label>
                        <div className="relative">
                            <input 
                            type="number" min="1"
                            value={tracking.totalEpisodesInSeason}
                            onChange={(e) => handleInputChange('totalEpisodesInSeason', parseInt(e.target.value) || 0)}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-sm text-center outline-none focus:ring-1"
                            style={{ borderColor: !tracking.totalEpisodesInSeason ? '#f59e0b' : `${dynamicColor}30` }}
                            />
                            {!tracking.totalEpisodesInSeason && (
                                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                                </div>
                            )}
                        </div>
                    </div>
                    </div>

                    <div className="mt-2">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>
                            {isBook 
                                ? (tracking.isSaga ? `Progreso Libro ${tracking.currentSeason}` : 'Progreso Lectura') 
                                : (isReadingContent ? 'Progreso Lectura' : `Progreso Temporada ${tracking.currentSeason}`)
                            }
                        </span>
                        <span style={{ color: progressPercent === 100 ? '#4ade80' : dynamicColor, fontWeight: 'bold' }}>
                            {Math.round(progressPercent)}%
                        </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                        <div 
                        className="h-2.5 rounded-full transition-all duration-500 ease-out"
                        style={{ 
                            width: `${progressPercent}%`,
                            backgroundColor: progressPercent === 100 ? '#4ade80' : dynamicColor,
                            boxShadow: `0 0 10px ${dynamicColor}80`
                        }} 
                        />
                    </div>
                    
                    {progressPercent === 100 && (
                        <button 
                        onClick={handleCompleteSeason}
                        className="mt-3 w-full flex items-center justify-center gap-1 text-xs font-medium text-white py-2 rounded-lg transition-colors shadow-lg"
                        style={{ backgroundColor: '#16a34a' }}
                        >
                        <CheckCircle2 className="w-3 h-3" />
                        { (isSeriesContent || (isBook && tracking.isSaga)) 
                             ? (isBook ? `Terminar Libro ${tracking.currentSeason}` : `Completar Temporada ${tracking.currentSeason}`)
                             : "Marcar como Completado"
                        }
                        <ChevronRight className="w-3 h-3 opacity-70" />
                        </button>
                    )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div 
                className="bg-slate-900/50 p-5 rounded-xl border border-slate-700/50 flex flex-col h-full"
                style={{ borderColor: `${dynamicColor}40` }}
            >
               <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Reflexión
              </h3>
              
              <div className="space-y-4 flex-grow flex flex-col">
                
                {/* Recommended By Field */}
                <div>
                   <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Recomendado por
                   </label>
                   <input 
                     type="text"
                     value={tracking.recommendedBy || ''}
                     onChange={(e) => handleInputChange('recommendedBy', e.target.value)}
                     className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1"
                     placeholder="Ej: Laura, r/anime..."
                     style={{ borderColor: `${dynamicColor}30`, focusRing: dynamicColor }}
                   />
                </div>

                <div>
                   <label className="block text-xs font-medium text-slate-400 mb-2">Resumen Emocional</label>
                   <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {EMOTIONAL_TAGS_OPTIONS.map(opt => {
                        const isActive = tracking.emotionalTags.includes(opt.label);
                        return (
                          <button
                            key={opt.label}
                            onClick={() => toggleTag(opt.label)}
                            className={`text-[10px] px-2 py-2 rounded-md text-left transition-all border flex items-center gap-2 h-auto min-h-[36px] ${
                              isActive 
                              ? 'text-white shadow-[0_0_10px_rgba(0,0,0,0.3)]' 
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                            }`}
                            style={isActive ? {
                                backgroundColor: `${dynamicColor}20`,
                                borderColor: dynamicColor,
                                color: 'white',
                                boxShadow: `0 0 8px ${dynamicColor}40`
                            } : {}}
                          >
                            <span className={`text-sm ${isActive ? 'opacity-100 scale-110' : 'opacity-50 grayscale'} transition-all flex-shrink-0`}>
                                {opt.emoji}
                            </span>
                            <span className="whitespace-normal leading-tight break-words">{opt.label}</span>
                          </button>
                        );
                      })}
                   </div>
                </div>

                <div className="flex-grow flex flex-col justify-end mt-2">
                  <label className="block text-xs font-medium text-slate-400 mb-2">Calificación</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {RATING_OPTIONS.map(option => {
                        const config = RATING_CONFIG[option] || { icon: Star, label: option, shortLabel: option };
                        const Icon = config.icon;
                        const isSelected = tracking.rating === option;
                        
                        return (
                          <button
                            key={option}
                            onClick={() => handleInputChange('rating', option)}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all duration-200 ${
                                isSelected 
                                ? 'bg-opacity-20 border-opacity-100 shadow-lg scale-105' 
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-500'
                            }`}
                            style={isSelected ? {
                                backgroundColor: `${dynamicColor}`, 
                                borderColor: dynamicColor,
                                color: 'white'
                            } : {}}
                            title={config.label}
                          >
                            <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-white' : ''}`} style={!isSelected ? { color: dynamicColor } : {}} />
                            <span className="text-[10px] font-medium leading-none text-center">{config.shortLabel}</span>
                          </button>
                        );
                    })}
                  </div>
                </div>
                
                {/* Share Button */}
                <button 
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 py-2 mt-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 transition-colors"
                >
                  <Share2 className="w-3 h-3" />
                  Copiar Mi Recomendación
                </button>

              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-700/50">
             <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Personajes memorables</label>
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
                        {getSafeCharacters(tracking.favoriteCharacters).map((char, idx) => {
                            // Top 5 Visual Hierarchy
                            const isTop5 = idx < 5;
                            return (
                                <span 
                                  key={idx} 
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs text-white animate-fade-in shadow-sm transition-all ${
                                      isTop5 ? 'font-bold pl-1.5 pr-2' : 'bg-slate-800 border-slate-700'
                                  }`}
                                  style={isTop5 ? { 
                                      backgroundColor: `${dynamicColor}20`, 
                                      borderColor: dynamicColor,
                                      boxShadow: `0 0 5px ${dynamicColor}20` 
                                  } : { borderColor: `${dynamicColor}40` }}
                                >
                                    {isTop5 && <span className="text-[10px] mr-1 opacity-70">#{idx+1}</span>}
                                    {char}
                                    <button onClick={() => removeCharacter(char)} className="hover:text-red-400 text-slate-400 transition-colors ml-1"><X className="w-3 h-3" /></button>
                                </span>
                            );
                        })}
                    </div>
                    <input 
                        type="text"
                        value={characterInput}
                        onChange={(e) => setCharacterInput(e.target.value)}
                        onKeyDown={handleCharacterKeyDown}
                        placeholder="Escribe un nombre y presiona Enter..."
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 transition-all"
                        style={{ borderColor: `${dynamicColor}30`, focusRing: dynamicColor }}
                    />
                </div>
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Comentario Final / Deseos</label>
                <textarea 
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all resize-none h-24 focus:ring-1"
                  style={{ borderColor: `${dynamicColor}30`, focusRing: dynamicColor }}
                  placeholder="Pensamientos finales..."
                  value={tracking.comment}
                  onChange={(e) => handleInputChange('comment', e.target.value)}
                />
             </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};