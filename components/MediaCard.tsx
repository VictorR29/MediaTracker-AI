
import React, { useState, useEffect, useRef } from 'react';
import { MediaItem, UserTrackingData, EMOTIONAL_TAGS_OPTIONS, RATING_OPTIONS, AIWorkData } from '../types';
import { updateMediaInfo, generateReviewSummary } from '../services/geminiService';
import { 
  PlayCircle, CheckCircle2, ChevronLeft, ChevronRight, AlertTriangle, 
  Edit3, Save, X, Trash2, ExternalLink, Calendar, 
  Wand2, RefreshCw, MessageSquare, Star, Tv, Link as LinkIcon, 
  Minus, Plus, Heart, BookOpen, FileText, User, Layout, Clock, Globe,
  Upload, Image as ImageIcon, CalendarClock
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface MediaCardProps {
  item: MediaItem;
  onUpdate: (item: MediaItem) => void;
  onDelete?: () => void;
  isNew?: boolean;
  username?: string;
  apiKey?: string;
  initialEditMode?: boolean;
  onSearch?: (query: string) => void;
}

// Helper to extract dominant color from image
const extractColorFromImage = (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSrc;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve('#6366f1'); return; }

            canvas.width = 100;
            canvas.height = 100;
            // Draw image to small canvas
            ctx.drawImage(img, 0, 0, 100, 100);
            
            try {
                const data = ctx.getImageData(10, 10, 80, 80).data; // Crop borders
                let r = 0, g = 0, b = 0, count = 0;

                for (let i = 0; i < data.length; i += 4) {
                    const cr = data[i];
                    const cg = data[i + 1];
                    const cb = data[i + 2];
                    
                    // Filter out whites/blacks/greys to get vibrant colors
                    const brightness = (cr + cg + cb) / 3;
                    const saturation = Math.max(cr, cg, cb) - Math.min(cr, cg, cb);
                    
                    if (brightness > 20 && brightness < 245 && saturation > 20) {
                        r += cr;
                        g += cg;
                        b += cb;
                        count++;
                    }
                }

                if (count > 0) {
                    r = Math.round(r / count);
                    g = Math.round(g / count);
                    b = Math.round(b / count);
                    // Convert to Hex
                    const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                    resolve(hex);
                } else {
                    resolve('#6366f1'); // Fallback
                }
            } catch (e) {
                resolve('#6366f1'); // Fallback on CORS or error
            }
        };
        img.onerror = () => resolve('#6366f1');
    });
};

