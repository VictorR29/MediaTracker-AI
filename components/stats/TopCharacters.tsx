import React, { useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, User, Crown, Link, Upload, X } from 'lucide-react';
import { MediaItem } from '../../types';
import { useLibraryStore } from '../../stores/useLibraryStore';

interface TopCharactersProps {
  library: MediaItem[];
}

interface CharacterEntry {
  mediaId: string;
  mediaTitle: string;
  coverImage?: string;
  primaryColor?: string;
  character: { name: string; image?: string };
}

// Image compression helper (same as cover images)
const compressImage = (base64Str: string, maxWidth: number = 200, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const newBase64 = canvas.toDataURL('image/webp', quality);
        resolve(newBase64);
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

export const TopCharacters: React.FC<TopCharactersProps> = ({ library }) => {
  const updateItem = useLibraryStore(state => state.updateItem);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // Rating order for sorting
  const ratingOrder: Record<string, number> = {
    'God Tier': 1,
    'Excelente': 2,
    'Muy Bueno': 3,
    'Bueno': 4,
    'Regular': 5,
    'Malo': 6,
  };

  // Collect top 1 character from each work, sorted by rating
  const characters: CharacterEntry[] = library
    .filter(item => {
      const chars = item.trackingData.favoriteCharacters;
      return chars && chars.length > 0 && chars[0]?.name;
    })
    .sort((a, b) => (ratingOrder[a.trackingData.rating] || 99) - (ratingOrder[b.trackingData.rating] || 99))
    .map(item => ({
      mediaId: item.id,
      mediaTitle: item.aiData.title,
      coverImage: item.aiData.coverImage,
      primaryColor: item.aiData.primaryColor,
      character: item.trackingData.favoriteCharacters[0],
    }));

  const updateCharacterImage = useCallback(async (mediaId: string, imageUrl: string) => {
    setUploadingId(mediaId);
    try {
      // Compress image before saving (same as cover images)
      const compressed = await compressImage(imageUrl);
      const item = library.find(i => i.id === mediaId);
      if (item) {
        const updatedChars = [...item.trackingData.favoriteCharacters];
        updatedChars[0] = { ...updatedChars[0], image: compressed };
        await updateItem({ ...item, trackingData: { ...item.trackingData, favoriteCharacters: updatedChars } });
      }
    } catch (err) {
      console.error('Failed to update character image:', err);
    }
    setUploadingId(null);
    setEditingId(null);
    setUrlInput('');
  }, [library, updateItem]);

  const handleFileUpload = useCallback(async (mediaId: string, file: File) => {
    setUploadingId(mediaId);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        await updateCharacterImage(mediaId, base64);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to upload character image:', err);
      setUploadingId(null);
    }
  }, [updateCharacterImage]);

  const triggerFileUpload = useCallback((mediaId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFileUpload(mediaId, file);
    };
    input.click();
  }, [handleFileUpload]);

  const handleUrlSubmit = useCallback(() => {
    if (urlInput.trim() && editingId) {
      updateCharacterImage(editingId, urlInput.trim());
    }
  }, [urlInput, editingId, updateCharacterImage]);

  if (characters.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#111113] ring-1 ring-white/[0.06] p-1 rounded-2xl shadow-lg overflow-hidden">
      <div
        className="bg-[#18181B] rounded-[calc(1rem-0.25rem)] p-4 md:p-6"
        style={{ borderTop: '1px solid rgba(234, 179, 8, 0.3)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Crown
            className="w-4 h-4"
            style={{ color: '#eab308', filter: 'drop-shadow(0 0 6px rgba(234, 179, 8, 0.5))' }}
          />
          <span className="text-xs font-extrabold uppercase text-zinc-400" style={{ letterSpacing: '0.1em' }}>
            Top Personajes
          </span>
        </div>

        {/* Scrollable gallery */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {characters.map((entry) => {
            const isUploading = uploadingId === entry.mediaId;
            const hasImage = !!entry.character.image;
            const initial = entry.character.name.charAt(0).toUpperCase();

            return (
              <div
                key={entry.mediaId}
                className="relative flex-shrink-0 w-40 h-56 snap-start rounded-2xl overflow-hidden group"
              >
                {/* Background: blurred cover */}
                <div className="absolute inset-0">
                  {entry.coverImage ? (
                    <img
                      src={entry.coverImage}
                      alt=""
                      className="w-full h-full object-cover scale-110 blur-md brightness-50"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
                  )}
                  <div className="absolute inset-0 bg-black/40" />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center justify-center h-full p-3">
                  {/* Character profile */}
                  {hasImage ? (
                    <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/20 shadow-lg mb-3">
                      <img
                        src={entry.character.image}
                        alt={entry.character.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-white/10 ring-2 ring-white/20 shadow-lg flex items-center justify-center mb-3">
                      <span className="text-2xl font-bold text-white/80">{initial}</span>
                    </div>
                  )}

                  {/* Character name */}
                  <p className="text-sm font-bold text-white text-center truncate w-full px-1">
                    {entry.character.name}
                  </p>

                  {/* Work title */}
                  <p className="text-[10px] text-zinc-400 text-center truncate w-full px-1 mt-1">
                    {entry.mediaTitle}
                  </p>

                  {/* Upload button - always visible */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(entry.mediaId);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </button>

                  {/* Loading state */}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Image upload modal */}
      {editingId && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1C1C1F] rounded-2xl p-6 w-full max-w-sm ring-1 ring-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Imagen del Personaje</h3>
              <button
                onClick={() => { setEditingId(null); setUrlInput(''); }}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* File upload option */}
            <button
              onClick={() => {
                setEditingId(null);
                triggerFileUpload(editingId);
              }}
              className="w-full flex items-center gap-3 p-4 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl ring-1 ring-white/[0.08] transition-colors mb-3"
            >
              <div className="p-2 bg-violet-500/20 rounded-lg">
                <Upload className="w-5 h-5 text-violet-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">Subir archivo</p>
                <p className="text-xs text-zinc-400">JPG, PNG, GIF</p>
              </div>
            </button>

            {/* URL input option */}
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                  placeholder="https://..."
                  className="w-full bg-zinc-900 ring-1 ring-white/[0.06] rounded-xl pl-9 pr-4 py-3 text-sm text-white outline-none focus:ring-white/20 placeholder:text-zinc-600"
                />
              </div>
              <button
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
                className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl font-medium transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
