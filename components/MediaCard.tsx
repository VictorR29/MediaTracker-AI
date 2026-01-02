
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MediaItem, UserTrackingData, EMOTIONAL_TAGS_OPTIONS, RATING_OPTIONS } from '../types';
import { useToast } from '../context/ToastContext';
import { generateReviewSummary, searchMediaInfo, updateMediaInfo } from '../services/geminiService';
import { BookOpen, Tv, Clapperboard, CheckCircle2, AlertCircle, Link as LinkIcon, ExternalLink, ImagePlus, ChevronRight, ChevronLeft, Book, FileText, Crown, Trophy, Star, ThumbsUp, Smile, Meh, Frown, Trash2, X, AlertTriangle, Users, Share2, Globe, Plus, Calendar, Bell, Medal, CalendarDays, GitMerge, Loader2, Sparkles, Copy, Pencil, Save, RefreshCw, Search } from 'lucide-react';

interface MediaCardProps {
  item: MediaItem;
  onUpdate: (updatedItem: MediaItem) => void;
  isNew?: boolean;
  onDelete?: () => void;
  username?: string;
  apiKey?: string; // New prop for AI generation
  initialEditMode?: boolean; // New prop to start in edit mode
  onSearch?: (query: string) => void; // New prop for content search
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
  
  // Metadata Edit State
  const [isEditingMetadata, setIsEditingMetadata] = useState(initialEditMode);
  const [editTitle, setEditTitle] = useState(item.aiData.title);
  const [editOriginalTitle, setEditOriginalTitle] = useState(item.aiData.originalTitle || '');
  const [editSynopsis, setEditSynopsis] = useState(item.aiData.synopsis);
  const [editGenres, setEditGenres] = useState(item.aiData.genres.join(', '));
  const [editTotalContent, setEditTotalContent] = useState(item.aiData.totalContent);
  const [editMediaType, setEditMediaType] = useState(item.aiData.mediaType);
  const [editStatus, setEditStatus] = useState(item.aiData.status);

  // Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTextContent, setShareTextContent] = useState('');

  // Use the AI provided color or fall back to a default Indigo-ish color if missing
  const dynamicColor = item.aiData.primaryColor || '#6366f1';
  const isFavorite = tracking.is_favorite || false;

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

  // --- Dynamic Congratulatory Message Logic (Updated) ---
  const completionMessage = useMemo(() => {
     if (tracking.status !== 'Completado') return null;
     
     const user = username || 'Viajero';
     const title = item.aiData.title;
     
     // Deep Info
     const chars = tracking.favoriteCharacters;
     const charList = Array.isArray(chars) ? chars : (typeof chars === 'string' ? (chars as string).split(',') : []);
     const character = charList.length > 0 ? charList[0].trim() : null;

     const templates = [
         // T1: Victoria Clásica
         { 
             title: `¡Victoria, ${user}!`, 
             body: `Has conquistado "${title}" y añadido otra gema a tu colección.` 
         },
         // T2: Despedida Personaje
         { 
             title: character ? `¡Felicidades!` : `¡Enhorabuena!`, 
             body: character 
                ? `Ha sido un largo viaje junto a ${character}. La historia de "${title}" vivirá en tu memoria.`
                : `Has llegado al final de "${title}". Un viaje inolvidable.`
         },
         // T3: Logro Desbloqueado
         { 
             title: `¡Logro Desbloqueado!`, 
             body: `Completaste "${title}". Tu perfil de ${item.aiData.mediaType} sube de nivel.`
         },
         // T4: Emocional
         { 
             title: `Ciclo cerrado.`, 
             body: `Has completado "${title}", ${user}. Es hora de procesar lo vivido.` 
         },
         // T5: Coleccionista
         { 
             title: `Honor a quien honor merece.`, 
             body: `"${title}" ha sido completada con éxito. Tu colección brilla más hoy.` 
         }
     ];

     // Random selection to feel dynamic
     return templates[Math.floor(Math.random() * templates.length)];
  }, [tracking.status, username, item.aiData.title, tracking.favoriteCharacters, item.aiData.mediaType]);

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
    