export const MediaCard: React.FC<MediaCardProps> = ({ 
  item, onUpdate, onDelete, isNew = false, username, apiKey, initialEditMode = false, onSearch 
}) => {
  const { showToast } = useToast();
  
  // State
  const [isEditing, setIsEditing] = useState(initialEditMode || isNew);
  const [localData, setLocalData] = useState<MediaItem>(item);
  const [isUpdatingInfo, setIsUpdatingInfo] = useState(false);
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Local state for new inputs
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newGenreInput, setNewGenreInput] = useState(''); 

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalData(item);
  }, [item]);

  const { aiData, trackingData: tracking } = localData;

  const isMovie = aiData.mediaType === 'Pelicula';
  const isBook = aiData.mediaType === 'Libro';
  const isReadingContent = ['Manhwa', 'Manga', 'Comic', 'Libro'].includes(aiData.mediaType);
  const dynamicColor = aiData.primaryColor || '#6366f1';

  // Handlers
  const handleInputChange = (field: keyof UserTrackingData, value: any) => {
    const updated = {
      ...localData,
      trackingData: { ...localData.trackingData, [field]: value }
    };
    setLocalData(updated);
    if (!isEditing) onUpdate(updated);
  };

  const handleAIDataChange = (field: keyof AIWorkData, value: any) => {
      setLocalData(prev => ({
          ...prev,
          aiData: { ...prev.aiData, [field]: value }
      }));
  };

  const processImageFile = async (file: File) => {
      if (!file.type.startsWith('image/')) {
          showToast("Por favor sube un archivo de imagen válido", "error");
          return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          if (base64) {
              handleAIDataChange('coverImage', base64);
              try {
                  const extractedColor = await extractColorFromImage(base64);
                  handleAIDataChange('primaryColor', extractedColor);
                  showToast("Color extraído: " + extractedColor, "success");
              } catch (err) {
                  console.error("Color extraction failed", err);
              }
          }
      };
      reader.readAsDataURL(file);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      if (isEditing) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!isEditing) return;

      const file = e.dataTransfer.files?.[0];
      if (file) processImageFile(file);
  };

  const handleImageClick = () => {
      if (isEditing && fileInputRef.current) {
          fileInputRef.current.click();
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processImageFile(file);
  };

  const handleAddGenre = () => {
      if (!newGenreInput.trim()) return;
      const currentGenres = aiData.genres || [];
      if (!currentGenres.includes(newGenreInput.trim())) {
          handleAIDataChange('genres', [...currentGenres, newGenreInput.trim()]);
      }
      setNewGenreInput('');
  };

  const handleRemoveGenre = (genreToRemove: string) => {
      const currentGenres = aiData.genres || [];
      handleAIDataChange('genres', currentGenres.filter(g => g !== genreToRemove));
  };

  const saveChanges = () => {
      onUpdate(localData);
      setIsEditing(false);
      showToast(isNew ? "Obra guardada" : "Cambios guardados", "success");
  };

  const cancelChanges = () => {
      if (isNew && onDelete) onDelete();
      else {
          setLocalData(item);
          setIsEditing(false);
      }
  };

  const handleAddCustomLink = () => {
      if (!newLinkUrl.trim()) return;
      const currentLinks = tracking.customLinks || [];
      const newLink = { 
          id: Date.now().toString(), 
          url: newLinkUrl.startsWith('http') ? newLinkUrl : `https://${newLinkUrl}`,
          title: new URL(newLinkUrl.startsWith('http') ? newLinkUrl : `https://${newLinkUrl}`).hostname.replace('www.', '')
      };
      handleInputChange('customLinks', [...currentLinks, newLink]);
      setNewLinkUrl('');
      showToast("Enlace añadido", "success");
  };

  const handleRemoveCustomLink = (id: string) => {
      const currentLinks = tracking.customLinks || [];
      handleInputChange('customLinks', currentLinks.filter(l => l.id !== id));
  };

  const handleSmartUpdate = async () => {
      if (!apiKey) return showToast("Falta API Key", "error");
      setIsUpdatingInfo(true);
      try {
          const { updatedData, hasChanges } = await updateMediaInfo(aiData, apiKey);
          if (hasChanges) {
              const newData = { ...localData, aiData: { ...localData.aiData, ...updatedData } };
              setLocalData(newData);
              onUpdate(newData);
              showToast("Info actualizada", "success");
          } else showToast("Ya está actualizado", "info");
      } catch (e) { showToast("Error al actualizar", "error"); }
      finally { setIsUpdatingInfo(false); }
  };

  const handleGenerateReview = async () => {
      if (!apiKey) return showToast("Falta API Key", "error");
      setIsGeneratingReview(true);
      try {
          const review = await generateReviewSummary(aiData.title, tracking.rating, tracking.emotionalTags, tracking.comment, apiKey);
          handleInputChange('comment', review);
          showToast("Reseña generada", "success");
      } catch (e) { showToast("Error generando", "error"); }
      finally { setIsGeneratingReview(false); }
  };

  // Progress Calculations
  const progressPercent = tracking.totalEpisodesInSeason > 0 
    ? Math.min(100, (tracking.watchedEpisodes / tracking.totalEpisodesInSeason) * 100) 
    : 0;

  return (
    <div className="bg-surface/50 border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl animate-fade-in-up w-full">
        {/* Adjusted Grid Layout: Reduced side columns on LG to give more space to center */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] xl:grid-cols-[320px_1fr_320px] gap-0 lg:gap-8 xl:gap-10 p-6 md:p-8 xl:p-10">
            
            {/* --- COLUMN 1: LEFT (Identity & Metadata) --- */}
            <div className="flex flex-col gap-6 xl:gap-8">
                {/* Poster with Interactive Upload */}
                <div className="flex flex-col gap-3">
                    <div 
                        className={`relative rounded-2xl overflow-hidden shadow-2xl aspect-[2/3] bg-slate-900 group transition-all duration-300 ${isEditing ? 'cursor-pointer' : ''} ${isDragging ? 'ring-4 ring-indigo-500 scale-[1.02]' : ''}`}
                        onClick={handleImageClick}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        style={{
                            border: isEditing ? `2px dashed ${isDragging ? '#6366f1' : '#475569'}` : `1px solid ${dynamicColor}40`,
                            boxShadow: isEditing ? 'none' : `0 20px 40px -10px ${dynamicColor}40`
                        }}
                    >
                        {aiData.coverImage ? (
                            <img src={aiData.coverImage} alt={aiData.title} className="w-full h-full object-cover transition-opacity pointer-events-none" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 p-4 text-center">
                                <ImageIcon className="w-16 h-16 mb-2 opacity-50" />
                                <span className="text-xs font-medium opacity-50">Sin Imagen</span>
                            </div>
                        )}
                        
                        {/* Overlay for editing image visual cue */}
                        {isEditing && (
                            <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                <Upload className="w-8 h-8 text-white mb-2" />
                                <span className="text-white text-xs font-bold px-3 py-1 rounded-full border border-white/20 backdrop-blur-sm text-center">
                                    {isDragging ? 'Suelta la imagen aquí' : 'Click o Arrastra para cambiar'}
                                </span>
                            </div>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleFileChange}
                        />
                    </div>
                    {isEditing && (
                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">URL de Portada (Opcional)</label>
                            <input 
                                value={aiData.coverImage || ''}
                                onChange={(e) => {
                                    handleAIDataChange('coverImage', e.target.value);
                                    // Try to extract color from URL if pasted (only works if CORS allows)
                                    if(e.target.value.startsWith('http')) extractColorFromImage(e.target.value).then(c => handleAIDataChange('primaryColor', c));
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500"
                                placeholder="https://..."
                            />
                        </div>
                    )}
                </div>

                {/* Title Block */}
                <div>
                    {isEditing ? (
                        <div className="space-y-3 mb-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Título Principal</label>
                                <input 
                                    value={aiData.title}
                                    onChange={(e) => handleAIDataChange('title', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-lg font-bold text-white outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Título Original</label>
                                <input 
                                    value={aiData.originalTitle || ''}
                                    onChange={(e) => handleAIDataChange('originalTitle', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-400 italic outline-none focus:border-indigo-500"
                                    placeholder="Ej: Kimetsu no Yaiba"
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-2xl xl:text-3xl font-black text-white leading-tight mb-2">{aiData.title}</h1>
                            {aiData.originalTitle && <p className="text-sm text-slate-500 italic mb-4">{aiData.originalTitle}</p>}
                        </>
                    )}
                    
                    <div className="flex flex-wrap gap-2 mb-6 xl:mb-8">
                        <span className="px-3 xl:px-4 py-1.5 bg-slate-800/80 border border-slate-700 rounded text-[10px] xl:text-xs font-bold text-slate-400 uppercase">{aiData.mediaType}</span>
                        <span className="px-3 xl:px-4 py-1.5 bg-slate-800/80 border border-slate-700 rounded text-[10px] xl:text-xs font-bold text-slate-400 uppercase">{aiData.status}</span>
                        {!isEditing && (
                            <button onClick={() => setIsEditing(true)} className="p-1.5 text-slate-500 hover:text-white transition-colors" title="Editar detalles">
                                <Edit3 className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    <div className="flex gap-2 xl:gap-3 mb-8 xl:mb-10">
                        <button 
                            onClick={() => handleInputChange('is_favorite', !tracking.is_favorite)}
                            className={`flex-1 py-3 xl:py-4 rounded-2xl font-bold text-xs xl:text-sm flex items-center justify-center gap-2 border transition-all ${tracking.is_favorite ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                        >
                            <Star className={`w-4 h-4 xl:w-5 xl:h-5 ${tracking.is_favorite ? 'fill-current' : ''}`} /> FAVORITO
                        </button>
                        {onDelete && (
                            <button onClick={onDelete} className="p-3 xl:p-4 bg-red-900/10 hover:bg-red-900/20 text-red-500 border border-red-900/30 rounded-2xl transition-colors">
                                <Trash2 className="w-5 h-5 xl:w-6 xl:h-6" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Metadata Details */}
                <div className="space-y-5 xl:space-y-6 text-sm border-t border-slate-800 pt-6 xl:pt-8">
                    <div className="flex flex-col gap-2">
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px] xl:text-xs">Fechas</span>
                        <div className="flex justify-between items-center text-slate-300 text-xs xl:text-sm">
                            <span className="font-medium">Estreno:</span> 
                            {isEditing ? (
                                <input 
                                    type="date" 
                                    value={aiData.releaseDate || ''}
                                    onChange={(e) => handleAIDataChange('releaseDate', e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 w-32"
                                />
                            ) : (
                                <span className="font-mono">{aiData.releaseDate || '----'}</span>
                            )}
                        </div>
                        <div className="flex justify-between items-center text-slate-300 text-xs xl:text-sm">
                            <span className="font-medium">Final:</span> 
                            {isEditing ? (
                                <input 
                                    type="date" 
                                    value={aiData.endDate || ''}
                                    onChange={(e) => handleAIDataChange('endDate', e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 w-32"
                                />
                            ) : (
                                <span className="font-mono">{aiData.endDate || '----'}</span>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px] xl:text-xs">Géneros</span>
                        <div className="flex flex-wrap gap-2">
                            {(aiData.genres || []).map(g => (
                                <span key={g} className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-xs flex items-center gap-1.5">
                                    {g}
                                    {isEditing && (
                                        <button onClick={() => handleRemoveGenre(g)} className="text-slate-500 hover:text-red-400">
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </span>
                            ))}
                        </div>
                        {isEditing && (
                            <div className="flex gap-2">
                                <input 
                                    value={newGenreInput}
                                    onChange={(e) => setNewGenreInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddGenre()}
                                    placeholder="Añadir género..."
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                                />
                                <button onClick={handleAddGenre} className="bg-slate-800 hover:bg-indigo-600 p-1.5 rounded-lg border border-slate-700 text-white transition-colors">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px] xl:text-xs flex items-center gap-2"><Layout className="w-3 h-3 xl:w-4 xl:h-4"/> Estructura</span>
                        {isEditing ? (
                             <textarea 
                                value={aiData.totalContent || ''}
                                onChange={(e) => handleAIDataChange('totalContent', e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-2xl p-3 text-xs text-white outline-none focus:border-indigo-500 min-h-[100px]"
                                placeholder="Ej: 2 Temporadas&#10;- Temp 1: 12 Caps"
                             />
                        ) : (
                            <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 shadow-inner">
                                <pre className="whitespace-pre-wrap font-sans text-slate-300 leading-relaxed text-xs xl:text-sm">{aiData.totalContent || 'No definida'}</pre>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px] xl:text-xs flex items-center gap-2"><Globe className="w-3 h-3 xl:w-4 xl:h-4 text-indigo-400"/> Mis Enlaces & Seguimiento</span>
                        <div className="flex flex-col gap-2">
                            {tracking.customLinks && tracking.customLinks.map((link) => (
                                <div key={link.id} className="flex items-center justify-between group bg-slate-900/50 p-2 rounded-xl border border-slate-800/50">
                                    <a href={link.url} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-white truncate flex items-center gap-3 flex-1 text-xs xl:text-sm">
                                        <LinkIcon className="w-3 h-3 opacity-50" /> {link.title || 'Enlace'}
                                    </a>
                                    <button onClick={() => handleRemoveCustomLink(link.id)} className="p-1.5 text-slate-600 hover:text-red-500 transition-colors">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <div className="flex gap-2 mt-2">
                                <input 
                                    placeholder="Pegar URL..." 
                                    value={newLinkUrl}
                                    onChange={(e) => setNewLinkUrl(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomLink()}
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-indigo-500" 
                                />
                                <button onClick={handleAddCustomLink} className="bg-slate-800 hover:bg-indigo-600 p-2 rounded-xl border border-slate-700 text-white transition-colors">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- COLUMN 2: CENTER (Narrative & Tracking) --- */}
            <div className="flex flex-col gap-6 xl:gap-10 pt-10 lg:pt-0">
                {/* Synopsis */}
                <div className="bg-slate-900/40 rounded-[2.5rem] p-6 xl:p-8 border border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between mb-4 xl:mb-6">
                        <h3 className="text-xs xl:text-base font-bold text-slate-400 uppercase tracking-widest flex items-center gap-3">
                            <FileText className="w-4 h-4 xl:w-5 xl:h-5" /> Sinopsis
                        </h3>
                        <button onClick={handleSmartUpdate} disabled={isUpdatingInfo} className="text-[10px] xl:text-xs text-indigo-400 flex items-center gap-2 font-bold hover:underline">
                            <RefreshCw className={`w-3 h-3 xl:w-4 xl:h-4 ${isUpdatingInfo ? 'animate-spin' : ''}`} /> ACTUALIZAR CON IA
                        </button>
                    </div>
                    {isEditing ? (
                        <textarea 
                            value={aiData.synopsis}
                            onChange={(e) => handleAIDataChange('synopsis', e.target.value)}
                            className="w-full h-56 bg-slate-900/50 border border-slate-700 rounded-2xl p-5 text-slate-300 text-sm xl:text-base outline-none focus:border-indigo-500 leading-relaxed"
                        />
                    ) : (
                        <p className="text-sm xl:text-base text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                            {aiData.synopsis}
                        </p>
                    )}
                </div>

                {/* Progress Tracking */}
                <div className="bg-slate-900/50 rounded-[2.5rem] p-6 xl:p-8 border border-slate-800 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                    <div className="flex items-center justify-between mb-6 xl:mb-8">
                        <h3 className="text-xs xl:text-base font-bold text-white uppercase tracking-widest flex items-center gap-3">
                            <CheckCircle2 className="w-4 h-4 xl:w-5 xl:h-5 text-indigo-500" /> Mi Progreso
                        </h3>
                        <div className="bg-indigo-500/10 text-indigo-400 text-[10px] xl:text-xs font-bold px-3 py-1 rounded-full border border-indigo-500/20">
                            ¡Victoria, {username || 'Vikthor'}!
                        </div>
                    </div>

                    <div className="space-y-6 xl:space-y-8">
                        {/* Status Select */}
                        <div>
                            <span className="block text-[10px] xl:text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 xl:mb-3">Estado de la Obra</span>
                            <select 
                                value={tracking.status}
                                onChange={(e) => handleInputChange('status', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 xl:px-5 xl:py-4 text-sm xl:text-base font-bold text-white outline-none focus:border-indigo-500 appearance-none shadow-inner"
                            >
                                <option value="Sin empezar">Sin empezar</option>
                                <option value="Viendo/Leyendo">Viendo/Leyendo</option>
                                <option value="Completado">Completado</option>
                                <option value="En Pausa">En Pausa</option>
                                <option value="Descartado">Descartado</option>
                                <option value="Planeado / Pendiente">Planeado / Pendiente</option>
                            </select>
                        </div>

                        {/* Optional Date Picker for Planned/Upcoming */}
                        {tracking.status === 'Planeado / Pendiente' && (
                            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-2xl p-4 animate-fade-in">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2 text-indigo-300">
                                        <CalendarClock className="w-5 h-5" />
                                        <span className="text-xs font-bold uppercase tracking-wide">¿Cuándo se estrena / planeas verla?</span>
                                    </div>
                                    <input 
                                        type="date"
                                        value={tracking.nextReleaseDate || ''}
                                        onChange={(e) => handleInputChange('nextReleaseDate', e.target.value)}
                                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <p className="text-[10px] text-indigo-400/70 mt-2 pl-1">
                                    Define una fecha para ver una cuenta regresiva en tu biblioteca.
                                </p>
                            </div>
                        )}

                        {/* Season & Episode Controls */}
                        {!isMovie && (
                            <div className="space-y-4 xl:space-y-6">
                                <div className="grid grid-cols-2 gap-4 xl:gap-6">
                                    <div className="flex-1">
                                        <span className="block text-[10px] xl:text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 xl:mb-3">
                                            {isReadingContent ? 'Volumen Actual' : 'Temporada Actual'}
                                        </span>
                                        <div className="relative">
                                            <button 
                                                onClick={() => handleInputChange('currentSeason', Math.max(1, tracking.currentSeason - 1))}
                                                className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-white"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <input 
                                                type="number"
                                                value={tracking.currentSeason}
                                                onChange={(e) => handleInputChange('currentSeason', parseInt(e.target.value) || 1)}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 xl:py-4 text-center text-base xl:text-lg font-bold text-white outline-none"
                                            />
                                            <button 
                                                onClick={() => handleInputChange('currentSeason', tracking.currentSeason + 1)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-white"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <span className="block text-[10px] xl:text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 xl:mb-3">Total {isReadingContent ? 'Vols' : 'Temps'}</span>
                                        <input 
                                            type="number"
                                            value={tracking.totalSeasons}
                                            onChange={(e) => handleInputChange('totalSeasons', parseInt(e.target.value) || 1)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 xl:py-4 text-center text-base xl:text-lg font-bold text-white outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 xl:gap-6">
                                    <div>
                                        <span className="block text-[10px] xl:text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 xl:mb-3">Capítulos Vistos</span>
                                        <div className="relative">
                                          <button 
                                              onClick={() => handleInputChange('watchedEpisodes', Math.max(0, tracking.watchedEpisodes - 1))}
                                              className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-white"
                                          >
                                              <Minus className="w-3 h-3 xl:w-4 xl:h-4" />
                                          </button>
                                          <input 
                                              type="number"
                                              value={tracking.watchedEpisodes}
                                              onChange={(e) => handleInputChange('watchedEpisodes', parseInt(e.target.value) || 0)}
                                              className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 xl:py-4 text-center text-base xl:text-lg font-bold text-white outline-none"
                                          />
                                          <button 
                                              onClick={() => handleInputChange('watchedEpisodes', tracking.watchedEpisodes + 1)}
                                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-white"
                                          >
                                              <Plus className="w-3 h-3 xl:w-4 xl:h-4" />
                                          </button>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] xl:text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 xl:mb-3">Total Capítulos</span>
                                        <input 
                                            type="number"
                                            value={tracking.totalEpisodesInSeason}
                                            onChange={(e) => handleInputChange('totalEpisodesInSeason', parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 xl:py-4 text-center text-base xl:text-lg font-bold text-white outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-[10px] xl:text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 xl:mb-3">
                                        <span>Progreso T.{tracking.currentSeason}</span>
                                        <span>{progressPercent.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700 shadow-[0_0_15px_rgba(79,70,229,0.4)]" 
                                            style={{ width: `${progressPercent}%` }} 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {isMovie && (
                            <button 
                                onClick={() => handleInputChange('status', tracking.status === 'Completado' ? 'Sin empezar' : 'Completado')}
                                className={`w-full py-4 xl:py-5 rounded-[1.25rem] font-black text-sm xl:text-base flex items-center justify-center gap-4 transition-all border-2 ${tracking.status === 'Completado' ? 'bg-green-500/10 border-green-500/50 text-green-500 shadow-lg shadow-green-500/10' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                            >
                                {tracking.status === 'Completado' ? <CheckCircle2 className="w-5 h-5 xl:w-6 xl:h-6" /> : <PlayCircle className="w-5 h-5 xl:w-6 xl:h-6" />}
                                {tracking.status === 'Completado' ? 'COMPLETADO' : 'MARCAR COMO VISTO'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Personajes Destacados */}
                <div className="bg-slate-900/40 rounded-[2.5rem] p-6 xl:p-8 border border-slate-800">
                    <h3 className="text-xs xl:text-base font-bold text-slate-400 uppercase tracking-widest flex items-center gap-3 mb-4 xl:mb-6">
                        <User className="w-4 h-4 xl:w-5 xl:h-5" /> Personajes Destacados
                    </h3>
                    <div className="flex flex-wrap gap-2 xl:gap-3 mb-4 xl:mb-6">
                        {(tracking.favoriteCharacters || []).map((char, idx) => (
                            <span key={idx} className="px-3 py-1.5 xl:px-4 xl:py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs xl:text-sm font-medium text-slate-300 flex items-center gap-2 xl:gap-3">
                                {char} <button onClick={() => handleInputChange('favoriteCharacters', (tracking.favoriteCharacters || []).filter((_, i) => i !== idx))}><X className="w-3 h-3 text-slate-500 hover:text-white" /></button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2 xl:gap-3">
                        <input 
                            placeholder="Añadir nombre de personaje..." 
                            className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl px-4 py-2.5 xl:px-5 xl:py-3 text-sm text-white outline-none focus:border-indigo-500"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = (e.target as HTMLInputElement).value.trim();
                                    if (val) {
                                        handleInputChange('favoriteCharacters', [...(tracking.favoriteCharacters || []), val]);
                                        (e.target as HTMLInputElement).value = '';
                                    }
                                }
                            }}
                        />
                        <button className="p-2.5 xl:p-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-all shadow-lg shadow-orange-600/20">
                            <Plus className="w-5 h-5 xl:w-6 xl:h-6" />
                        </button>
                    </div>
                </div>
            </div>

            {/* --- COLUMN 3: RIGHT (Rating & Reflection) --- */}
            <div className="flex flex-col gap-6 xl:gap-8 pt-10 lg:pt-0">
                {/* Rating Grid */}
                <div className="bg-slate-900/40 rounded-[2.5rem] p-6 border border-slate-800 flex flex-col shadow-xl">
                    <div className="grid grid-cols-4 gap-2 xl:gap-3 mb-6 xl:mb-8">
                        {RATING_OPTIONS.map((opt) => {
                            const isSelected = tracking.rating === opt;
                            const label = opt.split(' ')[0];
                            return (
                                <button
                                    key={opt}
                                    onClick={() => handleInputChange('rating', opt)}
                                    className={`flex flex-col items-center gap-1 xl:gap-2 p-2 xl:p-3 rounded-2xl border transition-all ${isSelected ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400 shadow-lg' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800'}`}
                                >
                                    <Star className={`w-3 h-3 xl:w-4 xl:h-4 ${isSelected ? 'fill-current' : ''}`} />
                                    <span className="text-[8px] xl:text-[9px] font-black uppercase tracking-tighter text-center">{label}</span>
                                </button>
                            );
                        })}
                    </div>
                    <button 
                        onClick={handleGenerateReview} 
                        disabled={isGeneratingReview}
                        className="w-full py-3 xl:py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] xl:text-xs font-black flex items-center justify-center gap-2 xl:gap-3 shadow-xl shadow-indigo-600/25 transition-all uppercase tracking-[0.2em]"
                    >
                        <Wand2 className="w-4 h-4 xl:w-5 xl:h-5" /> Copiar Reseña IA
                    </button>
                </div>

                {/* Reflection */}
                <div className="bg-slate-900/40 rounded-[2.5rem] p-6 xl:p-8 border border-slate-800 shadow-xl flex flex-col min-h-0">
                    <h3 className="text-sm xl:text-base font-bold text-white mb-6 xl:mb-8 flex items-center gap-3">
                        <MessageSquare className="w-4 h-4 xl:w-5 xl:h-5 text-slate-400" /> Reflexión
                    </h3>
                    
                    <div className="mb-6 xl:mb-8">
                        <span className="block text-[10px] xl:text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 xl:mb-3">Recomendado por</span>
                        <input 
                            value={tracking.recommendedBy || ''}
                            onChange={(e) => handleInputChange('recommendedBy', e.target.value)}
                            placeholder="Ej: Laura, r/anime..."
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-4 py-2.5 xl:px-5 xl:py-3 text-sm text-slate-300 outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div className="flex-1 flex flex-col min-h-0">
                        <span className="block text-[10px] xl:text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 xl:mb-4">Resumen Emocional</span>
                        {/* Emotional Tags WITH SCROLL */}
                        <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar space-y-2 xl:space-y-2.5 max-h-[300px] xl:max-h-[350px]">
                            {EMOTIONAL_TAGS_OPTIONS.map(tag => {
                                const isActive = (tracking.emotionalTags || []).includes(tag.label);
                                return (
                                    <button
                                        key={tag.label}
                                        onClick={() => {
                                            const currentTags = tracking.emotionalTags || [];
                                            const newTags = isActive 
                                                ? currentTags.filter(t => t !== tag.label)
                                                : [...currentTags, tag.label];
                                            handleInputChange('emotionalTags', newTags);
                                        }}
                                        className={`w-full flex items-center gap-2 xl:gap-3 px-3 py-2.5 xl:px-4 xl:py-3 rounded-2xl text-[10px] xl:text-[11px] font-black border transition-all text-left uppercase tracking-tight ${isActive ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300 shadow-inner' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:bg-slate-800'}`}
                                    >
                                        <span className="text-xs xl:text-sm">{tag.emoji}</span>
                                        <span className="truncate">{tag.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Final Comment */}
                <div className="bg-slate-900/40 rounded-[2.5rem] p-6 xl:p-8 border border-slate-800 flex-1 flex flex-col shadow-xl">
                    <h3 className="text-sm xl:text-base font-bold text-white mb-4 xl:mb-6 flex items-center gap-3">
                        <FileText className="w-4 h-4 xl:w-5 xl:h-5 text-slate-400" /> Comentario Final
                    </h3>
                    <textarea 
                        value={tracking.comment}
                        onChange={(e) => handleInputChange('comment', e.target.value)}
                        placeholder="Tus pensamientos finales sobre esta experiencia..."
                        className="w-full flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl p-4 xl:p-5 text-sm text-slate-300 outline-none focus:border-indigo-500 resize-none leading-relaxed min-h-[120px] xl:min-h-[140px]"
                    />
                </div>
            </div>
        </div>

        {/* Action Bar (Only visible when editing or is new) */}
        {isEditing && (
            <div className="p-8 border-t border-slate-800 bg-slate-900/80 backdrop-blur-xl flex gap-4 sticky bottom-0 z-40">
                <button onClick={saveChanges} className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-green-600/20 transition-all text-base tracking-widest">
                    <Save className="w-6 h-6" /> GUARDAR TODO
                </button>
                <button onClick={cancelChanges} className="py-4 px-10 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-all border border-slate-700 text-base">
                    CANCELAR
                </button>
            </div>
        )}
    </div>
  );
};
