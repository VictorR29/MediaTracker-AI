import React, { useState, useEffect, useMemo } from 'react';
import { SearchBar } from './components/SearchBar';
import { MediaCard } from './components/MediaCard';
import { CompactMediaCard } from './components/CompactMediaCard';
import { Onboarding } from './components/Onboarding';
import { LibraryFilters, FilterState } from './components/LibraryFilters';
import { StatsView } from './components/StatsView';
import { searchMediaInfo } from './services/geminiService';
import { getLibrary, saveMediaItem, getUserProfile, saveUserProfile, initDB, deleteMediaItem } from './services/storage';
import { MediaItem, UserProfile } from './types';
import { LayoutGrid, Sparkles, PlusCircle, ArrowLeft, User, BarChart2, AlertCircle, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentMedia, setCurrentMedia] = useState<MediaItem | null>(null);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'search' | 'library' | 'details' | 'stats'>('search');
  const [dbReady, setDbReady] = useState(false);
  
  // Search Error State
  const [searchError, setSearchError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);

  // Filters State
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    type: 'All',
    status: 'All',
    rating: 'All',
    sortBy: 'updated'
  });

  // Initialize DB and load data
  useEffect(() => {
    const init = async () => {
      try {
        await initDB();
        const profile = await getUserProfile();
        const items = await getLibrary();
        
        if (profile) {
          // Ensure preferences exist with defaults if they were missing (migration)
          if (!profile.preferences) {
            profile.preferences = {
                animeEpisodeDuration: 24,
                mangaChapterDuration: 3,
                movieDuration: 90,
                bookChapterDuration: 15
            };
          } else {
             // Migration for existing preferences without new fields
             if (profile.preferences.movieDuration === undefined) profile.preferences.movieDuration = 90;
             if (profile.preferences.bookChapterDuration === undefined) profile.preferences.bookChapterDuration = 15;
          }
          setUserProfile(profile);
          applyTheme(profile.accentColor);
        }
        
        setLibrary(items);
        setDbReady(true);
        
        // If we have items and a profile, start in library view by default
        if (profile && items.length > 0) {
          setView('library');
        }
      } catch (err) {
        console.error("Initialization failed", err);
      }
    };
    init();
  }, []);

  const applyTheme = (colorValue: string) => {
    document.documentElement.style.setProperty('--color-primary', colorValue);
  };

  const handleOnboardingComplete = async (profile: UserProfile) => {
    // Set defaults on onboarding
    const profileWithPrefs = {
        ...profile,
        preferences: { 
            animeEpisodeDuration: 24, 
            mangaChapterDuration: 3,
            movieDuration: 90,
            bookChapterDuration: 15
        }
    };
    setUserProfile(profileWithPrefs);
    applyTheme(profile.accentColor);
    await saveUserProfile(profileWithPrefs);
  };

  const handleUpdateUserProfile = async (updatedProfile: UserProfile) => {
      setUserProfile(updatedProfile);
      applyTheme(updatedProfile.accentColor);
      await saveUserProfile(updatedProfile);
  };

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setCurrentMedia(null);
    setSearchError(null);
    setView('search');

    try {
      const aiData = await searchMediaInfo(query);
      
      // Check for soft failure/generic fallback
      if (aiData.synopsis.includes("No se pudo obtener información automática")) {
         setSearchError("No se encontraron resultados precisos. ¿Seguro que está bien escrito?");
         setIsLoading(false);
         return;
      }

      const newItem: MediaItem = {
        id: uuidv4(),
        aiData,
        createdAt: Date.now(),
        trackingData: {
          status: 'Viendo/Leyendo',
          currentSeason: 1,
          totalSeasons: 1, // Default assumption
          watchedEpisodes: 0,
          totalEpisodesInSeason: 12, // Default guess
          emotionalTags: [],
          favoriteCharacters: [],
          rating: '',
          comment: '',
          recommendedBy: ''
        }
      };

      setCurrentMedia(newItem);
    } catch (error) {
      console.error("Error searching media", error);
      setSearchError("Hubo un error de conexión buscando la información. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateMedia = async (updatedItem: MediaItem) => {
    setCurrentMedia(updatedItem);
    
    // Update local state
    const itemExists = library.some(i => i.id === updatedItem.id);
    if (itemExists) {
        setLibrary(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    }
    
    // Persist to DB if it's already in library or if we are actively saving it
    if (itemExists) {
       await saveMediaItem(updatedItem);
    }
  };

  // Delete Logic
  const handleDeleteRequest = (item: MediaItem) => {
      setDeleteTarget(item);
  };

  const confirmDelete = async () => {
      if (deleteTarget) {
          await deleteMediaItem(deleteTarget.id);
          setLibrary(prev => prev.filter(i => i.id !== deleteTarget.id));
          
          if (currentMedia?.id === deleteTarget.id) {
              setView('library');
              setCurrentMedia(null);
          }
          setDeleteTarget(null);
      }
  };

  const cancelDelete = () => {
      setDeleteTarget(null);
  };


  const handleQuickIncrement = async (item: MediaItem) => {
    const { trackingData, aiData } = item;
    const isSeries = ['Anime', 'Serie'].includes(aiData.mediaType);
    
    let updatedTracking = { ...trackingData };
    
    // Check if ready to complete season/series (Current watched >= Total)
    if (trackingData.totalEpisodesInSeason > 0 && trackingData.watchedEpisodes >= trackingData.totalEpisodesInSeason) {
        // Complete Logic
        if (isSeries) {
            // If it's the last season, complete the work
            if (trackingData.totalSeasons > 0 && trackingData.currentSeason >= trackingData.totalSeasons) {
                updatedTracking.status = 'Completado';
            } else {
                // Otherwise move to next season
                updatedTracking.currentSeason += 1;
                updatedTracking.watchedEpisodes = 0;
                updatedTracking.status = 'Viendo/Leyendo';
            }
        } else {
             // For reading or single season stuff, just mark complete
             updatedTracking.status = 'Completado';
        }
    } else {
        // Simple Increment
        updatedTracking.watchedEpisodes += 1;
    }

    const updatedItem = { ...item, trackingData: updatedTracking };
    
    // Update Library State
    setLibrary(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    
    // Persist
    await saveMediaItem(updatedItem);
    
    // Also update currentMedia if open (though this is mostly for library view)
    if (currentMedia && currentMedia.id === updatedItem.id) {
        setCurrentMedia(updatedItem);
    }
  };

  const addToLibrary = async () => {
    if (currentMedia && !library.find(i => i.id === currentMedia.id)) {
      const newLib = [currentMedia, ...library];
      setLibrary(newLib);
      await saveMediaItem(currentMedia);
    }
  };

  const openDetail = (item: MediaItem) => {
    setCurrentMedia(item);
    setView('details');
  };

  const backToLibrary = () => {
    setView('library');
    setCurrentMedia(null);
  };

  // Filter Logic
  const filteredLibrary = useMemo(() => {
    let result = [...library];

    // Filter by Query
    if (filters.query.trim()) {
      const q = filters.query.toLowerCase();
      result = result.filter(item => item.aiData.title.toLowerCase().includes(q));
    }

    // Filter by Type
    if (filters.type !== 'All') {
      result = result.filter(item => item.aiData.mediaType === filters.type);
    }

    // Filter by Status
    if (filters.status !== 'All') {
      result = result.filter(item => item.trackingData.status === filters.status);
    }

    // Filter by Rating
    if (filters.rating !== 'All') {
      result = result.filter(item => item.trackingData.rating === filters.rating);
    }

    // Sort
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'title':
          return a.aiData.title.localeCompare(b.aiData.title);
        case 'progress':
          const progA = a.trackingData.totalEpisodesInSeason > 0 
            ? (a.trackingData.watchedEpisodes / a.trackingData.totalEpisodesInSeason) 
            : 0;
          const progB = b.trackingData.totalEpisodesInSeason > 0 
            ? (b.trackingData.watchedEpisodes / b.trackingData.totalEpisodesInSeason) 
            : 0;
          return progB - progA;
        case 'updated':
        default:
          return b.createdAt - a.createdAt; 
      }
    });

    return result;
  }, [library, filters]);

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Sparkles className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-slate-200 font-sans selection:bg-primary selection:text-white pb-20">
      
      {!userProfile && <Onboarding onComplete={handleOnboardingComplete} />}

      {/* Header */}
      <header className="bg-surface/80 backdrop-blur-md border-b border-slate-700 sticky top-0 z-40 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView('library')}>
            <div className="w-8 h-8 bg-gradient-to-tr from-primary to-secondary rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden sm:block">
              MediaTracker AI
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2 mr-2">
              <button 
                onClick={() => setView('search')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'search' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Nuevo</span>
              </button>
              <button 
                onClick={() => setView('library')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'library' || view === 'details' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Biblioteca</span>
              </button>
              <button 
                onClick={() => setView('stats')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'stats' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
              >
                <BarChart2 className="w-4 h-4" />
                <span className="hidden sm:inline">Stats</span>
              </button>
            </nav>

            {userProfile && (
              <div className="flex items-center gap-2 pl-4 border-l border-slate-700">
                 <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
                    <User className="w-4 h-4 text-slate-400" />
                 </div>
                 <span className="text-sm font-medium text-slate-300 hidden sm:block">
                   {userProfile.username}
                 </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pt-8">
        
        {view === 'search' && (
          <div className="flex flex-col items-center">
            <div className="text-center mb-8 max-w-2xl">
               <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">¿Qué estás viendo hoy?</h2>
               <p className="text-slate-400">
                 Busca cualquier Anime, Serie o Manhwa.
               </p>
            </div>

            <SearchBar onSearch={handleSearch} isLoading={isLoading} />
            
            {/* Search Error Message */}
            {searchError && (
               <div className="animate-fade-in w-full max-w-md mx-auto mb-8 p-4 bg-red-900/20 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm font-medium">{searchError}</p>
               </div>
            )}

            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 animate-pulse">
                <Sparkles className="w-12 h-12 mb-4 text-primary opacity-50" />
                <p>Consultando a la IA y buscando datos en Google...</p>
              </div>
            )}

            {!isLoading && currentMedia && (
              <div className="w-full animate-fade-in-up">
                 <div className="flex justify-end mb-4 px-4 max-w-5xl mx-auto">
                    {!library.find(i => i.id === currentMedia.id) ? (
                       <button 
                         onClick={addToLibrary}
                         className="flex items-center gap-2 text-sm font-bold text-white transition-all bg-primary hover:bg-primary/90 px-6 py-2 rounded-full shadow-lg shadow-primary/25"
                       >
                         <PlusCircle className="w-4 h-4" />
                         Guardar en Biblioteca
                       </button>
                    ) : (
                      <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                        Guardado en Biblioteca
                      </span>
                    )}
                 </div>
                 <MediaCard 
                   item={currentMedia} 
                   onUpdate={handleUpdateMedia} 
                   isNew={true}
                 />
              </div>
            )}
          </div>
        )}

        {view === 'library' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6 border-l-4 border-primary pl-4">
               <h2 className="text-2xl font-bold text-white">Mi Colección</h2>
               {filteredLibrary.length > 0 && <span className="text-slate-400 text-sm bg-slate-800 px-2 py-1 rounded-md">{filteredLibrary.length} obras</span>}
            </div>
            
            {library.length > 0 && (
              <LibraryFilters filters={filters} onChange={setFilters} />
            )}

            {library.length === 0 ? (
              <div className="text-center py-20 bg-surface rounded-2xl border border-dashed border-slate-700">
                <LayoutGrid className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg mb-4">Tu biblioteca está vacía.</p>
                <button 
                  onClick={() => setView('search')}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-primary rounded-lg transition-colors"
                >
                  Buscar algo nuevo
                </button>
              </div>
            ) : filteredLibrary.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-slate-500">No hay resultados para estos filtros.</p>
                <button 
                  onClick={() => setFilters({query: '', type: 'All', status: 'All', rating: 'All', sortBy: 'updated'})}
                  className="mt-2 text-primary hover:underline"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 pb-10">
                {filteredLibrary.map((item) => (
                  <CompactMediaCard 
                    key={item.id} 
                    item={item} 
                    onClick={() => openDetail(item)}
                    onIncrement={handleQuickIncrement}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'stats' && userProfile && (
          <StatsView library={library} userProfile={userProfile} onUpdateProfile={handleUpdateUserProfile} />
        )}

        {view === 'details' && currentMedia && (
           <div className="animate-fade-in">
              <button 
                onClick={backToLibrary}
                className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 group px-4 py-2 hover:bg-slate-800 rounded-lg transition-colors w-fit"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                Volver a la Biblioteca
              </button>
              
              <MediaCard 
                   item={currentMedia} 
                   onUpdate={handleUpdateMedia} 
                   onDelete={library.find(i => i.id === currentMedia.id) ? () => handleDeleteRequest(currentMedia) : undefined}
              />
           </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 mt-10 text-center text-slate-600 text-sm py-8 border-t border-slate-800/50">
        <p>Potenciado por Gemini 2.5 Flash & Google Search Grounding</p>
      </footer>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-surface border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                  <div className="p-6 text-center">
                      <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Trash2 className="w-6 h-6 text-red-500" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">¿Eliminar esta obra?</h3>
                      <p className="text-slate-400 text-sm mb-6">
                          Estás a punto de borrar "{deleteTarget.aiData.title}" de tu biblioteca. 
                          <br/>Perderás todo tu progreso y notas.
                      </p>
                      <div className="flex gap-3">
                          <button 
                            onClick={cancelDelete}
                            className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 font-medium hover:bg-slate-700 transition-colors"
                          >
                              Cancelar
                          </button>
                          <button 
                            onClick={confirmDelete}
                            className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow-lg shadow-red-900/20 transition-colors"
                          >
                              Eliminar
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}