    // STRICT CONSUMPTION LOGIC FOR TIMESTAMP UPDATE
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
        status: editStatus
    };

    onUpdate({ ...item, aiData: updatedAI });
    setIsEditingMetadata(false);
    showToast("Información actualizada", "success");
  };

  const handleCancelMetadata = () => {
      // Revert fields
      setEditTitle(item.aiData.title);
      setEditOriginalTitle(item.aiData.originalTitle || '');
      setEditSynopsis(item.aiData.synopsis);
      setEditGenres(item.aiData.genres.join(', '));
      setEditTotalContent(item.aiData.totalContent);
      setEditMediaType(item.aiData.mediaType);
      setEditStatus(item.aiData.status);
      setIsEditingMetadata(false);
  };

  const handleRefreshInfo = async () => {
    if (!apiKey) return;
    
    setIsRefreshingInfo(true);
    try {
        // Use the new smart update service
        const { updatedData, hasChanges } = await updateMediaInfo(item.aiData, apiKey);
        
        if (hasChanges) {
            const mergedAiData = {
                ...item.aiData,
                ...updatedData,
                // Ensure we don't overwrite if API returns null/undefined for fields we want to keep
                synopsis: updatedData.synopsis || item.aiData.synopsis,
                // Explicitly preserve image and color
                coverImage: item.aiData.coverImage,
                primaryColor: item.aiData.primaryColor
            };

            onUpdate({
                ...item,
                aiData: mergedAiData
            });
            showToast("Información actualizada con éxito", "success");
        } else {
            showToast("Ya posees la información más reciente", "info");
        }
    } catch (error) {
        console.error("Refresh error:", error);
        showToast("Error al verificar actualizaciones", "error");
    } finally {
        setIsRefreshingInfo(false);
    }
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
       const updated = { ...tracking, status: 'Completado' as const };
       setTracking(updated);
       onUpdate({ ...item, trackingData: updated, lastInteraction: Date.now() }); // Consumption
       showToast("¡Obra completada! Felicitaciones 🎉", "success");
       return;
    }

    // ARCHIVE CONSUMPTION: Add current progress to accumulated_consumption history
    const currentAccumulated = tracking.accumulated_consumption || 0;
    const newAccumulated = currentAccumulated + tracking.watchedEpisodes;

    const updated = {
      ...tracking,
      currentSeason: nextSeason,
      watchedEpisodes: 0,
      accumulated_consumption: newAccumulated, // Archiving the completed season/book progress
      status: 'Viendo/Leyendo' as const
    };
    setTracking(updated);
    onUpdate({ ...item, trackingData: updated, lastInteraction: Date.now() }); // Consumption
    showToast(`Temporada ${tracking.currentSeason} terminada. ¡A por la siguiente!`, "success");
  };

  const handleMovieToggle = () => {
      const isCompleted = tracking.status === 'Completado';
      const nextStatus: UserTrackingData['status'] = isCompleted ? 'Viendo/Leyendo' : 'Completado';
      const updated: UserTrackingData = {
          ...tracking,
          status: nextStatus,
          watchedEpisodes: isCompleted ? 0 : 1,
          totalEpisodesInSeason: 1
      };
      // If completing, set date to today if empty
      if (!isCompleted && !tracking.finishedAt) {
          updated.finishedAt = new Date().toISOString().split('T')[0];
      }
      setTracking(updated);

      // Only update timestamp if we are marking as completed (Consumption)
      // If unchecking, it's an undo, usually not a new "interaction" of consumption, but preserving old timestamp is safer.
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
        // Prevent duplicates
        if (!current.includes(val)) {
            const newChars = [...current, val];
            handleInputChange('favoriteCharacters', newChars);
        }
        setCharacterInput('');
    }
  };

  const handleCharacterInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Check for delimiters (comma or semicolon) to auto-create tag
    if (val.includes(',') || val.includes(';')) {
         const parts = val.split(/[,;]+/);
         const current = getSafeCharacters(tracking.favoriteCharacters);
         let newChars = [...current];
         
         parts.forEach(part => {
             const clean = part.trim();
             if (clean && !newChars.includes(clean)) {
                 newChars.push(clean);
             }
         });

         if (newChars.length !== current.length) {
            handleInputChange('favoriteCharacters', newChars);
         }
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

  const moveCharacter = (index: number, direction: 'left' | 'right') => {
      const current = getSafeCharacters(tracking.favoriteCharacters);
      const newIndex = direction === 'left' ? index - 1 : index + 1;
      
      if (newIndex < 0 || newIndex >= current.length) return;
      
      const newChars = [...current];
      // Swap
      [newChars[index], newChars[newIndex]] = [newChars[newIndex], newChars[index]];
      
      handleInputChange('favoriteCharacters', newChars);
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
      showToast("Por favor selecciona un archivo de imagen válido.", "error");
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
                },
                lastInteraction: item.lastInteraction // Preserve existing timestamp
            });
            showToast("Imagen actualizada con éxito", "success");

        } catch (error) {
            console.error("Error processing image color", error);
            onUpdate({ 
                ...item, 
                aiData: { 
                    ...item.aiData, 
                    coverImage: result
                },
                lastInteraction: item.lastInteraction // Preserve existing timestamp
            });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // --- MODIFIED SHARE LOGIC TO PREVENT PERMISSION ERRORS ---
  const handleShare = async () => {
    const { title } = item.aiData;
    const { rating, emotionalTags, comment, customLinks } = tracking;

    // Format Custom Links to include in recommendation
    const formattedLinks = customLinks && customLinks.length > 0 
        ? '\n\n' + customLinks.map(l => `🔗 ${l.title || 'Ver en'}: ${l.url}`).join('\n') 
        : '';

    // Helper to format simple text
    const getSimpleText = () => `📺 *${title}*\n⭐ Calificación: ${rating || 'Sin calificar'}\n🎭 Mood: ${emotionalTags.join(', ') || 'N/A'}\n📝 "${comment || 'Sin comentarios'}"${formattedLinks}\n\nTracked with MediaTracker AI`;

    if (apiKey) {
        setIsGeneratingShare(true);
        let textToShare = "";
        try {
            const synthesizedReview = await generateReviewSummary(title, rating, emotionalTags, comment, apiKey);
            textToShare = `📺 ${title}\n⭐ ${rating || 'Sin calificar'}\n\n${synthesizedReview}${formattedLinks}\n\n#MediaTrackerAI #Recomendación`;
        } catch (error) {
            console.error("Error generating review", error);
            showToast("Error de IA. Usando formato simple.", "warning");
            textToShare = getSimpleText();
        } finally {
            setIsGeneratingShare(false);
            setShareTextContent(textToShare);
            setShowShareModal(true); // Open Modal instead of writing directly to clipboard
        }
    } else {
        // Fallback or No API Key
        const shareText = getSimpleText();
        
        // Try direct copy first since no async delay involved
        try {
            await navigator.clipboard.writeText(shareText);
            showToast("¡Recomendación copiada al portapapeles!", "success");
        } catch (e) {
            // If even immediate copy fails, use modal
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
          showToast("Error al copiar. Por favor selecciona y copia manualmente.", "error");
      }
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

  // Helper to parse and render complex content strings
  const processContentString = (text: string) => {
      // Basic cleanup first
      let processed = text.replace(/\), /g, ')\n');
      
      // If the content comes from the new format (Header + Indented), it should already be newlines.
      // But we double check for legacy comma separation just in case.
      if (!text.includes('\n')) {
          // Attempt to split legacy comma lists intelligently
          processed = processed.replace(/, (\d+ )/g, '\n$1');
      }

      return processed.split('\n').filter(line => line.trim() !== '');
  };

  const renderContentLine = (line: string, index: number) => {
    // Regex to capture title in single or double quotes
    // Looks for "1 Film ('Title')" or "Pelicula ('Title')"
    const movieRegex = /(?:Film|Movie|Película|Special|Especial|OVA).*?['"“](.+?)['"”]/i;
    const match = line.match(movieRegex);

    // Classification Logic
    const trimLine = line.trim();
    // 1. Headers: "X Temporadas" or "X Seasons" (No dash, starts with number)
    const isSeasonHeader = /^\d+\s+(Temporadas|Seasons|Series)/i.test(trimLine) && !trimLine.startsWith('-');
    
    // 2. Details: Starts with "-" or "Season X"
    const isSeasonDetail = trimLine.startsWith('-') || /^(Season|Temporada)/i.test(trimLine);
    
    // 3. Extras: Contains "OVA", "Pelicula", "Film" (and usually has a match from movieRegex)
    const isExtra = /OVA|Película|Movie|Film|Special|Especial/i.test(trimLine) && !isSeasonHeader;

    // Cleanup line for display
    let displayLine = trimLine;
    if (displayLine.endsWith(')')) displayLine = displayLine.slice(0, -1); 
    if (displayLine.startsWith('-')) displayLine = displayLine.substring(1).trim(); 

    // Styles
    let containerClass = "text-sm text-slate-200";
    let bullet = "";

    if (isSeasonHeader) {
        containerClass = "font-bold text-white text-sm mb-1 mt-2 border-b border-white/10 pb-1";
    } else if (isSeasonDetail) {
        containerClass = "ml-4 text-xs text-slate-300 flex items-center gap-2";
        bullet = "•";
    } else if (isExtra) {
        containerClass = "font-semibold text-indigo-200 mt-2 text-xs flex flex-wrap gap-1 items-center bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20 w-fit";
    }

    return (
        <div key={index} className={containerClass}>
            {bullet && <span className="text-slate-500">{bullet}</span>}
            <span>{displayLine}</span>
            {match && onSearch && (
                <button
                    onClick={() => onSearch(match[1])}
                    className="flex items-center gap-1 px-2 py-0.5 bg-primary/20 hover:bg-primary/40 text-primary text-[10px] rounded border border-primary/30 transition-colors ml-1 cursor-pointer"
                    title={`Buscar "${match[1]}" en la biblioteca`}
                >
                    <Search className="w-3 h-3" />
                    <span className="underline font-medium">{match[1]}</span>
                </button>
            )}
        </div>
    );
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
                  {isEditingMetadata ? 'Editando...' : item.aiData.mediaType}
                </span>
             </div>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect}/>
          </div>

          <div className="flex items-start justify-between gap-2 z-10 mb-1">
            {isEditingMetadata ? (
                <div className="w-full">
                    <input 
                        className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-lg font-bold text-white mb-2 focus:border-primary outline-none"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Título principal"
                    />
                    <div className="flex gap-2">
                        <button onClick={handleSaveMetadata} className="p-1.5 bg-green-600 rounded hover:bg-green-700 transition-colors" title="Guardar"><Save className="w-4 h-4 text-white" /></button>
                        <button onClick={handleCancelMetadata} className="p-1.5 bg-slate-700 rounded hover:bg-slate-600 transition-colors" title="Cancelar"><X className="w-4 h-4 text-white" /></button>
                    </div>
                </div>
            ) : (
                <>
                <div className="flex items-center gap-2">
                    <h2 
                        className="text-2xl font-bold leading-tight" 
                        style={{ color: dynamicColor, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                    >
                        {item.aiData.title}
                    </h2>
                     <button 
                         onClick={() => setIsEditingMetadata(true)} 
                         className="opacity-50 hover:opacity-100 transition-opacity p-1"
                         title="Editar información (Metadata)"
                     >
                         <Pencil className="w-4 h-4 text-slate-400" />
                     </button>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                    onClick={() => handleInputChange('is_favorite', !isFavorite)} 
                    className="p-1.5 hover:bg-slate-800 rounded-full transition-colors"
                    title={isFavorite ? "Quitar de Favoritos" : "Marcar como Favorito"}
                    >
                        <Star className={`w-5 h-5 transition-all ${isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-slate-500 hover:text-white'}`} />
                    </button>
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
                </>
            )}
          </div>
          
          {/* FRANCHISE LINK DISPLAY */}
          {item.aiData.franchise_link && !isEditingMetadata && (
             <div className="z-10 mb-2 animate-fade-in-up">
                <div 
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/50 border border-slate-700/50 text-xs font-medium text-slate-300"
                    title="Esta película pertenece a esta franquicia"
                >
                    <GitMerge className="w-3 h-3 text-indigo-400" />
                    <span className="opacity-70">Parte de:</span>
                    <span className="text-white font-semibold truncate max-w-[180px]">{item.aiData.franchise_link}</span>
                </div>
             </div>
          )}

          {isEditingMetadata ? (
               <input 
                 className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-slate-300 mb-2 focus:border-primary outline-none"
                 value={editOriginalTitle}
                 onChange={(e) => setEditOriginalTitle(e.target.value)}
                 placeholder="Título original (opcional)"
               />
          ) : (
            item.aiData.originalTitle && (
                <p className="text-slate-400 text-sm mb-4 italic z-10">{item.aiData.originalTitle}</p>
            )
          )}
          
          <div className="space-y-3 text-sm text-slate-300 z-10">
             <div>
                <span className="text-slate-500 font-semibold block text-xs uppercase">Estado Publicación</span>
                {isEditingMetadata ? (
                    <input 
                      className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white focus:border-primary outline-none"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      placeholder="Ej: Finalizado, En emisión..."
                    />
                ) : (
                    <span className="flex items-center gap-1">
                       {item.aiData.status}
                    </span>
                )}
             </div>
             
             {/* EDITING EXTRA FIELDS */}
             {isEditingMetadata && (
                <div>
                     <span className="text-slate-500 font-semibold block text-xs uppercase">Tipo de Medio</span>
                     <select 
                        className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white focus:border-primary outline-none"
                        value={editMediaType}
                        onChange={(e) => setEditMediaType(e.target.value as any)}
                     >
                         <option value="Anime">Anime</option>
                         <option value="Serie">Serie</option>
                         <option value="Pelicula">Película</option>
                         <option value="Manhwa">Manhwa</option>
                         <option value="Manga">Manga</option>
                         <option value="Libro">Libro</option>
                         <option value="Comic">Comic</option>
                         <option value="Otro">Otro</option>
                     </select>
                </div>
             )}

             {/* Dates Section - Only Show Read Only */}
             {!isEditingMetadata && (item.aiData.releaseDate || item.aiData.endDate) && (
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
                {isEditingMetadata ? (
                     <textarea 
                       className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white focus:border-primary outline-none resize-y min-h-[60px]"
                       value={editTotalContent}
                       onChange={(e) => setEditTotalContent(e.target.value)}
                       placeholder={`Ej: 2 Temporadas:\n- Temporada 1: 12 Caps\n- Temporada 2: 24 Caps`}
                     />
                ) : (
                    <div className="bg-slate-950/30 p-2 rounded-lg border border-slate-700/30 mt-1">
                        {processContentString(item.aiData.totalContent).map((line, i) => renderContentLine(line, i))}
                    </div>
                )}
             </div>
             <div>
                <span className="text-slate-500 font-semibold block text-xs uppercase">Géneros</span>
                {isEditingMetadata ? (
                     <input 
                       className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white focus:border-primary outline-none"
                       value={editGenres}
                       onChange={(e) => setEditGenres(e.target.value)}
                       placeholder="Acción, Comedia, Drama..."
                     />
                ) : (
                    <div className="flex flex-wrap gap-1 mt-1">
                    {item.aiData.genres.map(g => (
                        <span key={g} className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-300 border border-slate-700">{g}</span>
                    ))}
                    </div>
                )}
             </div>
             
             {/* Sources & Links Section */}
             {!isEditingMetadata && (
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
             )}
          </div>
        </div>

        <div className="md:w-2/3 p-6 md:p-8 flex flex-col gap-6 bg-gradient-to-br from-surface to-slate-800">
          
          <div className="prose prose-invert max-w-none">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <BookOpen className="w-5 h-5" style={{ color: dynamicColor }} />
              Sinopsis
            </h3>
            {isEditingMetadata ? (
                <textarea 
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-sm text-slate-200 focus:border-primary outline-none h-32 resize-none"
                    value={editSynopsis}
                    onChange={(e) => setEditSynopsis(e.target.value)}
                    placeholder="Escribe una sinopsis..."
                />
            ) : (
                <>
                <p className="text-slate-300 text-sm leading-relaxed bg-slate-900/30 p-4 rounded-lg border border-slate-700/50">
                    {item.aiData.synopsis}
                </p>
                <div className="mt-2 flex justify-end">
                    <button 
                        onClick={handleRefreshInfo}
                        disabled={!apiKey || isRefreshingInfo}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Regenerar información usando el título actual"
                    >
                        <RefreshCw className={`w-3 h-3 ${isRefreshingInfo ? 'animate-spin' : ''}`} />
                        {isRefreshingInfo ? 'Actualizando...' : 'Actualizar Info con IA'}
                    </button>
                </div>
                </>
            )}
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

              {/* Congratulatory Message Banner */}
              {completionMessage && (
                  <div className="mb-4 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 p-3 rounded-lg flex items-start gap-3 animate-fade-in-up">
                      <div className="p-2 bg-amber-500/20 rounded-full flex-shrink-0">
                          <Medal className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                          <p className="text-sm font-bold text-amber-100 mb-0.5">
                              {completionMessage.title}
                          </p>
                          <p className="text-xs text-amber-200/80 leading-relaxed">
                              {completionMessage.body}
                          </p>
                      </div>
                  </div>
              )}
              
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
                    <option value="Sin empezar">Sin empezar</option>
                    <option value="Viendo/Leyendo">
                        {isReadingContent ? 'Leyendo' : 'Viendo'}
                    </option>
                    <option value="Completado">Completado</option>
                    <option value="En Pausa">En Pausa</option>
                    <option value="Descartado">Descartado</option>
                    <option value="Planeado / Pendiente">Planeado / Próximo Estreno</option>
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

                {/* Next Release Date (Only when Planned) */}
                {tracking.status === 'Planeado / Pendiente' && (
                    <div className="animate-fade-in-up mt-2 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                        <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                            <CalendarDays className="w-3 h-3 text-blue-400" /> Fecha de Próximo Estreno/Lanzamiento
                        </label>
                        <input 
                            type="date"
                            value={tracking.nextReleaseDate || ''}
                            onChange={(e) => handleInputChange('nextReleaseDate', e.target.value)}
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
                            <div className="animate-fade-in">
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
                                style={{ borderColor: `${dynamicColor}30`, '--tw-ring-color': dynamicColor } as React.CSSProperties}
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
                     style={{ borderColor: `${dynamicColor}30`, '--tw-ring-color': dynamicColor } as React.CSSProperties}
                   />
                </div>

                <div>
                   <label className="block text-xs font-medium text-slate-400 mb-2">Resumen Emocional</label>
                   <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {EMOTIONAL_TAGS_OPTIONS.map(opt => {
                        const currentTags = tracking.emotionalTags || [];
                        const isActive = currentTags.includes(opt.label);
                        const isNegative = opt.sentiment === 'negative';
                        return (
                          <button
                            key={opt.label}
                            onClick={() => toggleTag(opt.label)}
                            className={`text-[10px] px-2 py-2 rounded-md text-left transition-all border flex items-center gap-2 h-auto min-h-[36px] ${
                              isActive 
                              ? 'text-white shadow-[0_0_10px_rgba(0,0,0,0.3)]' 
                              : isNegative 
                                ? 'bg-red-950/20 text-red-200/70 border-red-900/30 hover:bg-red-900/40 hover:text-red-100' // Distinct negative style
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                            }`}
                            style={isActive ? {
                                backgroundColor: isNegative ? 'rgba(239, 68, 68, 0.2)' : `${dynamicColor}20`,
                                borderColor: isNegative ? '#ef4444' : dynamicColor,
                                color: isNegative ? '#fca5a5' : 'white',
                                boxShadow: `0 0 8px ${isNegative ? '#ef4444' : dynamicColor}40`
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
                
                {/* Share Button with AI Synthesis Support */}
                <button 
                  onClick={handleShare}
                  disabled={isGeneratingShare}
                  className="w-full flex items-center justify-center gap-2 py-2 mt-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 transition-colors disabled:opacity-70 disabled:cursor-not-allowed group/share"
                >
                  {isGeneratingShare ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        <span className="text-primary font-bold">Generando con IA...</span>
                      </>
                  ) : (
                      <>
                        {apiKey ? <Sparkles className="w-3 h-3 text-indigo-400 group-hover/share:text-indigo-300" /> : <Share2 className="w-3 h-3" />}
                        {apiKey ? "Copiar Reseña IA" : "Copiar Recomendación"}
                      </>
                  )}
                </button>

              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-700/50">
             <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Personajes memorables</label>
                <div className="space-y-3">
                    {/* Input Area */}
                    <div className="flex gap-2">
                        <div className="relative flex-grow">
                            <input 
                                type="text"
                                value={characterInput}
                                onChange={handleCharacterInputChange}
                                onKeyDown={handleCharacterKeyDown}
                                placeholder="Nombre (o separa con comas)..."
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 transition-all"
                                style={{ borderColor: `${dynamicColor}30`, '--tw-ring-color': dynamicColor } as React.CSSProperties}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-600 font-mono hidden md:block">↵</span>
                        </div>
                        <button 
                            onClick={addCharacter}
                            disabled={!characterInput.trim()}
                            className="bg-slate-700 hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 rounded-lg transition-colors flex items-center justify-center"
                            style={{ backgroundColor: characterInput.trim() ? dynamicColor : undefined }}
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Tags Area */}
                    <div className="flex flex-wrap gap-2 min-h-[32px]">
                        {getSafeCharacters(tracking.favoriteCharacters).map((char, idx) => {
                            const isTop5 = idx < 5;
                            const total = getSafeCharacters(tracking.favoriteCharacters).length;
                            return (
                                <span 
                                  key={idx} 
                                  className={`inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-md border text-xs text-white animate-fade-in shadow-sm transition-all group/tag ${
                                      isTop5 ? 'font-bold' : 'bg-slate-800 border-slate-700'
                                  }`}
                                  style={isTop5 ? { 
                                      backgroundColor: `${dynamicColor}20`, 
                                      borderColor: dynamicColor, 
                                      boxShadow: `0 0 5px ${dynamicColor}20` 
                                  } : { borderColor: `${dynamicColor}40` }}
                                >
                                    <span className={`text-[10px] mr-1 ${isTop5 ? 'opacity-90' : 'opacity-50'}`}>#{idx+1}</span>
                                    <span className="mr-1">{char}</span>
                                    
                                    {/* Controls Container */}
                                    <div className="flex items-center gap-0.5 border-l border-white/10 pl-1 ml-1 bg-black/10 rounded-r">
                                         <button 
                                            onClick={() => moveCharacter(idx, 'left')} 
                                            disabled={idx === 0}
                                            className="p-0.5 hover:text-white text-slate-400 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                                            title="Subir Prioridad"
                                         >
                                             <ChevronLeft className="w-3 h-3" />
                                         </button>
                                         <button 
                                            onClick={() => moveCharacter(idx, 'right')} 
                                            disabled={idx === total - 1}
                                            className="p-0.5 hover:text-white text-slate-400 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                                            title="Bajar Prioridad"
                                         >
                                             <ChevronRight className="w-3 h-3" />
                                         </button>
                                         <div className="w-px h-3 bg-white/10 mx-0.5"></div>
                                         <button 
                                            onClick={() => removeCharacter(char)} 
                                            className="p-0.5 hover:text-red-400 text-slate-400 transition-colors"
                                            title="Eliminar"
                                         >
                                             <X className="w-3 h-3" />
                                         </button>
                                    </div>
                                </span>
                            );
                        })}
                         {getSafeCharacters(tracking.favoriteCharacters).length === 0 && (
                            <p className="text-xs text-slate-600 italic py-1">Sin personajes registrados.</p>
                         )}
                    </div>
                </div>
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Comentario Final / Deseos</label>
                <textarea 
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all resize-none h-24 focus:ring-1"
                  style={{ borderColor: `${dynamicColor}30`, '--tw-ring-color': dynamicColor } as React.CSSProperties}
                  placeholder="Pensamientos finales..."
                  value={tracking.comment}
                  onChange={(e) => handleInputChange('comment', e.target.value)}
                />
             </div>
          </div>
          
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-surface border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-indigo-400" />
                        Compartir Reseña
                    </h3>
                    <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4">
                    <p className="text-xs text-slate-400 mb-2">Puedes editar el texto antes de copiarlo.</p>
                    <textarea 
                        value={shareTextContent}
                        onChange={(e) => setShareTextContent(e.target.value)}
                        className="w-full h-40 bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-primary resize-none mb-4 font-mono"
                    />
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowShareModal(false)}
                            className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={executeCopy}
                            className="flex-1 px-4 py-2.5 bg-primary hover:bg-indigo-600 text-white rounded-lg font-bold shadow-lg flex items-center justify-center gap-2"
                        >
                            <Copy className="w-4 h-4" />
                            Copiar Texto
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
