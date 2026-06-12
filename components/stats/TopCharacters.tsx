import React, { useRef, useCallback, useState } from 'react';
import { Camera, User, Crown } from 'lucide-react';
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

export const TopCharacters: React.FC<TopCharactersProps> = ({ library }) => {
  const updateItem = useLibraryStore(state => state.updateItem);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Collect top 1 character from each work
  const characters: CharacterEntry[] = library
    .filter(item => {
      const chars = item.trackingData.favoriteCharacters;
      return chars && chars.length > 0 && chars[0]?.name;
    })
    .map(item => ({
      mediaId: item.id,
      mediaTitle: item.aiData.title,
      coverImage: item.aiData.coverImage,
      primaryColor: item.aiData.primaryColor,
      character: item.trackingData.favoriteCharacters[0],
    }));

  const handleImageUpload = useCallback(async (mediaId: string, file: File) => {
    setUploadingId(mediaId);
    try {
      // Convert to base64 data URL
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        // Update the character image in the store
        const item = library.find(i => i.id === mediaId);
        if (item) {
          const updatedChars = [...item.trackingData.favoriteCharacters];
          updatedChars[0] = { ...updatedChars[0], image: base64 };
          await updateItem({ ...item, trackingData: { ...item.trackingData, favoriteCharacters: updatedChars } });
        }
        setUploadingId(null);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to upload character image:', err);
      setUploadingId(null);
    }
  }, [library, updateItem]);

  const triggerUpload = useCallback((mediaId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleImageUpload(mediaId, file);
    };
    input.click();
  }, [handleImageUpload]);

  if (characters.length === 0) {
    return null; // Don't show section if no characters
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
                className="relative flex-shrink-0 w-40 h-56 snap-start rounded-2xl overflow-hidden group cursor-pointer"
                onClick={() => !isUploading && triggerUpload(entry.mediaId)}
              >
                {/* Background: blurred cover */}
                <div className="absolute inset-0">
                  {entry.coverImage ? (
                    <img
                      src={entry.coverImage}
                      alt=""
                      className="w-full h-full object-cover scale-110 blur-xl brightness-50"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
                  )}
                  {/* Dark overlay for readability */}
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

                  {/* Upload indicator */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-1.5 bg-black/60 rounded-full backdrop-blur-sm">
                      <Camera className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>

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
    </div>
  );
};
