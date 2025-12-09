

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SearchBar } from './components/SearchBar';
import { MediaCard } from './components/MediaCard';
import { CompactMediaCard } from './components/CompactMediaCard';
import { Onboarding } from './components/Onboarding';
import { LoginScreen } from './components/LoginScreen';
import { SettingsModal } from './components/SettingsModal';
import { LibraryFilters, FilterState } from './components/LibraryFilters';
import { StatsView } from './components/StatsView';
import { DiscoveryView } from './components/DiscoveryView'; // Import DiscoveryView
import { searchMediaInfo } from './services/geminiService';
import { getLibrary, saveMediaItem, getUserProfile, saveUserProfile, initDB, deleteMediaItem } from './services/storage';
import { MediaItem, UserProfile } from './types';
import { LayoutGrid, Sparkles, PlusCircle, ArrowLeft, User, BarChart2, AlertCircle, Trash2, Download, Upload, ChevronDown, Settings, Compass, CalendarClock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentMedia, setCurrentMedia] = useState<MediaItem | null>(null);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'search' | 'library' | 'details' | 'stats' | 'discovery' | 'upcoming'>('search');
  const [dbReady, setDbReady] = useState(false);
  
  // App Lock State
  const [isLocked, setIsLocked] = useState(false);

  // User Menu State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Search State
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState(0); // Used to reset search bar

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
          // Check for migration or missing prefs
          if (!profile.preferences) {
            profile.preferences = {
                animeEpisodeDuration: 24,
                seriesEpisodeDuration: 45,
                mangaChapterDuration: 3,
                movieDuration: 90,
                bookChapterDuration: 15
            };
          } else {
             if (profile.preferences.movieDuration === undefined) profile.preferences.movieDuration = 90;
             if (profile.preferences.bookChapterDuration === undefined) profile.preferences.bookChapterDuration = 15;
             if (profile.preferences.seriesEpisodeDuration === undefined) profile.preferences.seriesEpisodeDuration = 45;
          }

          // Check for missing apiKey (migration from old version)
          if (!profile.apiKey) {
              profile.apiKey = ""; // Will prompt user or fail gracefully
          }

          setUserProfile(profile);
          applyTheme(profile.accentColor);

          // Lock if password exists
          if (profile.password) {
              setIsLocked(true);
          }
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
            seriesEpisodeDuration: 45,
            mangaChapterDuration: 3,
            movieDuration: 90,
            bookChapterDuration: 15
        }
    };
    setUserProfile(profileWithPrefs);
    applyTheme(profile.accentColor);
    await saveUserProfile(profileWithPrefs);
  };

  const handleUnlock = (passwordAttempt: string) => {
      if (userProfile && userProfile.password === passwordAttempt) {
          setIsLocked(false);
          return true;
      }
      return false;
  };

  const handleUpdateUserProfile = async (updatedProfile: UserProfile) => {
      setUserProfile(updatedProfile);
      applyTheme(updatedProfile.accentColor);
      await saveUserProfile(updatedProfile);
  };

  const handleSearch = async (query: string) => {
    if (!userProfile?.apiKey) {
        setSearchError("No tienes una API Key configurada. Ve a Configuración.");
        return;
    }

    setIsLoading(true);
    setCurrentMedia(null);
    setSearchError(null);
    setView('search');

    try {
      const aiData = await searchMediaInfo(query, userProfile.apiKey);
      
      // Check for soft failure/generic fallback
      if (aiData.synopsis.includes("No se pudo obtener información automática")) {
         setSearchError(aiData.synopsis); // Use the message returned by service
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
          totalSeasons: 1, 
          watchedEpisodes: 0,
          totalEpisodesInSeason: aiData.mediaType === 'Pelicula' ? 1 : 12, 
          emotionalTags: [],
          favoriteCharacters: [],
          rating: '',
          comment: '',
          recommendedBy: '',
          isSaga: false,
          finishedAt: undefined
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
    const itemExists = library.some(i => i.id === updatedItem.id);
    if (itemExists) {
        setLibrary(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    }
    if (itemExists) {
       await saveMediaItem(updatedItem);
    }
  };

  const handleDeleteRequest = (item: MediaItem) => setDeleteTarget(item);

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

  const cancelDelete = () => setDeleteTarget(null);

  const handleQuickIncrement = async (item: MediaItem) => {
    const { trackingData, aiData } = item;
    const isSeries = ['Anime', 'Serie'].includes(aiData.mediaType);
    const isBookSaga = aiData.mediaType === 'Libro' && trackingData.isSaga;
    const isMovie = aiData.mediaType === 'Pelicula';

    // No quick increment for movies from card
    if (isMovie) return;

    let updatedTracking = { ...trackingData };
    
    // Logic for Series and Book Sagas
    if (trackingData.totalEpisodesInSeason > 0 && trackingData.watchedEpisodes >= trackingData.totalEpisodesInSeason) {
        if (isSeries || isBookSaga) {
            if (trackingData.totalSeasons > 0 && trackingData.currentSeason >= trackingData.totalSeasons) {
                updatedTracking.status = 'Completado';
            } else {
                updatedTracking.currentSeason += 1;
                updatedTracking.watchedEpisodes = 0;
                updatedTracking.status = 'Viendo/Leyendo';
            }
        } else {
             updatedTracking.status = 'Completado';
        }
    } else {
        updatedTracking.watchedEpisodes += 1;
    }

    const updatedItem = { ...item, trackingData: updatedTracking };
    setLibrary(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    await saveMediaItem(updatedItem);
    if (currentMedia && currentMedia.id === updatedItem.id) setCurrentMedia(updatedItem);
  };

  const addToLibrary = async () => {
    if (currentMedia && !library.find(i => i.id === currentMedia.id)) {
      const newLib = [currentMedia, ...library];
      setLibrary(newLib);
      await saveMediaItem(currentMedia);
      
      // Clear the search view and reset the search bar
      setCurrentMedia(null);
      setSearchKey(prev => prev + 1);
    }
  };

  const openDetail = (item: MediaItem) => {
    setCurrentMedia(item);
    setView('details');
  };

  // --- DATA MANAGEMENT ---
  const handleExportData = () => {
    if (!userProfile) return;
    const data = {
        profile: userProfile,
        library: library,
        version: 1,
        exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mediatracker_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportData = (file: File) => {
    console.log("Starting import for file:", file.name);
    
    // Validate file type (basic check)
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        alert("El archivo debe ser un JSON (.json)");
        return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
        console.error("Reader error", reader.error);
        alert("Error de lectura del archivo.");
    };

    reader.onload = async (event) => {
        console.log("File read complete. Processing...");
        try {
            const content = event.target?.result;
            if (typeof content !== 'string') {
                console.error("Content is not string", content);
                alert("El contenido del archivo no es válido.");
                return;
            }

            const data = JSON.parse(content);
            console.log("JSON Parsed:", data);

            if (!data.profile || !Array.isArray(data.library)) {
                console.error("Invalid structure", data);
                alert("El archivo no tiene el formato de respaldo correcto (falta perfil o biblioteca).");
                return;
            }

            // Proceed directly with import without window.confirm blocking
            setIsLoading(true);
            
            try {
                console.log("Saving profile...");
                await saveUserProfile(data.profile);
                
                console.log("Saving library items...");
                // Batch save library
                for (const item of data.library) {
                    await saveMediaItem(item);
                }
                
                // State updates
                setUserProfile(data.profile);
                applyTheme(data.profile.accentColor);
                
                const updatedLibrary = await getLibrary();
                setLibrary(updatedLibrary);
                
                // UI Clean up
                setIsLoading(false);
                setIsUserMenuOpen(false);
                setIsSettingsOpen(false);
                
                console.log("Import success.");
                alert("¡Datos importados correctamente! Bienvenido, " + data.profile.username);

            } catch (saveError) {
                console.error("Save error during import", saveError);
                alert("Ocurrió un error guardando los datos en la base de datos local.");
                setIsLoading(false);
            }

        } catch (error) {
            console.error("Critical import error / JSON Parse", error);
            alert("Error crítico: El archivo está corrupto o no es un JSON válido.");
            setIsLoading(false);
        }
    };
    
    // Trigger reading
    reader.readAsText(file);
  };


  // Filter Logic for Main Library
  const filteredLibrary = useMemo(() => {
    let result = [...library];
    if (filters.query.trim()) {
      const q = filters.query.toLowerCase();
      result = result.filter(item => item.aiData.title.toLowerCase().includes(q));
    }
    if (filters.type !== 'All') result = result.filter(item => item.aiData.mediaType === filters.type);
    if (filters.status !== 'All') result = result.filter(item => item.trackingData.status === filters.status);
    if (filters.rating !== 'All') result = result.filter(item => item.trackingData.rating === filters.rating);

    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'title': return a.aiData.title.localeCompare(b.aiData.title);
        case 'progress':
          const progA = a.trackingData.totalEpisodesInSeason > 0 ? (a.trackingData.watchedEpisodes / a.trackingData.totalEpisodesInSeason) : 0;
          const progB = b.trackingData.totalEpisodesInSeason > 0 ? (b.trackingData.watchedEpisodes / b.trackingData.totalEpisodesInSeason) : 0;
          return progB - progA;
        case 'updated': default: return b.createdAt - a.createdAt; 
      }
    });
    return result;
  }, [library, filters]);

  // Filter Logic for Upcoming Releases
  const upcomingLibrary = useMemo(() => {
     const now = new Date();
     return library.filter(item => {
         const isPlanned = item.trackingData.status === 'Planeado / Pendiente';
         if (!isPlanned) return false;
         
         const releaseStr = item.aiData.releaseDate;
         if (!releaseStr) return false;

         const releaseDate = new Date(releaseStr);
         // Check if valid date and if it is in the future
         return !isNaN(releaseDate.getTime()) && releaseDate > now;
     }).sort((a, b) => {
         // Sort by nearest release date first
         const dateA = new Date(a.aiData.releaseDate || '');
         const dateB = new Date(b.aiData.releaseDate || '');
         return dateA.getTime() - dateB.getTime();
     });
  }, [library]);

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Sparkles className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  // --- RENDER GATES ---

  if (!userProfile) {
      return (
        <Onboarding 
            onComplete={handleOnboardingComplete} 
            onImport={handleImportData} // Pass import function to onboarding
        />
      );
  }

  if (isLocked) {
      return <LoginScreen onUnlock={handleUnlock} />;
  }

  return (
    <div className="min-h-screen bg-background text-slate-200 font-sans selection:bg-primary selection:text-white flex flex-col">
      
      {/* Settings Modal */}
      <SettingsModal 
         isOpen={isSettingsOpen} 
         onClose={() => setIsSettingsOpen(false)} 
         userProfile={userProfile}
         onUpdateProfile={handleUpdateUserProfile}
         onExportData={handleExportData}
         onImportData={handleImportData}
      />

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
                onClick={() => {
                    setView('search');
                    // Reset search state when clicking 'New' to avoid stale data
                    setCurrentMedia(null);
                    setSearchKey(prev => prev + 1);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'search' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
                title="Nuevo"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Nuevo</span>
              </button>
              <button 
                onClick={() => setView('library')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'library' || view === 'details' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
                title="Biblioteca"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Biblioteca</span>
              </button>
              <button 
                onClick={() => setView('upcoming')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'upcoming' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
                title="Próximos Estrenos"
              >
                <CalendarClock className="w-4 h-4" />
                <span className="hidden sm:inline">Wishlist</span>
              </button>
              <button 
                onClick={() => setView('discovery')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'discovery' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
                title="Descubrir"
              >
                <Compass className="w-4 h-4" />
                <span className="hidden sm:inline">Descubrir</span>
              </button>
              <button 
                onClick={() => setView('stats')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'stats' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
                title="Estadísticas"
              >
                <BarChart2 className="w-4 h-4" />
                <span className="hidden sm:inline">Stats</span>
              </button>
            </nav>

            <div className="relative pl-4 border-l border-slate-700 ml-2">
                 <button 
                   onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                   className="flex items-center gap-2 hover:bg-slate-800 p-1.5 pr-3 rounded-full transition-colors group"
                 >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center border border-slate-500 group-hover:border-primary transition-colors shadow-sm">
                        <User className="w-4 h-4 text-slate-300" />
                    </div>
                    <span className="text-sm font-medium text-slate-300 hidden sm:block group-hover:text-white transition-colors">
                      {userProfile.username}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                 </button>

                 {/* Dropdown Menu */}
                 {isUserMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                        <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in py-1">
                            <div className="px-4 py-3 border-b border-slate-700/50">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Mi Cuenta</p>
                            </div>
                            <button 
                                onClick={() => { setIsSettingsOpen(true); setIsUserMenuOpen(false); }}
                                className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white flex items-center gap-2 transition-colors"
                            >
                                <Settings className="w-4 h-4" />
                                Configuración
                            </button>
                            <div className="border-t border-slate-700/50 my-1"></div>
                            <button 
                                onClick={handleExportData}
                                className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white flex items-center gap-2 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Exportar Datos
                            </button>
                        </div>
                    </>
                 )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pt-8 w-full flex-grow pb-8">
        
        {view === 'search' && (
          <div className="flex flex-col items-center">
            <div className="text-center mb-8 max-w-2xl">
               <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">¿Qué estás viendo hoy?</h2>
               <p className="text-slate-400">
                 Busca cualquier Anime, Serie, Película o Libro para añadir a tu biblioteca.
               </p>
            </div>

            <SearchBar 
                key={searchKey} 
                onSearch={handleSearch} 
                isLoading={isLoading} 
            />
            
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
                <p>Consultando a la IA y analizando contenido...</p>
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

        {view === 'upcoming' && (
          <div className="animate-fade-in">
             <div className="flex items-center gap-3 mb-6 border-l-4 border-yellow-500 pl-4">
                 <h2 className="text-2xl font-bold text-white">Próximos Estrenos / Wishlist</h2>
                 <CalendarClock className="w-5 h-5 text-yellow-500" />
                 {upcomingLibrary.length > 0 && <span className="text-slate-400 text-sm bg-slate-800 px-2 py-1 rounded-md">{upcomingLibrary.length} pendientes</span>}
             </div>

             {upcomingLibrary.length === 0 ? (
                <div className="text-center py-20 bg-surface rounded-2xl border border-dashed border-slate-700">
                    <CalendarClock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg mb-4">No tienes estrenos futuros en seguimiento.</p>
                    <p className="text-sm text-slate-500 mb-6">Añade obras y márcalas como 'Planeado / Pendiente' para verlas aquí.</p>
                    <button 
                        onClick={() => setView('search')}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-primary rounded-lg transition-colors"
                    >
                        Buscar Estrenos
                    </button>
                </div>
             ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 pb-10">
                    {upcomingLibrary.map((item) => (
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

        {view === 'discovery' && userProfile && (
           <DiscoveryView 
              library={library} 
              apiKey={userProfile.apiKey} 
              onSelectRecommendation={handleSearch}
           />
        )}

        {view === 'stats' && userProfile && (
          <StatsView library={library} userProfile={userProfile} onUpdateProfile={handleUpdateUserProfile} />
        )}

        {view === 'details' && currentMedia && (
           <div className="animate-fade-in">
              <button 
                onClick={() => setView('library')}
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
      <footer className="w-full bg-surface border-t border-slate-800 py-6 text-center text-slate-600 text-sm mt-auto">
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