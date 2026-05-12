
import React, { useState, useEffect, useRef } from 'react';
import { MediaItem, UserTrackingData, AIWorkData } from '../types';
import { updateMediaInfo, generateReviewSummary } from '../services/geminiService';
import { computeNextSeason, createCustomLink, processImageToBase64, reorderCharacters } from '../services/mediaItemOperations';
import { useToast } from '../context/ToastContext';
import { IdentityColumn, NarrativeColumn, ReflectionColumn, EditActionBar } from './media-card';
import { extractColorFromImage, hexToRgb } from './media-card/colorUtils';

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
  const dynamicColor = aiData.primaryColor || '#6366f1';
  const dynamicRgb = hexToRgb(dynamicColor);

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

  const handleAddCharacter = () => {
    if (!newCharacterInput.trim()) return;
    const currentList = tracking.favoriteCharacters || [];
    handleInputChange('favoriteCharacters', [...currentList, newCharacterInput.trim()]);
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

  // Character Sort Handlers
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

  // Progress Calculations
  const progressPercent = tracking.totalEpisodesInSeason > 0
    ? Math.min(100, (tracking.watchedEpisodes / tracking.totalEpisodesInSeason) * 100)
    : 0;

  return (
    <div
      className="bg-surface/50 border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl animate-fade-in-up w-full"
      style={{ '--card-rgb': dynamicRgb } as React.CSSProperties}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] xl:grid-cols-[320px_1fr_320px] gap-0 lg:gap-8 xl:gap-10 p-6 md:p-8 xl:p-10">
        <IdentityColumn
          aiData={aiData}
          trackingData={tracking}
          isEditing={isEditing}
          isDragging={isDragging}
          dynamicColor={dynamicColor}
          dynamicRgb={dynamicRgb}
          onAIDataChange={handleAIDataChange}
          onInputChange={handleInputChange}
          onImageDrop={handleDrop}
          onImageClick={handleImageClick}
          onFileChange={handleFileChange}
          onRemoveGenre={handleRemoveGenre}
          onAddGenre={handleAddGenre}
          onRemoveCustomLink={handleRemoveCustomLink}
          onAddCustomLink={handleAddCustomLink}
          onToggleFavorite={() => handleInputChange('is_favorite', !tracking.is_favorite)}
          onDelete={onDelete}
          onToggleEdit={() => setIsEditing(true)}
          newGenreInput={newGenreInput}
          setNewGenreInput={setNewGenreInput}
          newLinkUrl={newLinkUrl}
          setNewLinkUrl={setNewLinkUrl}
          fileInputRef={fileInputRef}
        />
        <NarrativeColumn
          aiData={aiData}
          trackingData={tracking}
          isEditing={isEditing}
          dynamicColor={dynamicColor}
          dynamicRgb={dynamicRgb}
          username={username}
          onInputChange={handleInputChange}
          onAIDataChange={handleAIDataChange}
          onSmartUpdate={handleSmartUpdate}
          isUpdatingInfo={isUpdatingInfo}
          onNextSeason={handleNextSeason}
          newCharacterInput={newCharacterInput}
          setNewCharacterInput={setNewCharacterInput}
          onAddCharacter={handleAddCharacter}
          onCharDragStart={handleCharDragStart}
          onCharDragEnter={handleCharDragEnter}
          onCharDrop={handleCharDrop}
          progressPercent={progressPercent}
          onRemoveCharacter={handleRemoveCharacter}
        />
        <ReflectionColumn
          aiData={aiData}
          trackingData={tracking}
          isEditing={isEditing}
          dynamicColor={dynamicColor}
          dynamicRgb={dynamicRgb}
          onInputChange={handleInputChange}
          onAIDataChange={handleAIDataChange}
          onGenerateReview={handleGenerateReview}
          isGeneratingReview={isGeneratingReview}
          onUpdate={onUpdate}
          localData={localData}
        />
      </div>
      {isEditing && <EditActionBar onSave={saveChanges} onCancel={cancelChanges} />}
    </div>
  );
};
