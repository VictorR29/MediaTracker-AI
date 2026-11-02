import React, { useCallback, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Crown, Shuffle, ArrowRight } from 'lucide-react';
import { MediaItem } from '../../types';
import { getGenres } from '../../utils/genres';
import { compressImage } from '../../utils/imageCompression';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useToast } from '../../context/ToastContext';
import { CharacterImageModal } from '../CharacterImageModal';
import { applyCharacterImage, pickImageFile, readFileAsDataUrl } from '../../services/characterImage';

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

// Single character card (reused in both rows)
const CharacterCard: React.FC<{
  entry: CharacterEntry;
  onEdit: (target: { mediaId: string; characterName: string }) => void;
  isUploading: boolean;
}> = ({ entry, onEdit, isUploading }) => {
  const hasImage = !!entry.character.image;
  const initial = entry.character.name.charAt(0).toUpperCase();

  return (
    <div className="relative flex-shrink-0 w-32 h-44 rounded-2xl overflow-hidden group">
      {/* Background: blurred cover */}
      <div className="absolute inset-0">
        {entry.coverImage ? (
          <img src={entry.coverImage} alt="" className="w-full h-full object-cover scale-110 blur-md brightness-50" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
        )}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-2">
        {hasImage ? (
          <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/20 shadow-lg mb-2">
            <img src={entry.character.image} alt={entry.character.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-white/10 ring-2 ring-white/20 shadow-lg flex items-center justify-center mb-2">
            <span className="text-xl font-bold text-white/80">{initial}</span>
          </div>
        )}
        <p className="text-xs font-bold text-white text-center truncate w-full px-1">{entry.character.name}</p>
        <p className="text-[10px] text-zinc-400 text-center truncate w-full px-1 mt-0.5">{entry.mediaTitle}</p>

        <button
          onClick={(e) => { e.stopPropagation(); onEdit({ mediaId: entry.mediaId, characterName: entry.character.name }); }}
                    aria-label={`Cambiar imagen de ${entry.character.name}`}
          className="absolute top-1.5 right-1.5 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center bg-black/60 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors"
        >
          <Camera className="w-3 h-3 text-white" />
        </button>

        {isUploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export const TopCharacters: React.FC<TopCharactersProps> = ({ library }) => {
  const updateItem = useLibraryStore(state => state.updateItem);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  // The character name travels with the work id: a work can hold several
  // favourites and the write must reach the one whose card was opened.
  const [editing, setEditing] = useState<{ mediaId: string; characterName: string } | null>(null);
  const [activeGenre, setActiveGenre] = useState<string>('Todos');

  const genres = useMemo(() => {
    const genreSet = new Set<string>();
    library.forEach(item => getGenres(item).forEach(g => genreSet.add(g)));
    return ['Todos', ...Array.from(genreSet).sort()];
  }, [library]);

  const baseCharacters: CharacterEntry[] = library
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

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const [shuffledChars, setShuffledChars] = useState<CharacterEntry[]>([]);

  const characters = useMemo(() => {
    const base = shuffledChars.length > 0 ? shuffledChars : baseCharacters;
    if (activeGenre === 'Todos') return base;
    return base.filter(c => {
      const item = library.find(i => i.id === c.mediaId);
      return item ? getGenres(item).includes(activeGenre) : false;
    });
  }, [shuffledChars, baseCharacters, activeGenre, library]);

  // Split into two rows
  const row1 = useMemo(() => characters.filter((_, i) => i % 2 === 0), [characters]);
  const row2 = useMemo(() => characters.filter((_, i) => i % 2 === 1), [characters]);

  const handleShuffle = () => {
    setShuffledChars(shuffleArray(baseCharacters));
  };

  const updateCharacterImage = useCallback(async (
    target: { mediaId: string; characterName: string },
    imageUrl: string,
  ) => {
    setUploadingId(target.mediaId);
    try {
      const compressed = await compressImage(imageUrl, 200);
      const item = library.find(i => i.id === target.mediaId);
      const updated = item ? applyCharacterImage(item, target.characterName, compressed) : null;

      if (updated) {
        await updateItem(updated);
        showToast("Imagen del personaje actualizada", "success");
      } else {
        // The character left the work while the dialog was open. Writing at any
        // index would put the photo on someone else.
        showToast("Ese personaje ya no está en la obra", "error");
      }
    } catch (err) {
      console.error('Failed to update character image:', err);
      showToast("Error al guardar imagen", "error");
    }
    setUploadingId(null);
    setEditing(null);
  }, [library, updateItem, showToast]);

  const uploadCharacterFile = useCallback(async (
    target: { mediaId: string; characterName: string },
    file: File,
  ) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await updateCharacterImage(target, dataUrl);
    } catch (err) {
      console.error('Failed to read character image:', err);
      setUploadingId(null);
      showToast("No se pudo leer la imagen", "error");
    }
  }, [updateCharacterImage, showToast]);

  const hasNoGenreMatch = characters.length === 0 && baseCharacters.length > 0;

  // Calculate animation duration based on card count (slower = smoother)
  const getDuration = (count: number) => Math.max(12, count * 2.2);

  return (
    <>
      <style>{`
        @keyframes marquee-right {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-left {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .marquee-row:hover {
          animation-play-state: paused !important;
        }
      `}</style>

      <div className="bg-[#111113] ring-1 ring-white/[0.06] p-1 rounded-2xl shadow-lg overflow-hidden">
        <div
          className="bg-[#18181B] rounded-[calc(1rem-0.25rem)] p-4 md:p-6"
          style={{ borderTop: '1px solid rgba(234, 179, 8, 0.3)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4" style={{ color: '#eab308', filter: 'drop-shadow(0 0 6px rgba(234, 179, 8, 0.5))' }} />
              <span className="text-xs font-extrabold uppercase text-zinc-400" style={{ letterSpacing: '0.1em' }}>Top Personajes</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate('/characters')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase text-yellow-400/70 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all"
              >
                Ver Colección <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={handleShuffle}
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                title="Reordenar"
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Genre filter */}
          {genres.length > 2 && (
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-4" style={{ scrollbarWidth: 'none' }}>
              {genres.map(genre => (
                <button
                  key={genre}
                  onClick={() => setActiveGenre(genre)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                    activeGenre === genre
                      ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40'
                      : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          )}

          {/* Two-row marquee carousel */}
          {hasNoGenreMatch ? (
            <div className="py-8 text-center">
              <p className="text-zinc-500 text-xs">No hay personajes en este género</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-hidden">
              {/* Row 1 — scrolls right */}
              {row1.length > 0 && (
                <div className="overflow-hidden">
                  <div
                    className="marquee-row flex gap-3 w-max"
                    style={{
                      animation: `marquee-right ${getDuration(row1.length)}s linear infinite`,
                    }}
                  >
                    {[...row1, ...row1].map((entry, idx) => (
                      <CharacterCard
                        key={`r1-${entry.mediaId}-${idx}`}
                        entry={entry}
                        onEdit={setEditing}
                        isUploading={uploadingId === entry.mediaId}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Row 2 — scrolls left */}
              {row2.length > 0 && (
                <div className="overflow-hidden">
                  <div
                    className="marquee-row flex gap-3 w-max"
                    style={{
                      animation: `marquee-left ${getDuration(row2.length)}s linear infinite`,
                    }}
                  >
                    {[...row2, ...row2].map((entry, idx) => (
                      <CharacterCard
                        key={`r2-${entry.mediaId}-${idx}`}
                        entry={entry}
                        onEdit={setEditing}
                        isUploading={uploadingId === entry.mediaId}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <CharacterImageModal
          characterName={editing?.characterName ?? null}
          workTitle={editing ? library.find(i => i.id === editing.mediaId)?.aiData.title : undefined}
          onClose={() => setEditing(null)}
          onSaveUrl={(url) => { if (editing) updateCharacterImage(editing, url); }}
          onPickFile={() => { if (editing) pickImageFile((file) => uploadCharacterFile(editing, file)); }}
        />
      </div>
    </>
  );
};
