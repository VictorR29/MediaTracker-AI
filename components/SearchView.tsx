import React, { useState, useCallback, useEffect } from 'react';
import { PlusCircle, PenTool, Tv, Clapperboard, Film, BookOpen, Book, FileText, X, SearchX, RefreshCw } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useAuthStore } from '../stores/useAuthStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useUIStore } from '../stores/useUIStore';
import { MediaItem } from '../types';
import { searchMediaInfo } from '../services/geminiService';
import { SearchBar } from './SearchBar';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { MediaCard } from './MediaCard';

interface SearchViewProps {
  onOpenDetail: (item: MediaItem) => void;
  onSearchingChange?: (isSearching: boolean) => void;
}

const VARIANT_SUFFIXES = ['manhwa', 'webtoon', 'manga', String(new Date().getFullYear())];

export const SearchView: React.FC<SearchViewProps> = ({ onOpenDetail, onSearchingChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const userProfile = useAuthStore(s => s.userProfile);
  const addItem = useLibraryStore(s => s.addItem);
  const { isManualTypeSelectorOpen, setManualTypeSelectorOpen } = useUIStore();

  const [isSearching, setIsSearching] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [noResultBaseQuery, setNoResultBaseQuery] = useState<string | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const typeModalRef = useFocusTrap<HTMLDivElement>(isManualTypeSelectorOpen, () => setManualTypeSelectorOpen(false));

  // Consume navigation state from recommendation flow
  useEffect(() => {
    const state = location.state as { searchQuery?: string; searchType?: string; searchData?: any } | null;
    if (state?.searchData) {
      const tempItem: MediaItem = {
        id: 'preview',
        aiData: state.searchData,
        trackingData: {
          status: 'Sin empezar', currentSeason: 1, totalSeasons: 1,
          watchedEpisodes: 0, totalEpisodesInSeason: 0,
          emotionalTags: [], favoriteCharacters: [], rating: '', comment: ''
        },
        createdAt: Date.now()
      };
      setPreviewItem(tempItem);
      // Clear state so it doesn't re-trigger on back/forward
      navigate('/add', { replace: true, state: {} });
    } else if (state?.searchQuery && !state.searchData) {
      // searchMediaInfo failed in App.tsx — show no-result state
      setNoResultBaseQuery(state.searchQuery);
      navigate('/add', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const updateSearching = (v: boolean) => {
    setIsSearching(v);
    onSearchingChange?.(v);
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!userProfile?.apiKey) {
      showToast("Configura tu API Key primero", "error");
      return;
    }
    updateSearching(true);
    setPreviewItem(null);
    setNoResultBaseQuery(null);
    setVariantIndex(0);
    try {
      const data = await searchMediaInfo(query, userProfile.apiKey);
      if (!data) {
        setNoResultBaseQuery(query);
        return;
      }
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
      setNoResultBaseQuery(query);
    } finally {
      updateSearching(false);
    }
  }, [userProfile?.apiKey, showToast, onSearchingChange]);

  const handleRetryWithVariant = useCallback(async () => {
    if (!noResultBaseQuery) return;
    const suffix = VARIANT_SUFFIXES[variantIndex % VARIANT_SUFFIXES.length];
    setVariantIndex((variantIndex + 1) % VARIANT_SUFFIXES.length);
    if (!userProfile?.apiKey) return;
    updateSearching(true);
    setPreviewItem(null);
    try {
      const data = await searchMediaInfo(`${noResultBaseQuery} ${suffix}`, userProfile.apiKey);
      if (!data) {
        return;
      }
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
      // keep no-result state; user can try next variant
    } finally {
      updateSearching(false);
    }
  }, [noResultBaseQuery, variantIndex, userProfile?.apiKey, onSearchingChange]);

  const handleAddFromSearch = useCallback(async (itemToAdd: MediaItem) => {
    const newItem: MediaItem = {
      ...itemToAdd,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    await addItem(newItem);
    setPreviewItem(null);
    setNoResultBaseQuery(null);
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

  const showNoResult = !previewItem && !!noResultBaseQuery;

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
        ) : showNoResult ? (
          <div className="mt-8 animate-fade-in-up bg-zinc-900/40 border border-white/5 rounded-2xl p-6 text-center">
            <div className="flex justify-center mb-3">
              <div className="p-3 rounded-full bg-zinc-800/60 ring-1 ring-white/[0.06]">
                <SearchX className="w-6 h-6 text-zinc-400" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              No encontramos resultados para <span className="text-zinc-300">"{noResultBaseQuery}"</span>
            </h3>
            <p className="text-zinc-400 text-sm mb-6">
              Si es una obra coreana, china o japonesa, probá con su título original.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleRetryWithVariant}
                disabled={isSearching}
                className="px-5 py-3 bg-white hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-900 font-bold rounded-full shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.97]"
              >
                <RefreshCw className="w-4 h-4" />
                Buscar variantes
              </button>
              <button
                onClick={handleManualAdd}
                className="px-5 py-3 bg-zinc-800/50 hover:bg-zinc-800 text-white rounded-full font-bold transition-all ring-1 ring-white/[0.06] hover:ring-white/[0.12] flex items-center justify-center gap-2 group"
              >
                <PenTool className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                Agregar manualmente
              </button>
            </div>
            <p className="text-zinc-500 text-xs mt-4">
              Próxima búsqueda: "{noResultBaseQuery} {VARIANT_SUFFIXES[variantIndex % VARIANT_SUFFIXES.length]}"
            </p>
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
        <div ref={typeModalRef} role="dialog" aria-modal="true" aria-label="Crear obra manualmente" className="fixed inset-0 z-[100] bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
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
