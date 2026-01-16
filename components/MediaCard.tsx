
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MediaItem, UserTrackingData, EMOTIONAL_TAGS_OPTIONS, RATING_OPTIONS } from '../types';
import { useToast } from '../context/ToastContext';
import { generateReviewSummary, updateMediaInfo } from '../services/geminiService';
import { BookOpen, Tv, Clapperboard, CheckCircle2, AlertCircle, Link as LinkIcon, ExternalLink, ImagePlus, ChevronRight, ChevronLeft, Book, FileText, Crown, Trophy, Star, ThumbsUp, Smile, Meh, Frown, Trash2, X, AlertTriangle, Users, Share2, Globe, Plus, Calendar, Bell, Medal, CalendarDays, GitMerge, Loader2, Sparkles, Copy, Pencil, Save, RefreshCw, Search, CalendarClock, Radio, PlayCircle } from 'lucide-react';

interface MediaCardProps {
  item: MediaItem;
  onUpdate: (updatedItem: MediaItem) => void;
  isNew?: boolean;
  onDelete?: () => void;
  username?: string;
  apiKey?: string;
  initialEditMode?: boolean;
  onSearch?: (query: string) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, onUpdate, isNew = false, onDelete, username, apiKey, initialEditMode = false, onSearch }) => {
  const { showToast } = useToast();
  const [tracking, setTracking] = useState<UserTrackingData>(item.trackingData);
  const [progressPercent, setProgressPercent] = useState(0);
  const [characterInput, setCharacterInput] = useState('');
  const [customLinkUrl, setCustomLinkUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imgHasError, setImgHasError] = useState(false);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [isRefreshingInfo, setIsRefreshingInfo] = useState(false);
  
  // Dynamic Color State (initialized from item, updated via extraction)
  const [dynamicColor, setDynamicColor] = useState(item.aiData.primaryColor || '#6366f1');

  // Metadata Edit State
  const [isEditingMetadata, setIsEditingMetadata] = useState(initialEditMode);
  const [editTitle, setEditTitle] = useState(item.aiData.title);
  const [editOriginalTitle, setEditOriginalTitle] = useState(item.aiData.originalTitle || '');
  const [editSynopsis, setEditSynopsis] = useState(item.aiData.synopsis);
  const [editGenres, setEditGenres] = useState(item.aiData.genres.join(', '));
  const [editTotalContent, setEditTotalContent] = useState(item.aiData.totalContent);
  const [editMediaType, setEditMediaType] = useState(item.aiData.mediaType);
  const [editStatus, setEditStatus] = useState(item.aiData.status);
  const [editReleaseDate, setEditReleaseDate] = useState(item.aiData.releaseDate || '');
  const [editEndDate, setEditEndDate] = useState(item.aiData.endDate || '');

  // Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTextContent, setShareTextContent] = useState('');

  const isFavorite = tracking.is_favorite || false;

  const getPlaceholder = () => 
    `https://placehold.co/400x600/1e293b/94a3b8?text=${encodeURIComponent(item.aiData.title || 'Sin Imagen')}&font=roboto`;

  const isValidSource = (src?: string) => 
    src && (src.startsWith('http') || src.startsWith('data:'));

  const actualImageSource = isValidSource(item.aiData.coverImage)
    ? item.aiData.coverImage!
    : getPlaceholder();

  const [imgSrc, setImgSrc] = useState(actualImageSource);

  const isMovie = item.aiData.mediaType === 'Pelicula';
  const isBook = item.aiData.mediaType === 'Libro';
  const isReadingContent = ['Manhwa', 'Manga', 'Comic', 'Libro'].includes(item.aiData.mediaType);
  
  // --- Dynamic Congratulatory Message Logic ---
  const completionMessage = useMemo(() => {
     if (tracking.status !== 'Completado') return null;
     
     const user = username || 'Viajero';
     const title = item.aiData.title;
     
     const chars = tracking.favoriteCharacters;
     const charList = Array.isArray(chars) ? chars : (typeof chars === 'string' ? (chars as string).split(',') : []);
     const character = charList.length > 0 ? charList[0].trim() : null;

     const templates = [
         { title: `¡Victoria, ${user}!`, body: `Has conquistado "${title}".` },
         { title: character ? `¡Felicidades!` : `¡Enhorabuena!`, body: character ? `Ha sido un largo viaje junto a ${character}.` : `Has llegado al final.` },
         { title: `¡Logro Desbloqueado!`, body: `Completaste "${title}".` }
     ];
     return templates[Math.floor(Math.random() * templates.length)];
  }, [tracking.status, username, item.aiData.title, tracking.favoriteCharacters]);

  // Sync state if item changes
  useEffect(() => {
    setTracking(item.trackingData);
    if (isValidSource(item.aiData.coverImage)) {
        setImgSrc(item.aiData.coverImage!);
        setImgHasError(false);
    } else {
        setImgSrc(getPlaceholder());
    }
    if (item.aiData.primaryColor) {
        setDynamicColor(item.aiData.primaryColor);
    }
  }, [item.id, item.aiData.coverImage, item.aiData.primaryColor]);

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
    
    let newTimestamp = item.lastInteraction;
    const isConsumption = 
        field === 'watchedEpisodes' || 
        field === 'currentSeason' || 
        (isMovie && field === 'status' && value === 'Completado');

    if (isConsumption) {
        newTimestamp = Date.now();
    }
    
    onUpdate({ ...item, trackingData: updated, lastInteraction: newTimestamp });
  };

  const handleSaveMetadata = () => {
    if (!editTitle.trim()) {
        showToast("El título es obligatorio", "error");
        return;
    }
    const updatedAI = {
        ...item.aiData,
        title: editTitle,
        originalTitle: editOriginalTitle,
        synopsis: editSynopsis,
        genres: editGenres.split(',').map(g => g.trim()).filter(Boolean),
        totalContent: editTotalContent,
        mediaType: editMediaType as any,
        status: editStatus,
        releaseDate: editReleaseDate,
        endDate: editEndDate
    };
    onUpdate({ ...item, aiData: updatedAI });
    setIsEditingMetadata(false);
    showToast("Información actualizada", "success");
  };

  const handleCancelMetadata = () => {
      setEditTitle(item.aiData.title);
      setEditOriginalTitle(item.aiData.originalTitle || '');
      setEditSynopsis(item.aiData.synopsis);
      setEditGenres(item.aiData.genres.join(', '));
      setEditTotalContent(item.aiData.totalContent);
      setEditMediaType(item.aiData.mediaType);
      setEditStatus(item.aiData.status);
      setEditReleaseDate(item.aiData.releaseDate || '');
      setEditEndDate(item.aiData.endDate || '');
      setIsEditingMetadata(false);
  };

  const handleRefreshInfo = async () => {
    if (!apiKey) return;
    setIsRefreshingInfo(true);
    try {
        const { updatedData, hasChanges } = await updateMediaInfo(item.aiData, apiKey);
        if (hasChanges) {
            const mergedAiData = {
                ...item.aiData,
                ...updatedData,
                synopsis: updatedData.synopsis || item.aiData.synopsis,
                coverImage: item.aiData.coverImage,
                primaryColor: item.aiData.primaryColor
            };
            onUpdate({ ...item, aiData: mergedAiData });
            showToast("Información actualizada con éxito", "success");
        } else {
            showToast("Ya posees la información más reciente", "info");
        }
    } catch (error) {
        showToast("Error al verificar actualizaciones", "error");
    } finally {
        setIsRefreshingInfo(false);
    }
  };

  const handleMovieToggle = () => {
      const isCompleted = tracking.status === 'Completado';
      const nextStatus: UserTrackingData['status'] = isCompleted ? 'Viendo/Leyendo' : 'Completado';
      const updated: UserTrackingData = {
          ...tracking,
          status: nextStatus,
          watchedEpisodes: isCompleted ? 0 : 1,
          totalEpisodesInSeason: 1,
          finishedAt: !isCompleted && !tracking.finishedAt ? new Date().toISOString().split('T')[0] : tracking.finishedAt
      };
      setTracking(updated);
      const newTimestamp = updated.status === 'Completado' ? Date.now() : item.lastInteraction;
      onUpdate({ ...item, trackingData: updated, lastInteraction: newTimestamp });
      if (!isCompleted) showToast("Película marcada como vista", "success");
  };

  const toggleTag = (tag: string) => {
    const currentTags = tracking.emotionalTags || [];
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

  const addCharacter = () => {
    const val = characterInput.trim();
    if (val) {
        const current = getSafeCharacters(tracking.favoriteCharacters);
        if (!current.includes(val)) {
            const newChars = [...current, val];
            handleInputChange('favoriteCharacters', newChars);
        }
        setCharacterInput('');
    }
  };

  const handleCharacterInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(',') || val.includes(';')) {
         const parts = val.split(/[,;]+/);
         const current = getSafeCharacters(tracking.favoriteCharacters);
         let newChars = [...current];
         parts.forEach(part => {
             const clean = part.trim();
             if (clean && !newChars.includes(clean)) newChars.push(clean);
         });
         if (newChars.length !== current.length) handleInputChange('favoriteCharacters', newChars);
         setCharacterInput('');
         return;
    }
    setCharacterInput(val);
  };

  const handleCharacterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addCharacter();
    }
  };

  const removeCharacter = (charToRemove: string) => {
    const current = getSafeCharacters(tracking.favoriteCharacters);
    handleInputChange('favoriteCharacters', current.filter(c => c !== charToRemove));
  };

  const handleAddCustomLink = (e: React.FormEvent) => {
      e.preventDefault();
      if (!customLinkUrl.trim()) return;
      let finalUrl = customLinkUrl.trim();
      if (!finalUrl.startsWith('http')) finalUrl = 'https://' + finalUrl;
      const newLink = { id: Date.now().toString(), url: finalUrl, title: new URL(finalUrl).hostname };
      const updatedLinks = [...(tracking.customLinks || []), newLink];
      handleInputChange('customLinks', updatedLinks);
      setCustomLinkUrl('');
      showToast("Enlace añadido", "success");
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

  const extractDominantColor = (imageSrc: string) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = 50; canvas.height = 50;
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
                r += currentR; g += currentG; b += currentB; count++;
            }
        }
        if (count > 0) {
            r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
            const newColor = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
            setDynamicColor(newColor);
            
            // Persist the color if changed
            if (newColor !== item.aiData.primaryColor) {
               onUpdate({
                   ...item,
                   aiData: { ...item.aiData, primaryColor: newColor }
               });
            }
        }
    };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (e.target) e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast("Por favor selecciona un archivo de imagen válido.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      if (result) {
        setImgSrc(result);
        setImgHasError(false);
        extractDominantColor(result); // Trigger color update
        
        onUpdate({ 
            ...item, 
            aiData: { ...item.aiData, coverImage: result }, 
            lastInteraction: item.lastInteraction 
        });
        showToast("Imagen actualizada con éxito", "success");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleShare = async () => {
    const { title } = item.aiData;
    const { rating, emotionalTags, comment, customLinks } = tracking;
    const formattedLinks = customLinks && customLinks.length > 0 ? '\n\n' + customLinks.map(l => `🔗 ${l.title || 'Ver en'}: ${l.url}`).join('\n') : '';
    const getSimpleText = () => `📺 *${title}*\n⭐ Calificación: ${rating || 'Sin calificar'}\n🎭 Mood: ${emotionalTags.join(', ') || 'N/A'}\n📝 "${comment || 'Sin comentarios'}"${formattedLinks}\n\nTracked with MediaTracker AI`;

    if (apiKey) {
        setIsGeneratingShare(true);
        let textToShare = "";
        try {
            const synthesizedReview = await generateReviewSummary(title, rating, emotionalTags, comment, apiKey);
            textToShare = `📺 ${title}\n⭐ ${rating || 'Sin calificar'}\n\n${synthesizedReview}${formattedLinks}\n\n#MediaTrackerAI #Recomendación`;
        } catch (error) {
            textToShare = getSimpleText();
        } finally {
            setIsGeneratingShare(false);
            setShareTextContent(textToShare);
            setShowShareModal(true);
        }
    } else {
        const shareText = getSimpleText();
        try {
            await navigator.clipboard.writeText(shareText);
            showToast("¡Recomendación copiada!", "success");
        } catch (e) {
            setShareTextContent(shareText);
            setShowShareModal(true);
        }
    }
  };

  const executeCopy = async () => {
      try {
          await navigator.clipboard.writeText(shareTextContent);
          showToast("¡Copiado!", "success");
          setShowShareModal(false);
      } catch (e) {
          showToast("Error al copiar.", "error");
      }
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const TypeIcon = ({ className = "w-5 h-5" }: { className?: string }) => {
    switch (item.aiData.mediaType) {
      case 'Anime': return <Tv className={className} />;
      case 'Manhwa': case 'Manga': return <BookOpen className={className} />;
      case 'Comic': return <FileText className={className} />;
      case 'Libro': return <Book className={className} />;
      default: return <Clapperboard className={className} />;
    }
  };

  const RATING_CONFIG: Record<string, { icon: React.ElementType, label: string, shortLabel: string }> = {
    "God Tier (Épico memorable)": { icon: Crown, label: "God Tier", shortLabel: "GOD TIER" },
    "Obra Maestra": { icon: Trophy, label: "Obra Maestra", shortLabel: "MASTER" },
    "Excelente": { icon: Star, label: "Excelente", shortLabel: "EXCELENTE" },
    "Muy Bueno": { icon: ThumbsUp, label: "Muy Bueno", shortLabel: "MUY BUENO" },
    "Bueno": { icon: Smile, label: "Bueno", shortLabel: "BUENO" },
    "Regular": { icon: Meh, label: "Regular", shortLabel: "REGULAR" },
    "Malo": { icon: Frown, label: "Malo", shortLabel: "MALO" },
    "Pérdida de tiempo": { icon: Trash2, label: "Pérdida de tiempo", shortLabel: "BASURA" },
  };

  const processContentString = (text: string) => {
      let processed = text.replace(/\), /g, ')\n');
      if (!text.includes('\n')) processed = processed.replace(/, (\d+ )/g, '\n$1');
      return processed.split('\n').filter(line => line.trim() !== '');
  };

  const renderContentLine = (line: string, index: number) => {
    const movieRegex = /(?:Film|Movie|Película|Special|Especial|OVA).*?['"“](.+?)['"”]/i;
    const match = line.match(movieRegex);
    const trimLine = line.trim();
    
    // Future/Announced Check
    const isFutureHeader = /(Anunciada|Confirmada|Coming Soon)/i.test(trimLine);
    const isFutureDetail = /(Estreno|Release|Lanzamiento):/i.test(trimLine);
    
    // Airing Check
    const isAiring = /(En emisión|On Air|Simulcast)/i.test(trimLine);

    const isSeasonHeader = /^\d+\s+(Temporadas|Seasons|Series)/i.test(trimLine) && !trimLine.startsWith('-');
    const isSeasonDetail = trimLine.startsWith('-') || /^(Season|Temporada)/i.test(trimLine);
    const isExtra = /OVA|Película|Movie|Film|Special|Especial/i.test(trimLine) && !isSeasonHeader;

    let displayLine = trimLine;
    if (displayLine.endsWith(')')) displayLine = displayLine.slice(0, -1); 
    if (displayLine.startsWith('-')) displayLine = displayLine.substring(1).trim(); 

    // Handle "En emisión" replacement visual
    if (isAiring) {
        displayLine = displayLine.replace(/\(En emisión\)/gi, '').trim();
    }

    let containerClass = "text-sm text-slate-300";
    let bullet: React.ReactNode = null;

    if (isFutureHeader) {
        containerClass = "font-bold text-amber-400 text-sm mt-3 mb-1 border-b border-amber-500/30 pb-1 flex items-center gap-2";
        bullet = <CalendarClock className="w-4 h-4 text-amber-500" />;
    } else if (isFutureDetail) {
         containerClass = "ml-4 text-xs text-amber-200/70 flex items-center gap-2 font-mono";
         bullet = "📅";
    } else if (isSeasonHeader) {
        containerClass = "font-bold text-white text-sm mb-1 mt-2 border-b border-white/10 pb-1";
    } else if (isSeasonDetail) { 
        containerClass = `ml-4 text-xs flex items-center gap-2 ${isAiring ? 'text-emerald-300 font-medium' : 'text-slate-400'}`; 
        bullet = "•"; 
    } else if (isExtra) {
        containerClass = "font-semibold text-indigo-200 mt-2 text-xs flex flex-wrap gap-1 items-center bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20 w-fit";
    }

    return (
        <div key={index} className={containerClass}>
            {bullet && <span className={isFutureHeader ? "text-amber-500" : isAiring ? "text-emerald-400" : "text-slate-600"}>{bullet}</span>}
            <span>{displayLine}</span>
            
            {/* Airing Badge */}
            {isAiring && (
                <span className="inline-flex items-center gap-1.5 ml-2 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    Live
                </span>
            )}

            {match && onSearch && (
                <button
                    onClick={() => onSearch(match[1])}
                    className="flex items-center gap-1 px-2 py-0.5 bg-primary/20 hover:bg-primary/40 text-primary text-[10px] rounded border border-primary/30 transition-colors ml-1 cursor-pointer"
                    title={`Buscar "${match[1]}" en la biblioteca`}
                >
                    <Search className="w-2.5 h-2.5" />
                    <span className="underline font-medium">{match[1]}</span>
                </button>
            )}
        </div>
    );
  };

  // --- STYLES: DARK CARD THEME ---
  const CARD_BG = "bg-[#151921]";
  const INPUT_BG = "bg-[#0B0E14]";
  const BORDER_COLOR = "border-white/5";
  const TEXT_MUTED = "text-slate-400";

  return (
    <div 
      className="bg-[#0B0E14] text-slate-200 rounded-3xl shadow-2xl overflow-hidden border border-slate-800 w-full max-w-[1600px] mx-auto transition-all duration-500"
      style={{
          boxShadow: `0 25px 50px -12px ${dynamicColor}20`, // Stronger shadow
          borderColor: `${dynamicColor}40` // Stronger border
      }}
    >
      
      {/* 
         LAYOUT GRID: 3 COLUMNS 
         Mobile: Stack
         Tablet (lg): 3 Columns (Tighter)
         Desktop (xl): 3 Columns (Comfortable)
      */}
      <div className="flex flex-col lg:grid lg:grid-cols-[260px_1fr_280px] xl:grid-cols-[340px_1fr_360px] gap-0">
        
        {/* COL 1: LEFT SIDEBAR (Info de la Obra) */}
        <div className="p-6 md:p-8 flex flex-col relative border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#0F1119]">
          
          {/* Poster */}
          <div 
            className={`aspect-[2/3] w-full rounded-2xl overflow-hidden shadow-2xl mb-6 relative group cursor-pointer transition-all z-10 ${isDragging ? 'ring-2 ring-primary' : ''}`}
            style={{ boxShadow: `0 15px 40px -10px ${dynamicColor}50` }} // Dynamic Glow
            onClick={triggerFileInput}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
             {!imgHasError ? (
                 <img src={imgSrc} alt={item.aiData.title} onError={handleImageError} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
             ) : (
                 <div className={`w-full h-full flex flex-col items-center justify-center text-slate-500 ${INPUT_BG} p-4 text-center border ${BORDER_COLOR}`}>
                    <div className="p-4 rounded-full bg-slate-800 mb-2"><TypeIcon className="w-10 h-10" /></div>
                    <span className="text-sm font-medium uppercase tracking-wider">{item.aiData.title}</span>
                 </div>
             )}
             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-sm">
                <ImagePlus className="w-10 h-10 mb-2 text-white/80" />
                <span className="font-semibold text-base">Cambiar Imagen</span>
             </div>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect}/>
          </div>

          {/* Core Info & Actions */}
          <div className="flex flex-col gap-3 z-10 mb-6">
            {isEditingMetadata ? (
                <div className="w-full space-y-3">
                    <input className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-xl p-4 text-xl font-bold text-white focus:border-[var(--theme-color)] outline-none`} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Título principal" style={{ '--theme-color': dynamicColor } as React.CSSProperties} />
                    <input className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-xl p-3 text-sm text-slate-300 focus:border-[var(--theme-color)] outline-none`} value={editOriginalTitle} onChange={(e) => setEditOriginalTitle(e.target.value)} placeholder="Título original" style={{ '--theme-color': dynamicColor } as React.CSSProperties} />
                    <div className="flex gap-2 mt-2">
                        <button onClick={handleSaveMetadata} className="flex-1 py-3 bg-green-600 rounded-xl hover:bg-green-700 transition-colors text-white font-bold text-sm" title="Guardar">GUARDAR</button>
                        <button onClick={handleCancelMetadata} className="flex-1 py-3 bg-slate-700 rounded-xl hover:bg-slate-600 transition-colors text-white text-sm" title="Cancelar">CANCELAR</button>
                    </div>
                </div>
            ) : (
                <>
                <h2 className="text-3xl font-black leading-tight text-white mb-1 break-words tracking-tight">{item.aiData.title}</h2>
                {item.aiData.originalTitle && <p className="text-slate-400 text-sm italic mb-4 break-words">{item.aiData.originalTitle}</p>}
                
                {/* Status Badges */}
                <div className="flex flex-wrap gap-2 mb-5">
                     <span className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold uppercase rounded-lg border border-slate-700 shadow-sm">{item.aiData.mediaType}</span>
                     <span className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold uppercase rounded-lg border border-slate-700 shadow-sm">{item.aiData.status}</span>
                     <button onClick={() => setIsEditingMetadata(true)} className="p-1.5 hover:text-white text-slate-500 transition-colors bg-slate-800/50 rounded-lg hover:bg-slate-700" title="Editar Metadata"><Pencil className="w-4 h-4" /></button>
                </div>

                {/* Primary Actions */}
                <div className="flex gap-3">
                    <button 
                        onClick={() => handleInputChange('is_favorite', !isFavorite)} 
                        className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg border ${
                            isFavorite 
                            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50' 
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                        <Star className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                        {isFavorite ? 'FAVORITO' : 'FAVORITO'}
                    </button>
                    {onDelete && (
                        <button onClick={onDelete} className="p-3 bg-red-900/20 text-red-400 rounded-xl border border-red-900/50 hover:bg-red-900/40 hover:text-red-300 transition-colors">
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                </div>
                </>
            )}
          </div>
          
          {/* Detailed Metadata List (Removed mt-auto to fix spacing) */}
          <div className="space-y-6 text-sm z-10 border-t border-slate-800 pt-6 mt-6">
             {/* Dates Section */}
             <div>
                <span className={`block text-xs font-bold ${TEXT_MUTED} uppercase mb-2 tracking-wider`}>Fechas</span>
                {isEditingMetadata ? (
                    <div className="space-y-2">
                        <input type="date" className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-lg p-3 text-sm text-white`} value={editReleaseDate} onChange={(e) => setEditReleaseDate(e.target.value)} />
                        <input type="date" className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-lg p-3 text-sm text-white`} value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
                    </div>
                ) : (
                    <div className="space-y-1.5 text-sm font-medium">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Estreno:</span>
                            <span className="text-slate-200 font-mono">{item.aiData.releaseDate || 'Desconocido'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Final:</span>
                            <span className="text-slate-200 font-mono">{item.aiData.endDate || (item.aiData.status === 'En emisión' ? 'En curso' : '-')}</span>
                        </div>
                    </div>
                )}
             </div>

             {/* Genres */}
             <div>
                <span className={`block text-xs font-bold ${TEXT_MUTED} uppercase mb-2 tracking-wider`}>Géneros</span>
                {isEditingMetadata ? (
                     <input className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-lg p-3 text-sm text-white focus:border-primary outline-none`} value={editGenres} onChange={(e) => setEditGenres(e.target.value)} />
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {item.aiData.genres.map(g => <span key={g} className="px-3 py-1.5 bg-slate-800/60 rounded-full text-xs font-medium text-slate-300 border border-slate-700/60">{g}</span>)}
                    </div>
                )}
             </div>

             {/* Content Structure */}
             <div>
                <span className={`block text-xs font-bold ${TEXT_MUTED} uppercase mb-2 flex items-center gap-1.5 tracking-wider`}>
                    <Tv className="w-3.5 h-3.5"/> Estructura
                </span>
                {isEditingMetadata ? (
                     <textarea className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-lg p-3 text-sm text-white focus:border-primary outline-none h-24 font-mono`} value={editTotalContent} onChange={(e) => setEditTotalContent(e.target.value)} />
                ) : (
                    <div className={`${INPUT_BG} p-4 rounded-xl border ${BORDER_COLOR} max-h-[220px] overflow-y-auto custom-scrollbar`}>
                        {processContentString(item.aiData.totalContent).map((line, i) => renderContentLine(line, i))}
                    </div>
                )}
             </div>

             {/* External Links */}
             {!isEditingMetadata && (
                <div className="space-y-3 pt-2">
                   <div className={`${INPUT_BG} rounded-xl p-4 border ${BORDER_COLOR}`}>
                       <span className={`block text-xs font-bold ${TEXT_MUTED} uppercase mb-3 flex items-center gap-1.5 tracking-wider`}><LinkIcon className="w-3.5 h-3.5"/> Fuentes & Enlaces</span>
                       <ul className="space-y-3 mb-4">
                           {item.aiData.sourceUrls?.slice(0, 2).map((source, idx) => (
                            <li key={idx}>
                                <a href={source.uri} target="_blank" rel="noreferrer" className="text-sm hover:text-[var(--theme-color)] truncate block flex items-center gap-2 text-slate-400 transition-colors" style={{ '--theme-color': dynamicColor } as React.CSSProperties}>
                                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-50" /> <span className="truncate">{source.title}</span>
                                </a>
                            </li>
                           ))}
                           {tracking.customLinks?.map((link) => (
                               <li key={link.id} className="flex items-center justify-between group/link">
                                   <a href={link.url} target="_blank" rel="noreferrer" className="text-sm text-indigo-300 hover:text-indigo-200 truncate flex items-center gap-2 flex-1">
                                       <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                                       <span className="truncate" title={link.url}>{link.title || 'Enlace'}</span>
                                   </a>
                                   <button onClick={() => removeCustomLink(link.id)} className="opacity-0 group-hover/link:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1"><X className="w-3.5 h-3.5" /></button>
                               </li>
                           ))}
                       </ul>
                       <form onSubmit={handleAddCustomLink} className="flex gap-2 relative mt-2">
                            <input type="text" placeholder="URL..." className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--theme-color)] transition-colors`} value={customLinkUrl} onChange={(e) => setCustomLinkUrl(e.target.value)} style={{ '--theme-color': dynamicColor } as React.CSSProperties} />
                            <button type="submit" disabled={!customLinkUrl.trim()} className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-3 flex items-center justify-center disabled:opacity-50 border border-slate-700 transition-colors"><Plus className="w-4 h-4" /></button>
                       </form>
                   </div>
                </div>
             )}
          </div>
        </div>

        {/* COL 2: CENTER (Synopsis, Progress & Characters) */}
        <div className="p-6 md:p-8 flex flex-col gap-8 bg-[#0B0E14] overflow-y-auto custom-scrollbar">
          
          {/* CARD: Synopsis */}
          <div className={`${CARD_BG} p-6 md:p-8 rounded-2xl border ${BORDER_COLOR} relative shadow-xl`}>
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-slate-400" /> Sinopsis
                </h3>
                {!isEditingMetadata && (
                    <button onClick={handleRefreshInfo} disabled={!apiKey || isRefreshingInfo} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 disabled:opacity-50 transition-colors" title="Actualizar con IA">
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingInfo ? 'animate-spin' : ''}`} /> {isRefreshingInfo ? 'Actualizando...' : 'Actualizar con IA'}
                    </button>
                )}
            </div>
            
            {isEditingMetadata ? (
                <textarea className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-xl p-5 text-base text-slate-200 focus:border-[var(--theme-color)] outline-none h-64 resize-none leading-relaxed`} value={editSynopsis} onChange={(e) => setEditSynopsis(e.target.value)} placeholder="Escribe una sinopsis..." style={{ '--theme-color': dynamicColor } as React.CSSProperties} />
            ) : (
                <p className="text-slate-300 text-base leading-relaxed whitespace-pre-line font-normal">{item.aiData.synopsis}</p>
            )}
          </div>

          {/* CARD: Progress (Narrative/State) */}
          <div 
            className={`${CARD_BG} p-6 md:p-8 rounded-2xl border ${BORDER_COLOR} shadow-xl`}
            style={{ borderLeft: `4px solid ${dynamicColor}` }} // Dynamic Accent
          >
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-slate-400" /> Mi Progreso
                  </h3>
                  {completionMessage && (
                      <span className="text-xs bg-yellow-500/10 text-yellow-500 px-3 py-1.5 rounded-full font-bold border border-yellow-500/20 animate-pulse">{completionMessage.title}</span>
                  )}
              </div>
              
              <div className="space-y-6">
                  <div>
                      <span className={`block text-xs font-bold ${TEXT_MUTED} uppercase mb-2 tracking-wider`}>ESTADO</span>
                      <select value={tracking.status} onChange={(e) => handleInputChange('status', e.target.value)} className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-xl px-4 py-3.5 text-base text-white outline-none focus:border-[var(--theme-color)] appearance-none cursor-pointer font-medium transition-colors`} style={{ '--theme-color': dynamicColor } as React.CSSProperties}>
                        {['Sin empezar', 'Viendo/Leyendo', 'Completado', 'En Pausa', 'Descartado', 'Planeado / Pendiente'].map(s => (
                            <option key={s} value={s}>{s === 'Viendo/Leyendo' ? (isReadingContent ? 'Leyendo' : 'Viendo') : s}</option>
                        ))}
                      </select>
                  </div>

                  {/* Date Inputs based on status */}
                  {tracking.status === 'Planeado / Pendiente' && (
                      <div className="animate-fade-in">
                          <span className={`block text-xs font-bold ${TEXT_MUTED} uppercase mb-2 tracking-wider flex items-center gap-1.5`}>
                              <Calendar className="w-3.5 h-3.5" /> Fecha Prevista
                          </span>
                          <input 
                              type="date" 
                              value={tracking.nextReleaseDate || ''} 
                              onChange={(e) => handleInputChange('nextReleaseDate', e.target.value)} 
                              className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors`} 
                              style={{ '--theme-color': dynamicColor } as React.CSSProperties} 
                          />
                      </div>
                  )}

                  {tracking.status === 'En Pausa' && (
                      <div className="animate-fade-in">
                          <span className={`block text-xs font-bold ${TEXT_MUTED} uppercase mb-2 tracking-wider flex items-center gap-1.5`}>
                              <Calendar className="w-3.5 h-3.5" /> Retomar el
                          </span>
                          <input 
                              type="date" 
                              value={tracking.scheduledReturnDate || ''} 
                              onChange={(e) => handleInputChange('scheduledReturnDate', e.target.value)} 
                              className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors`} 
                              style={{ '--theme-color': dynamicColor } as React.CSSProperties} 
                          />
                      </div>
                  )}

                  {isMovie ? (
                      <div>
                          <span className={`block text-xs font-bold ${TEXT_MUTED} uppercase mb-2 tracking-wider`}>ACCIÓN RÁPIDA</span>
                          <button onClick={handleMovieToggle} className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-base border ${tracking.status === 'Completado' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}>
                                {tracking.status === 'Completado' ? <CheckCircle2 className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                                {tracking.status === 'Completado' ? 'COMPLETADO' : 'MARCAR VISTO'}
                          </button>
                      </div>
                  ) : (
                      <div className="flex gap-4">
                          <div className="flex-1">
                              <span className={`block text-xs font-bold ${TEXT_MUTED} uppercase mb-2 tracking-wider`}>VISTOS</span>
                              <input type="number" min="0" value={tracking.watchedEpisodes} onChange={(e) => handleInputChange('watchedEpisodes', parseInt(e.target.value) || 0)} className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-xl px-2 py-3.5 text-base font-bold text-center text-white outline-none focus:border-[var(--theme-color)] transition-colors`} style={{ '--theme-color': dynamicColor } as React.CSSProperties} />
                          </div>
                          <div className="flex-1">
                              <div className="flex justify-between items-center mb-2">
                                <span className={`block text-xs font-bold ${TEXT_MUTED} uppercase tracking-wider`}>TOTAL</span>
                                {!tracking.totalEpisodesInSeason && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                              </div>
                              <input type="number" min="1" value={tracking.totalEpisodesInSeason} onChange={(e) => handleInputChange('totalEpisodesInSeason', parseInt(e.target.value) || 0)} className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-xl px-2 py-3.5 text-base font-bold text-center text-white outline-none focus:border-[var(--theme-color)] transition-colors`} style={{ '--theme-color': dynamicColor } as React.CSSProperties} />
                          </div>
                      </div>
                  )}
              </div>

              {!isMovie && (
                  <div className="mt-8">
                      <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                          <span>Progreso T.{tracking.currentSeason}</span>
                          <span style={{ color: dynamicColor }}>{Math.round(progressPercent)}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner">
                          <div className="h-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(255,255,255,0.2)]" style={{ width: `${progressPercent}%`, backgroundColor: dynamicColor }} />
                      </div>
                  </div>
              )}
          </div>

          {/* CARD: Characters (Moved from Right to Center) */}
          <div className={`${CARD_BG} p-6 md:p-8 rounded-2xl border ${BORDER_COLOR} shadow-xl`}>
               <div className="mb-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-slate-400" /> Personajes Destacados</h3>
                    <div className={`flex items-center gap-3 p-1.5 rounded-xl border ${BORDER_COLOR} ${INPUT_BG} mb-4`}>
                        <input type="text" value={characterInput} onChange={handleCharacterInputChange} onKeyDown={handleCharacterKeyDown} placeholder="Añadir nombre..." className="bg-transparent px-4 py-2 flex-grow text-sm text-white outline-none placeholder-slate-600" />
                        <button onClick={addCharacter} className="bg-primary hover:bg-indigo-600 text-white p-2 rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {getSafeCharacters(tracking.favoriteCharacters).map((char, idx) => (
                            <div key={`${char}-${idx}`} className="group flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 shadow-sm">
                                <span className="truncate max-w-[150px]">{char}</span>
                                <button onClick={() => removeCharacter(char)} className="hover:text-red-400 text-slate-500 transition-colors bg-slate-900/50 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                            </div>
                        ))}
                    </div>
               </div>
          </div>

        </div>

        {/* COL 3: RIGHT SIDEBAR (Analysis) */}
        <div className="p-6 md:p-8 flex flex-col gap-8 bg-[#0F1119] border-t lg:border-t-0 lg:border-l border-slate-800 overflow-y-auto custom-scrollbar">
          
          {/* CARD: Rating & Share (Compact) */}
          <div className={`${CARD_BG} p-4 rounded-2xl border ${BORDER_COLOR} shadow-xl`}>
               <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-slate-400" /> Calificación
              </h3>
              <div className="grid grid-cols-4 gap-2 mb-4">
                   {RATING_OPTIONS.map(opt => {
                       const config = RATING_CONFIG[opt];
                       const Icon = config.icon;
                       const isSelected = tracking.rating === opt;
                       
                       return (
                           <button 
                               key={opt}
                               onClick={() => handleInputChange('rating', opt)}
                               className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all aspect-square group ${
                                   isSelected 
                                   ? 'bg-white/10 border-[var(--theme-color)] text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]' 
                                   : 'bg-[#1A1D26] border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                               }`}
                               style={isSelected ? { borderColor: dynamicColor, '--theme-color': dynamicColor } as React.CSSProperties : {}}
                           >
                               <Icon className={`w-4 h-4 ${isSelected ? 'scale-110 fill-current' : 'group-hover:scale-110 transition-transform'}`} style={isSelected ? { color: dynamicColor } : {}} />
                               <span className="text-[9px] font-bold text-center leading-tight uppercase tracking-tight">{config.shortLabel}</span>
                           </button>
                       )
                   })}
               </div>
               
               <button onClick={handleShare} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 transition-all text-xs">
                    <Share2 className="w-4 h-4" /> Copiar Reseña IA
               </button>
          </div>

          {/* CARD: Reflection (Tags & Recommended By) */}
          <div className={`${CARD_BG} p-6 md:p-8 rounded-2xl border ${BORDER_COLOR} shadow-xl`}>
               <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-slate-400" /> Reflexión
              </h3>
              
              <div className="space-y-6">
                  <div>
                      <span className={`block text-xs font-bold ${TEXT_MUTED} uppercase mb-2 tracking-wider`}>RECOMENDADO POR</span>
                      <input type="text" value={tracking.recommendedBy || ''} onChange={(e) => handleInputChange('recommendedBy', e.target.value)} className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[var(--theme-color)] placeholder-slate-700`} placeholder="Ej: Laura, r/anime..." style={{ '--theme-color': dynamicColor } as React.CSSProperties} />
                  </div>

                  <div>
                      <span className={`block text-xs font-bold ${TEXT_MUTED} uppercase mb-2 tracking-wider`}>RESUMEN EMOCIONAL</span>
                      {/* Fixed height container with scroll for tags */}
                      <div className="max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                          <div className="flex flex-wrap gap-2">
                              {EMOTIONAL_TAGS_OPTIONS.map(opt => {
                                  const isActive = tracking.emotionalTags?.includes(opt.label);
                                  const isNegative = opt.sentiment === 'negative';
                                  return (
                                      <button
                                        key={opt.label}
                                        onClick={() => toggleTag(opt.label)}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-2 ${
                                            isActive 
                                            ? (isNegative ? 'bg-red-500/20 border-red-500 text-white' : 'bg-white/10 text-white') 
                                            : 'bg-[#1A1D26] border-slate-800 text-slate-400 hover:bg-slate-800'
                                        }`}
                                        style={isActive && !isNegative ? { borderColor: dynamicColor, boxShadow: `0 0 10px ${dynamicColor}30` } : {}}
                                      >
                                          <span>{opt.emoji}</span>
                                          {opt.label}
                                      </button>
                                  )
                              })}
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* CARD: Comments (Moved from Right Bottom) */}
          <div className={`${CARD_BG} p-6 md:p-8 rounded-2xl border ${BORDER_COLOR} shadow-xl`}>
               <div>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-slate-400" /> Comentario Final</h3>
                    <textarea className={`w-full ${INPUT_BG} border ${BORDER_COLOR} rounded-xl p-4 text-sm text-slate-200 focus:border-[var(--theme-color)] outline-none h-32 resize-none placeholder-slate-600 leading-relaxed`} value={tracking.comment} onChange={(e) => handleInputChange('comment', e.target.value)} placeholder="Tus pensamientos finales..." style={{ '--theme-color': dynamicColor } as React.CSSProperties} />
               </div>
          </div>

        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-surface border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                  <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-bold text-white flex items-center gap-2"><Sparkles className="w-6 h-6 text-yellow-400" /> {isGeneratingShare ? 'Generando Reseña IA...' : 'Listo para compartir'}</h3>
                          <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                      </div>
                      {isGeneratingShare ? (
                          <div className="py-12 flex flex-col items-center justify-center text-slate-400"><Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" /><p className="text-base font-medium">Redactando el tweet perfecto...</p></div>
                      ) : (
                          <>
                            <div className="bg-slate-900 rounded-xl p-5 border border-slate-700 mb-6 relative group"><textarea className="w-full bg-transparent border-none text-slate-300 text-sm resize-none focus:ring-0 h-48 custom-scrollbar leading-relaxed" value={shareTextContent} onChange={(e) => setShareTextContent(e.target.value)} readOnly={false} /></div>
                            <button onClick={executeCopy} className="w-full py-4 bg-primary hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 text-base"><Copy className="w-5 h-5" /> Copiar al Portapapeles</button>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
