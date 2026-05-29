import React, { useState, useCallback } from 'react';
import { PlusCircle, PenTool, Tv, Clapperboard, Film, BookOpen, Book, FileText, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useAuthStore } from '../stores/useAuthStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useUIStore } from '../stores/useUIStore';
import { MediaItem } from '../types';
import { searchMediaInfo } from '../services/geminiService';
import { SearchBar } from './SearchBar';
import { MediaCard } from './MediaCard';

interface SearchViewProps {
  onOpenDetail: (item: MediaItem) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onOpenDetail }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const userProfile = useAuthStore(s => s.userProfile);
  const addItem = useLibraryStore(s => s.addItem);
  const { isManualTypeSelectorOpen, setManualTypeSelectorOpen } = useUIStore();

  const [isSearching, setIsSearching] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    if (!userProfile?.apiKey) {
      showToast("Configura tu API Key primero", "error");
      return;
    }
    setIsSearching(true);
    setPreviewItem(null);
    try {
      const data = await searchMediaInfo(query, userProfile.apiKey);
      const tempItem: MediaItem = {
        id: 'preview',
        aiData: data,
        trackingData: {
          status: 'Sin empezar', currentSeason: 1, totalSeasons: 1,
          watchedEpisodes: 0, totalEpisodesInSeason: 0,
          emotionalTags: [], favoriteCharacters: [], rating: '', comment: ''
        },
        createdAt: Date.now()
      };
      setPreviewItem(tempItem);
    } catch (e) {
      showToast("Error en la búsqueda", "error");
    } finally {
      setIsSearching(false);
    }
  }, [userProfile?.apiKey, showToast]);

  const handleAddFromSearch = useCallback(async (itemToAdd: MediaItem) => {
    const newItem: MediaItem = {
      ...itemToAdd,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    await addItem(newItem);
    setPreviewItem(null);
    showToast("Añadido a la biblioteca", "success");
    onOpenDetail(newItem);
  }, [addItem, showToast, onOpenDetail]);

  const handleManualAdd = () => {
    setManualTypeSelectorOpen(true);
  };

  const handleManualTypeSelection = (type: string) => {
    setManualTypeSelectorOpen(false);
    const isMovie = type === 'Pelicula';
    const newItem: MediaItem = {
      id: Date.now().toString(),
      aiData: {
        title: '',
        mediaType: type as any,
        synopsis: '',
        genres: [],
        status: 'Sin empezar',
        totalContent: '',
        coverDescription: '',
        sourceUrls: [],
        primaryColor: '#c084fc'
      },
      trackingData: {
        status: 'Sin empezar',
        currentSeason: isMovie ? 0 : 1,
        totalSeasons: isMovie ? 0 : 1,
        watchedEpisodes: 0,
        totalEpisodesInSeason: 0,
        emotionalTags: [],
        favoriteCharacters: [],
        rating: '',
        comment: ''
      },
      createdAt: Date.now()
    };
    onOpenDetail(newItem);
  };

  return (
    <>
      <div className={`animate-fade-in pt-4 ${previewItem ? 'w-full' : 'max-w-2xl mx-auto'}`}>
        <div className={`mb-6 ${previewItem ? 'max-w-2xl mx-auto' : ''}`}>
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-white" />
            Añadir Obra
          </h2>
          <p className="text-zinc-400 text-sm mb-4">Busca información automática con IA o crea una entrada vacía.</p>

          <SearchBar
            onSearch={handleSearch}
            isLoading={isSearching}
            placeholder="Ej: Solo Leveling, Inception, Breaking Bad..."
          />
        </div>

        {previewItem ? (
          <div className="mt-8 animate-fade-in-up">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 text-center">Resultado de la Búsqueda</h3>
            <MediaCard
              item={previewItem}
              onUpdate={(updated) => setPreviewItem(updated)}
              isNew={true}
              onDelete={() => setPreviewItem(null)}
            />
            <div className="flex gap-3 mt-6 max-w-2xl mx-auto">
              <button
                onClick={() => setPreviewItem(null)}
                  className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-full transition-all ring-1 ring-white/[0.06]"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleAddFromSearch(previewItem)}
                className="flex-[2] py-4 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-full shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.97]"
              >
                <PlusCircle className="w-5 h-5" /> AÑADIR A BIBLIOTECA
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-12 text-center border-t border-zinc-800 pt-8">
            <p className="text-zinc-500 mb-4 text-sm font-medium">¿No encuentras lo que buscas o prefieres rellenarlo tú?</p>
            <button
              onClick={handleManualAdd}
              className="px-6 py-3 bg-zinc-800/50 hover:bg-zinc-800 text-white rounded-full font-bold transition-all ring-1 ring-white/[0.06] hover:ring-white/[0.12] flex items-center justify-center gap-2 mx-auto group"
            >
              <PenTool className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
              Crear Obra Manualmente
            </button>
          </div>
        )}
      </div>

      {/* Manual Type Selector Modal */}
      {isManualTypeSelectorOpen && (
        <div className="fixed inset-0 z-[100] bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#111113] ring-1 ring-white/[0.06] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
        <div className="p-6 ring-1 ring-white/[0.06] ring-b flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <PenTool className="w-5 h-5 text-white" />
                Crear Obra Manualmente
              </h3>
              <button
                onClick={() => setManualTypeSelectorOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-zinc-400 mb-6 text-center">
                Selecciona el tipo de obra para configurar la plantilla correcta.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
  { id: 'Anime', icon: Tv, color: 'text-violet-400', border: 'hover:ring-violet-500/50 hover:bg-violet-500/10' },
          { id: 'Serie', icon: Clapperboard, color: 'text-purple-400', border: 'hover:ring-purple-500/50 hover:bg-purple-500/10' },
          { id: 'Pelicula', icon: Film, color: 'text-pink-400', border: 'hover:ring-pink-500/50 hover:bg-pink-500/10' },
          { id: 'Libro', icon: Book, color: 'text-emerald-400', border: 'hover:ring-emerald-500/50 hover:bg-emerald-500/10' },
          { id: 'Manhwa', icon: BookOpen, color: 'text-orange-400', border: 'hover:ring-orange-500/50 hover:bg-orange-500/10' },
          { id: 'Manga', icon: BookOpen, color: 'text-orange-400', border: 'hover:ring-orange-500/50 hover:bg-orange-500/10' },
          { id: 'Comic', icon: BookOpen, color: 'text-yellow-400', border: 'hover:ring-yellow-500/50 hover:bg-yellow-500/10' },
          { id: 'Otro', icon: FileText, color: 'text-zinc-400', border: 'hover:ring-zinc-500/50 hover:bg-zinc-500/10' },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleManualTypeSelection(type.id)}
                    className={`flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-zinc-900 ring-1 ring-white/[0.06] transition-all group ${type.border}`}
                  >
                    <div className={`p-3 rounded-full bg-zinc-800 group-hover:bg-zinc-800/50 transition-colors ${type.color}`}>
                      <type.icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 group-hover:text-white">
                      {type.id === 'Pelicula' ? 'Película' : type.id}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
