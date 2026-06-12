
import React, { useState, useEffect, useRef } from 'react';
import { MediaItem, UserTrackingData, AIWorkData, EMOTIONAL_TAGS_OPTIONS, RATING_OPTIONS } from '../types';
import { updateMediaInfo, generateReviewSummary } from '../services/geminiService';
import { computeNextSeason, createCustomLink, processImageToBase64, reorderCharacters } from '../services/mediaItemOperations';
import { useToast } from '../context/ToastContext';
import { extractColorFromImage, hexToRgb, vibrify } from './media-card/colorUtils';
import {
  Edit3, X, Trash2, Star, Link as LinkIcon,
  Plus, Layout, Globe, Upload, Image as ImageIcon,
  FileText, RefreshCw, CheckCircle2, ChevronLeft, ChevronRight,
  PlayCircle, User, Minus, CalendarClock, Trophy, Medal, GripVertical,
  Wand2, MessageSquare, Info, BarChart2, PenTool
} from 'lucide-react';
import { EditActionBar } from './media-card';

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

type TabId = 'info' | 'progreso' | 'resena';

export const MediaCard: React.FC<MediaCardProps> = ({
  item, onUpdate, onDelete, isNew = false, username, apiKey, initialEditMode = false, onSearch
}) => {
  const { showToast } = useToast();

  // State
  const [isEditing, setIsEditing] = useState(initialEditMode || isNew);
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [localData, setLocalData] = useState<MediaItem>(item);
  const [isUpdatingInfo, setIsUpdatingInfo] = useState(false);
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Drag & Drop State for Characters
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Local state for new inputs
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newGenreInput, setNewGenreInput] = useState('');
  const [newCharacterInput, setNewCharacterInput] = useState('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalData(item);
  }, [item]);

  const { aiData, trackingData: tracking } = localData;
  
  const rawColor = aiData.primaryColor || '#c084fc';
  const dynamicColor = React.useMemo(() => vibrify(rawColor), [rawColor]);
  const dynamicRgb = React.useMemo(() => hexToRgb(dynamicColor), [dynamicColor]);

  // Handlers
  const handleInputChange = (field: keyof UserTrackingData, value: any, shouldSave = true) => {
    const isProgressUpdate = field === 'watchedEpisodes' || field === 'currentSeason' || field === 'status';
    const updated = {
      ...localData,
      lastInteraction: isProgressUpdate ? Date.now() : localData.lastInteraction,
      trackingData: { ...localData.trackingData, [field]: value }
    };
    setLocalData(updated);
    if (!isEditing && shouldSave) onUpdate(updated);
  };

  const handleAIDataChange = (field: keyof AIWorkData, value: any) => {
    setLocalData(prev => ({
      ...prev,
      aiData: { ...prev.aiData, [field]: value }
    }));
  };

  const processImageFile = async (file: File) => {
    try {
      const base64 = await processImageToBase64(file);
      handleAIDataChange('coverImage', base64);
      try {
        const extractedColor = await extractColorFromImage(base64);
        handleAIDataChange('primaryColor', extractedColor);
        showToast("Color extraído: " + extractedColor, "success");
      } catch (err) {
        console.error("Color extraction failed", err);
      }
    } catch {
      showToast("Por favor sube un archivo de imagen válido", "error");
    }
  };

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

  const handleAddCharacter = () => {
    if (!newCharacterInput.trim()) return;
    const currentList = tracking.favoriteCharacters || [];
    handleInputChange('favoriteCharacters', [...currentList, { name: newCharacterInput.trim() }]);
    setNewCharacterInput('');
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
    const newLink = createCustomLink(newLinkUrl);
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

  const handleNextSeason = () => {
    const { updatedItem, message, isCompleted } = computeNextSeason(localData);
    if (isCompleted) {
      handleInputChange('status', 'Completado');
      showToast(message, "success");
    } else {
      setLocalData(updatedItem);
      if (!isEditing) onUpdate(updatedItem);
      showToast(message, "success");
    }
  };

  const handleCharDragStart = (e: React.DragEvent, position: number) => {
    dragItem.current = position;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCharDragEnter = (e: React.DragEvent, position: number) => {
    e.preventDefault();
    dragOverItem.current = position;
  };

  const handleCharDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dragIndex = dragItem.current;
    const hoverIndex = dragOverItem.current;
    if (dragIndex !== null && hoverIndex !== null && dragIndex !== hoverIndex) {
      const reordered = reorderCharacters(tracking.favoriteCharacters || [], dragIndex, hoverIndex);
      handleInputChange('favoriteCharacters', reordered);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleRemoveCharacter = (index: number) => {
    handleInputChange('favoriteCharacters', (tracking.favoriteCharacters || []).filter((_, i) => i !== index));
  };

  const progressPercent = tracking.totalEpisodesInSeason > 0
    ? Math.min(100, (tracking.watchedEpisodes / tracking.totalEpisodesInSeason) * 100)
    : 0;

  const isMovie = aiData.mediaType === 'Pelicula';
  const isReadingContent = ['Manhwa', 'Manga', 'Comic', 'Libro'].includes(aiData.mediaType);

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'info', label: 'Info', icon: Info },
    { id: 'progreso', label: 'Progreso', icon: BarChart2 },
    { id: 'resena', label: 'Reseña', icon: PenTool },
  ];

  return (
    <div
      className="relative bg-[#09090B] ring-1 ring-white/[0.04] rounded-3xl overflow-hidden shadow-2xl animate-fade-in-up w-full"
      style={{ 
        '--card-rgb': dynamicRgb,
        boxShadow: `0 0 80px -20px rgba(${dynamicRgb}, 0.25)`
      } as React.CSSProperties}
    >
      {/* Ambient Wash */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{ 
          background: `radial-gradient(ellipse at top left, rgba(${dynamicRgb}, 0.12) 0%, transparent 60%)` 
        }} 
      />

      <div className="relative z-10">
        {/* ─── HERO SECTION ─── */}
        <div className="relative">
          {/* Cover Image - Full width on mobile, overlaid */}
          <div className="relative h-[300px] sm:h-[350px] md:h-[400px] overflow-hidden">
            {aiData.coverImage ? (
              <img src={aiData.coverImage} alt={aiData.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-zinc-900">
                <ImageIcon className="w-20 h-20 mb-3 opacity-30" />
                <span className="text-sm font-medium opacity-40">Sin Imagen</span>
              </div>
            )}
            
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/60 to-transparent" />
            
            {/* Edit overlay for image */}
            {isEditing && (
              <div 
                className={`absolute inset-0 bg-black/50 flex flex-col items-center justify-center transition-opacity cursor-pointer ${isDragging ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
                onClick={handleImageClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="w-10 h-10 text-white mb-2" />
                <span className="text-white text-sm font-bold px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-sm">
                  {isDragging ? 'Soltar imagen' : 'Click o arrastra para cambiar'}
                </span>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

            {/* Title overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    value={aiData.title}
                    onChange={(e) => onAIDataChange('title', e.target.value)}
                    className="w-full bg-black/40 backdrop-blur-sm ring-1 ring-white/10 rounded-xl px-4 py-3 text-2xl sm:text-3xl font-black text-white outline-none focus:ring-white/20 placeholder:text-white/30"
                    placeholder="Título de la obra"
                  />
                  <input
                    value={aiData.originalTitle || ''}
                    onChange={(e) => onAIDataChange('originalTitle', e.target.value)}
                    className="w-full bg-black/40 backdrop-blur-sm ring-1 ring-white/10 rounded-xl px-4 py-2 text-sm text-zinc-300 italic outline-none focus:ring-white/20 placeholder:text-white/20"
                    placeholder="Título original (opcional)"
                  />
                </div>
              ) : (
                <div>
                  <h1 
                    className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight mb-2 drop-shadow-lg"
                    style={{ background: `linear-gradient(to right, #ffffff, ${dynamicColor})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                  >
                    {aiData.title}
                  </h1>
                  {aiData.originalTitle && (
                    <p className="text-sm sm:text-base text-zinc-400 italic drop-shadow-md">{aiData.originalTitle}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Badges & Actions bar */}
          <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 md:px-8 py-3 bg-zinc-900/50 border-b border-white/[0.04]">
            <span className="px-2.5 py-1 bg-zinc-800/80 ring-1 ring-white/[0.06] rounded-md text-[10px] font-bold text-zinc-400 uppercase">{aiData.mediaType}</span>
            <span className="px-2.5 py-1 bg-zinc-800/80 ring-1 ring-white/[0.06] rounded-md text-[10px] font-bold text-zinc-400 uppercase">{aiData.status}</span>
            {tracking.is_favorite && (
              <span className="px-2.5 py-1 bg-yellow-500/10 ring-1 ring-yellow-500/30 rounded-md text-[10px] font-bold text-yellow-500 uppercase flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" /> Favorito
              </span>
            )}
            
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => handleInputChange('is_favorite', !tracking.is_favorite)}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-xl transition-all ${
                  tracking.is_favorite 
                    ? 'text-yellow-500' 
                    : 'text-zinc-500 hover:text-yellow-500'
                }`}
              >
                <Star className={`w-5 h-5 ${tracking.is_favorite ? 'fill-current' : ''}`} />
              </button>
              
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-xl text-zinc-500 hover:text-white transition-all"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              )}

              {onDelete && (
                <button
                  onClick={onDelete}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-xl text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── TABS ─── */}
        <div className="flex border-b border-white/[0.04]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all relative ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-8 right-8 h-0.5 rounded-full" style={{ backgroundColor: dynamicColor }} />
              )}
            </button>
          ))}
        </div>

        {/* ─── TAB CONTENT ─── */}
        <div className="p-4 sm:p-6 md:p-8 min-h-[350px]">
          {/* ═══ INFO TAB ═══ */}
          {activeTab === 'info' && (
            <div className="space-y-6 animate-fade-in">
              {/* Synopsis */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Sinopsis
                  </h3>
                  <button onClick={handleSmartUpdate} disabled={isUpdatingInfo} className="text-xs text-[rgb(var(--card-rgb))] flex items-center gap-1 font-bold hover:underline">
                    <RefreshCw className={`w-3 h-3 ${isUpdatingInfo ? 'animate-spin' : ''}`} /> IA
                  </button>
                </div>
                {isEditing ? (
                  <textarea
                    value={aiData.synopsis}
                    onChange={(e) => onAIDataChange('synopsis', e.target.value)}
                    className="w-full h-40 bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl p-4 text-zinc-300 text-sm outline-none focus:ring-white/20 leading-relaxed resize-none"
                  />
                ) : (
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{aiData.synopsis}</p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Estreno</span>
                  {isEditing ? (
                    <input type="date" value={aiData.releaseDate || ''} onChange={(e) => onAIDataChange('releaseDate', e.target.value)}
                      className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-white/20" />
                  ) : (
                    <span className="text-sm text-zinc-300 font-mono">{aiData.releaseDate || '----'}</span>
                  )}
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Final</span>
                  {isEditing ? (
                    <input type="date" value={aiData.endDate || ''} onChange={(e) => onAIDataChange('endDate', e.target.value)}
                      className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-white/20" />
                  ) : (
                    <span className="text-sm text-zinc-300 font-mono">{aiData.endDate || '----'}</span>
                  )}
                </div>
              </div>

              {/* Genres */}
              <div>
                <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Géneros</span>
                <div className="flex flex-wrap gap-2">
                  {(aiData.genres || []).map(g => (
                    <span key={g} className="px-3 py-1.5 bg-zinc-800/50 ring-1 ring-white/[0.06] rounded-lg text-zinc-300 text-xs flex items-center gap-1.5">
                      {g}
                      {isEditing && (
                        <button onClick={() => handleRemoveGenre(g)} className="text-zinc-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                      )}
                    </span>
                  ))}
                </div>
                {isEditing && (
                  <div className="flex gap-2 mt-2">
                    <input value={newGenreInput} onChange={(e) => setNewGenreInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddGenre()}
                      placeholder="Añadir género..." className="flex-1 bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl px-3 py-2 text-xs text-white outline-none focus:ring-white/20" />
                    <button onClick={handleAddGenre} className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-zinc-800 hover:bg-[rgb(var(--card-rgb))] rounded-xl ring-1 ring-white/[0.06] text-white transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Structure */}
              <div>
                <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Layout className="w-3.5 h-3.5" /> Estructura
                </span>
                {isEditing ? (
                  <textarea value={aiData.totalContent || ''} onChange={(e) => onAIDataChange('totalContent', e.target.value)}
                    className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl p-3 text-xs text-white outline-none focus:ring-white/20 min-h-[80px] resize-none"
                    placeholder={"Ej: 2 Temporadas\n- Temp 1: 12 Caps"} />
                ) : (
                  <div className="bg-zinc-900/50 rounded-xl p-3 ring-1 ring-white/[0.06]">
                    <pre className="whitespace-pre-wrap font-sans text-zinc-300 text-sm">{aiData.totalContent || 'No definida'}</pre>
                  </div>
                )}
              </div>

              {/* Links */}
              <div>
                <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5" /> Enlaces
                </span>
                <div className="space-y-2">
                  {tracking.customLinks?.map((link) => (
                    <div key={link.id} className="flex items-center justify-between bg-zinc-900/50 p-2.5 rounded-xl ring-1 ring-white/[0.06]">
                      <a href={link.url} target="_blank" rel="noreferrer" className="text-[rgb(var(--card-rgb))] hover:text-white truncate flex items-center gap-2 flex-1 text-xs">
                        <LinkIcon className="w-3 h-3 opacity-50" /> {link.title || 'Enlace'}
                      </a>
                      {isEditing && (
                        <button onClick={() => handleRemoveCustomLink(link.id)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-600 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <div className="flex gap-2">
                      <input placeholder="Pegar URL..." value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomLink()}
                        className="flex-1 bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl px-3 py-2 text-white text-xs outline-none focus:ring-white/20" />
                      <button onClick={handleAddCustomLink} className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-zinc-800 hover:bg-[rgb(var(--card-rgb))] rounded-xl ring-1 ring-white/[0.06] text-white transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* URL de Portada (editing) */}
              {isEditing && (
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">URL de Portada</span>
                  <input value={aiData.coverImage || ''} onChange={(e) => {
                    handleAIDataChange('coverImage', e.target.value);
                    if (e.target.value.startsWith('http')) extractColorFromImage(e.target.value).then(c => handleAIDataChange('primaryColor', c));
                  }}
                    className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl px-3 py-2 text-xs text-zinc-300 outline-none focus:ring-white/20"
                    placeholder="https://..." />
                </div>
              )}
            </div>
          )}

          {/* ═══ PROGRESO TAB ═══ */}
          {activeTab === 'progreso' && (
            <div className="space-y-6 animate-fade-in">
              {/* Status */}
              <div>
                <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Estado</span>
                <select value={tracking.status} onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-white/20 appearance-none">
                  <option value="Sin empezar">Sin empezar</option>
                  <option value="Viendo/Leyendo">Viendo/Leyendo</option>
                  <option value="Completado">Completado</option>
                  <option value="En Pausa">En Pausa</option>
                  <option value="Descartado">Descartado</option>
                  <option value="Planeado / Pendiente">Planeado / Pendiente</option>
                </select>
              </div>

              {/* Planned Date */}
              {tracking.status === 'Planeado / Pendiente' && (
                <div className="bg-[rgb(var(--card-rgb)/0.1)] border border-[rgb(var(--card-rgb)/0.2)] rounded-xl p-4 animate-fade-in">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-[rgb(var(--card-rgb))]">
                      <CalendarClock className="w-4 h-4" />
                      <span className="text-xs font-bold">¿Cuándo se estrena?</span>
                    </div>
                    <input type="date" value={tracking.nextReleaseDate || ''} onChange={(e) => handleInputChange('nextReleaseDate', e.target.value)}
                      className="bg-zinc-900 ring-1 ring-white/[0.06] rounded-lg px-3 py-1.5 text-sm text-white outline-none" />
                  </div>
                </div>
              )}

              {/* Season & Episode Controls */}
              {!isMovie && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
                        {isReadingContent ? 'Volumen Actual' : 'Temporada Actual'}
                      </span>
                      <div className="relative">
                        <button onClick={() => handleInputChange('currentSeason', Math.max(1, tracking.currentSeason - 1))}
                          className="absolute left-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-white">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <input type="number" min={1} max={tracking.totalSeasons} value={tracking.currentSeason}
                          onChange={(e) => { let val = parseInt(e.target.value) || 1; if (tracking.totalSeasons > 0 && val > tracking.totalSeasons) val = tracking.totalSeasons; handleInputChange('currentSeason', val); }}
                          className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl py-3 text-center text-lg font-bold text-white outline-none" />
                        <button onClick={() => handleInputChange('currentSeason', tracking.totalSeasons > 0 ? Math.min(tracking.totalSeasons, tracking.currentSeason + 1) : tracking.currentSeason + 1)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-white">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Total {isReadingContent ? 'Vols' : 'Temps'}</span>
                      <input type="number" value={tracking.totalSeasons} onChange={(e) => handleInputChange('totalSeasons', parseInt(e.target.value) || 1)}
                        className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl py-3 text-center text-lg font-bold text-white outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Capítulos Vistos</span>
                      <div className="relative">
                        <button onClick={() => handleInputChange('watchedEpisodes', Math.max(0, tracking.watchedEpisodes - 1))}
                          className="absolute left-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-white">
                          <Minus className="w-4 h-4" />
                        </button>
                        <input type="number" min={0} max={tracking.totalEpisodesInSeason} value={tracking.watchedEpisodes}
                          onChange={(e) => { let val = parseInt(e.target.value) || 0; if (tracking.totalEpisodesInSeason > 0 && val > tracking.totalEpisodesInSeason) val = tracking.totalEpisodesInSeason; handleInputChange('watchedEpisodes', val); }}
                          className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl py-3 text-center text-lg font-bold text-white outline-none" />
                        <button onClick={() => handleInputChange('watchedEpisodes', tracking.totalEpisodesInSeason > 0 ? Math.min(tracking.totalEpisodesInSeason, tracking.watchedEpisodes + 1) : tracking.watchedEpisodes + 1)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-white">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Total Capítulos</span>
                      <input type="number" value={tracking.totalEpisodesInSeason} onChange={(e) => handleInputChange('totalEpisodesInSeason', parseInt(e.target.value) || 0)}
                        className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl py-3 text-center text-lg font-bold text-white outline-none" />
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
                      <span>Progreso T.{tracking.currentSeason}</span>
                      <span>{progressPercent.toFixed(0)}%</span>
                    </div>
                    <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full transition-all duration-700 rounded-full"
                        style={{ width: `${progressPercent}%`, background: `linear-gradient(to right, rgb(var(--card-rgb)), rgba(var(--card-rgb), 0.6))` }} />
                    </div>
                  </div>

                  {/* Complete Season Button */}
                  {tracking.totalEpisodesInSeason > 0 && tracking.watchedEpisodes >= tracking.totalEpisodesInSeason && (
                    <button onClick={handleNextSeason}
                      className="w-full py-3 bg-[rgb(var(--card-rgb))] hover:opacity-90 text-white rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all animate-fade-in">
                      <CheckCircle2 className="w-4 h-4" />
                      {tracking.currentSeason < tracking.totalSeasons ? `Completar Temporada ${tracking.currentSeason}` : 'Completar Obra'}
                    </button>
                  )}
                </div>
              )}

              {/* Movie Toggle */}
              {isMovie && (
                <button onClick={() => handleInputChange('status', tracking.status === 'Completado' ? 'Sin empezar' : 'Completado')}
                  className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all ring-1 ${
                    tracking.status === 'Completado' 
                      ? 'bg-green-500/10 ring-green-500/30 text-green-500' 
                      : 'bg-zinc-900/50 ring-white/[0.06] text-zinc-300 hover:bg-zinc-800'
                  }`}>
                  {tracking.status === 'Completado' ? <CheckCircle2 className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                  {tracking.status === 'Completado' ? 'COMPLETADO' : 'MARCAR COMO VISTO'}
                </button>
              )}

              {/* Characters */}
              <div>
                <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Personajes Destacados
                </span>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(tracking.favoriteCharacters || []).map((char, idx) => {
                    let rankStyle = "bg-zinc-800 ring-1 ring-zinc-600 text-zinc-300";
                    let icon = null;
                    if (idx === 0) { rankStyle = "bg-yellow-500/10 border-yellow-500 text-yellow-400"; icon = <Trophy className="w-3 h-3" />; }
                    else if (idx === 1) { rankStyle = "bg-zinc-300/10 border-zinc-400 text-zinc-300"; icon = <Medal className="w-3 h-3" />; }
                    else if (idx === 2) { rankStyle = "bg-orange-700/10 border-orange-700 text-orange-600"; icon = <Medal className="w-3 h-3" />; }
                    else if (idx < 5) { rankStyle = `bg-[rgb(var(--card-rgb)/0.1)] border-[rgb(var(--card-rgb)/0.5)] text-[rgb(var(--card-rgb))]`; }

                    return (
                      <div key={idx} className={`relative group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-move active:scale-95 ${rankStyle}`}
                        draggable onDragStart={(e) => handleCharDragStart(e, idx)} onDragEnter={(e) => handleCharDragEnter(e, idx)}
                        onDragOver={(e) => e.preventDefault()} onDrop={handleCharDrop}>
                        <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                        {icon}
                        <span>{char.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveCharacter(idx); }} className="ml-0.5 hover:text-white hover:bg-white/20 rounded-full p-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input placeholder="Añadir personaje..." value={newCharacterInput} onChange={(e) => setNewCharacterInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCharacter()}
                    className="flex-1 bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-white/20" />
                  <button onClick={handleAddCharacter} className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-[rgb(var(--card-rgb))] hover:opacity-90 text-white rounded-xl transition-all">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-zinc-600 mt-1.5 italic">Arrastra para reordenar. Top 5 aparecen destacados.</p>
              </div>
            </div>
          )}

          {/* ═══ RESEÑA TAB ═══ */}
          {activeTab === 'resena' && (
            <div className="space-y-6 animate-fade-in">
              {/* Rating */}
              <div>
                <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Calificación</span>
                <div className="flex flex-wrap gap-2">
                  {RATING_OPTIONS.map((opt) => {
                    const isSelected = tracking.rating === opt;
                    const label = opt.split(' ')[0];
                    return (
                      <button key={opt} onClick={() => handleInputChange('rating', opt)}
                        className={`flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                          isSelected 
                            ? 'bg-[rgb(var(--card-rgb)/0.15)] border-[rgb(var(--card-rgb)/0.6)] text-[rgb(var(--card-rgb))]' 
                            : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                        }`}>
                        <Star className={`w-3 h-3 ${isSelected ? 'fill-current' : ''}`} />
                        <span className="uppercase tracking-wide">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate Review */}
              <button onClick={handleGenerateReview} disabled={isGeneratingReview}
                className={`w-full py-3 bg-[rgb(var(--card-rgb))] hover:opacity-90 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  isGeneratingReview ? 'opacity-80 cursor-wait' : ''
                }`}>
                {isGeneratingReview ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> GENERANDO...</>
                ) : (
                  <><Wand2 className="w-4 h-4" /> CREAR RESEÑA CON IA</>
                )}
              </button>

              {/* Recommended By */}
              <div>
                <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Recomendado por</span>
                <input value={tracking.recommendedBy || ''} onChange={(e) => handleInputChange('recommendedBy', e.target.value, false)}
                  onBlur={() => !isEditing && onUpdate(localData)}
                  placeholder="Ej: Laura, r/anime..."
                  className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none focus:ring-white/20" />
              </div>

              {/* Emotional Tags */}
              <div>
                <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Tags Emocionales</span>
                <div className="flex flex-wrap gap-2">
                  {EMOTIONAL_TAGS_OPTIONS.map(tag => {
                    const isActive = (tracking.emotionalTags || []).includes(tag.label);
                    return (
                      <button key={tag.label} onClick={() => {
                        const currentTags = tracking.emotionalTags || [];
                        const newTags = isActive ? currentTags.filter(t => t !== tag.label) : [...currentTags, tag.label];
                        handleInputChange('emotionalTags', newTags);
                      }}
                        className={`flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          isActive 
                            ? 'bg-[rgb(var(--card-rgb)/0.1)] border-[rgb(var(--card-rgb)/0.4)] text-[rgb(var(--card-rgb))]' 
                            : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                        }`}>
                        <span className="text-sm">{tag.emoji}</span>
                        <span>{tag.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comment */}
              <div>
                <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" /> Comentario Final
                </span>
                <textarea value={tracking.comment} onChange={(e) => handleInputChange('comment', e.target.value, false)}
                  onBlur={() => !isEditing && onUpdate(localData)}
                  placeholder="Tus pensamientos finales sobre esta experiencia..."
                  className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl p-4 text-sm text-zinc-300 outline-none focus:ring-white/20 resize-none leading-relaxed min-h-[120px]" />
              </div>
            </div>
          )}
        </div>
      </div>

      {isEditing && <EditActionBar onSave={saveChanges} onCancel={cancelChanges} />}
    </div>
  );
};
