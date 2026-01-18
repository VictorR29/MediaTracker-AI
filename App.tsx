
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutGrid, Bookmark, PlusCircle, Compass, BarChart2, 
  Search as SearchIcon, LogOut, Settings, User, PenTool, AlertTriangle, Trash2
} from 'lucide-react';
import { useToast } from './context/ToastContext';
import { MediaItem, UserProfile, AIWorkData } from './types';
import { 
  saveUserProfile, getUserProfile, saveMediaItem, getLibrary, deleteMediaItem, clearLibrary 
} from './services/storage';
import { searchMediaInfo } from './services/geminiService';

import { LoginScreen } from './components/LoginScreen';
import { Onboarding } from './components/Onboarding';
import { LibraryFilters, FilterState } from './components/LibraryFilters';
import { MediaCard } from './components/MediaCard';
import { CompactMediaCard } from './components/CompactMediaCard';
import { StatsView } from './components/StatsView';
import { DiscoveryView } from './components/DiscoveryView';
import { SettingsModal } from './components/SettingsModal';
import { CatalogView } from './components/CatalogView';
import { SearchBar } from './components/SearchBar';
import { ContextualGreeting } from './components/ContextualGreeting';
import { LoadingOverlay } from './components/LoadingOverlay';

const App: React.FC = () => {
  const { showToast } = useToast();
  
  // App State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation State
  const [view, setView] = useState<'library' | 'details' | 'search' | 'discovery' | 'stats' | 'upcoming'>('library');
  const [searchKey, setSearchKey] = useState(0); // Used to reset search view
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  
  // UI State
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [libraryViewMode, setLibraryViewMode] = useState<'grid' | 'catalog'>('grid');
  const lastScrollY = useRef(0);

  // Search State
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<AIWorkData | null>(null);

  // Restore State
  const [isRestoring, setIsRestoring] = useState(false);
  
  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<MediaItem | null>(null);

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    type: 'All',
    status: 'All',
    rating: 'All',
    genre: 'All',
    sortBy: 'updated',
    onlyFavorites: false
  });

  // Load Initial Data
  useEffect(() => {
    const init = async () => {
      try {
        const profile = await getUserProfile();
        if (profile) {
          setUserProfile(profile);
          loadLibrary(); // Cargar siempre la librería para el fondo del LoginScreen
          if (!profile.password) {
            setIsAuthenticated(true);
          }
        }
      } catch (e) {
        console.error("Failed to init", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadLibrary = async () => {
    try {
      const items = await getLibrary();
      setLibrary(items);
    } catch (e) {
      showToast("Error cargando biblioteca", "error");
    }
  };

  // Scroll Handling for Bottom Nav visibility
  useEffect(() => {
    const handleScroll = () => {
        const currentScrollY = window.scrollY;
        // Solo ocultar si scrolleamos hacia abajo y hemos bajado lo suficiente
        if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
            setIsBottomNavVisible(false);
        } else {
            setIsBottomNavVisible(true);
        }
        lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handlers
  const handleLogin = (password: string) => {
    if (userProfile?.password === password) {
      setIsAuthenticated(true);
      // Library already loaded
      return true;
    }
    return false;
  };

  const handleOnboardingComplete = async (profile: UserProfile) => {
    await saveUserProfile(profile);
    setUserProfile(profile);
    setIsAuthenticated(true);
    setLibrary([]);
  };

  const handleImportBackup = async (file: File) => {
      setIsRestoring(true);
      // Small delay to allow UI to render the overlay before heavy processing blocks thread
      setTimeout(() => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                if (!content) throw new Error("Archivo vacío");
                
                const json = JSON.parse(content);
                
                if (Array.isArray(json)) {
                    showToast("Esto parece un Catálogo. Usa la opción 'Importar Catálogo' en Ajustes.", "warning");
                    setIsRestoring(false);
                    return;
                }

                const profileData = json.profile || json.userProfile;

                if (profileData && (Array.isArray(json.library) || !json.library)) {
                    const libraryItems = Array.isArray(json.library) ? json.library : [];

                    await saveUserProfile(profileData);
                    await clearLibrary();
                    // Process in chunks or one by one
                    for (const item of libraryItems) {
                        await saveMediaItem(item);
                    }
                    
                    setUserProfile(profileData);
                    setIsAuthenticated(true);
                    await loadLibrary();
                    showToast("Copia de seguridad restaurada exitosamente", "success");
                    setIsSettingsOpen(false); // Close settings if open
                } else {
                    console.error("Formato inválido:", Object.keys(json));
                    if (!profileData) showToast("Archivo inválido: No se encontró el perfil de usuario.", "error");
                    else showToast("Formato de archivo no reconocido.", "error");
                }
            } catch (err) {
                console.error(err);
                showToast("Error al leer el archivo. Asegúrate de que es un JSON válido.", "error");
            } finally {
                setIsRestoring(false);
            }
        };
        reader.onerror = () => {
             showToast("Error al leer el archivo", "error");
             setIsRestoring(false);
        };
        reader.readAsText(file);
      }, 100);
  };

  const handleExportBackup = () => {
      const data = {
          profile: userProfile,
          library: library,
          exportedAt: new Date().toISOString(),
          version: 1
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mediatracker_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
  };
  
  const handleImportCatalog = async (file: File) => {
    setIsRestoring(true); // Re-use restoring overlay style
    setTimeout(() => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (Array.isArray(json)) {
                    let count = 0;
                    for (const item of json) {
                        const exists = library.find(l => l.id === item.id);
                        if (!exists) {
                            await saveMediaItem(item);
                            count++;
                        }
                    }
                    await loadLibrary();
                    showToast(`Importadas ${count} obras nuevas`, "success");
                } else {
                showToast("Formato inválido. Se esperaba una lista (Array) de obras.", "error");
                }
            } catch (err) {
                showToast("Error al importar catálogo", "error");
            } finally {
                setIsRestoring(false);
            }
        };
        reader.readAsText(file);
    }, 100);
  };

  const handleExportCatalog = () => {
      const blob = new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mediatracker_catalog_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
  };

  const handleClearLibrary = async () => {
      await clearLibrary();
      setLibrary([]);
  };

  // CRUD Operations
  const handleSearch = async (query: string) => {
      if (!userProfile?.apiKey) {
          showToast("Configura tu API Key primero", "error");
          return;
      }
      setIsSearching(true);
      setSearchResult(null);
      try {
          const data = await searchMediaInfo(query, userProfile.apiKey);
          setSearchResult(data);
      } catch (e) {
          showToast("Error en la búsqueda", "error");
      } finally {
          setIsSearching(false);
      }
  };

  const handleAddFromSearch = async (data: AIWorkData) => {
      const newItem: MediaItem = {
          id: Date.now().toString(),
          aiData: data,
          trackingData: {
              status: 'Sin empezar',
              currentSeason: 1,
              totalSeasons: 1,
              watchedEpisodes: 0,
              totalEpisodesInSeason: 0,
              emotionalTags: [],
              favoriteCharacters: [],
              rating: '',
              comment: ''
          },
          createdAt: Date.now()
      };
      await saveMediaItem(newItem);
      setLibrary(prev => [newItem, ...prev]);
      setSearchResult(null);
      showToast("Añadido a la biblioteca", "success");
      setSelectedItem(newItem);
      setView('details');
  };

  const handleManualAdd = () => {
      const newItem: MediaItem = {
          id: Date.now().toString(),
          aiData: {
              title: 'Nueva Obra',
              mediaType: 'Otro',
              synopsis: '',
              genres: [],
              status: 'Desconocido',
              totalContent: '',
              coverDescription: '',
              sourceUrls: [],
              primaryColor: '#6366f1'
          },
          trackingData: {
              status: 'Sin empezar',
              currentSeason: 1,
              totalSeasons: 1,
              watchedEpisodes: 0,
              totalEpisodesInSeason: 0,
              emotionalTags: [],
              favoriteCharacters: [],
              rating: '',
              comment: ''
          },
          createdAt: Date.now()
      };
      // No lo guardamos en DB todavía, solo lo pasamos a la vista de edición como "nuevo"
      setSelectedItem(newItem);
      setView('details');
  };

  const handleUpdateItem = async (updated: MediaItem) => {
      const withTimestamp = { ...updated, lastInteraction: Date.now() };
      await saveMediaItem(withTimestamp);
      
      // Si el item no estaba en la librería (era nuevo/manual), lo añadimos
      const exists = library.find(i => i.id === updated.id);
      if (!exists) {
          setLibrary(prev => [withTimestamp, ...prev]);
      } else {
          setLibrary(prev => prev.map(item => item.id === updated.id ? withTimestamp : item));
      }
      
      if (selectedItem?.id === updated.id) setSelectedItem(withTimestamp);
  };

  // Trigger Confirmation Modal
  const requestDelete = (item: MediaItem) => {
      setItemToDelete(item);
  };

  // Execute Deletion
  const confirmDelete = async () => {
      if (!itemToDelete) return;
      
      try {
          await deleteMediaItem(itemToDelete.id);
          setLibrary(prev => prev.filter(i => i.id !== itemToDelete.id));
          
          // If we deleted the currently viewed item, go back
          if (selectedItem?.id === itemToDelete.id) {
              setSelectedItem(null);
              setView('library');
          }
          
          showToast("Obra eliminada permanentemente", "info");
      } catch (e) {
          showToast("Error al eliminar", "error");
      } finally {
          setItemToDelete(null);
      }
  };

  const handleIncrementProgress = async (item: MediaItem) => {
      const { watchedEpisodes, totalEpisodesInSeason, currentSeason, totalSeasons, accumulated_consumption } = item.trackingData;
      
      // Logic when no limit is set (infinite series)
      if (totalEpisodesInSeason === 0) {
          const newEp = watchedEpisodes + 1;
          const updated = { 
              ...item, 
              trackingData: { ...item.trackingData, watchedEpisodes: newEp }, 
              lastInteraction: Date.now() 
          };
          await saveMediaItem(updated);
          setLibrary(prev => prev.map(i => i.id === item.id ? updated : i));
          showToast(`+1 Capítulo a ${item.aiData.title}`, "success");
          return;
      }

      // Logic: Increment episode if not full
      if (watchedEpisodes < totalEpisodesInSeason) {
          const newEp = watchedEpisodes + 1;
          const updated = {
              ...item,
              trackingData: { ...item.trackingData, watchedEpisodes: newEp },
              lastInteraction: Date.now()
          };
          await saveMediaItem(updated);
          setLibrary(prev => prev.map(i => i.id === item.id ? updated : i));
          
          if (newEp === totalEpisodesInSeason) {
             const isLastSeason = currentSeason >= totalSeasons && totalSeasons > 0;
             showToast(isLastSeason ? "¡Final alcanzado! Pulsa de nuevo para completar." : "Temporada terminada. Pulsa de nuevo para la siguiente.", "info");
          } else {
             showToast(`+1 Capítulo a ${item.aiData.title}`, "success");
          }
      } 
      // Logic: Transition (Next Season or Complete) if full
      else {
          if (currentSeason < totalSeasons && totalSeasons > 0) {
              // Move to next season
              const newHistory = (accumulated_consumption || 0) + watchedEpisodes;
              const updated = {
                  ...item,
                  trackingData: { 
                      ...item.trackingData, 
                      currentSeason: currentSeason + 1,
                      watchedEpisodes: 0,
                      accumulated_consumption: newHistory
                  },
                  lastInteraction: Date.now()
              };
              await saveMediaItem(updated);
              setLibrary(prev => prev.map(i => i.id === item.id ? updated : i));
              showToast(`Comenzando Temporada ${currentSeason + 1}`, "success");
          } else {
              // Complete Series
              const updated: MediaItem = {
                  ...item,
                  trackingData: { ...item.trackingData, status: 'Completado' },
                  lastInteraction: Date.now()
              };
              await saveMediaItem(updated);
              setLibrary(prev => prev.map(i => i.id === item.id ? updated : i));
              showToast(`¡${item.aiData.title} Completado!`, "success");
          }
      }
  };

  const handleToggleFavorite = async (item: MediaItem) => {
      const updated = {
          ...item,
          trackingData: { ...item.trackingData, is_favorite: !item.trackingData.is_favorite }
      };
      await saveMediaItem(updated);
      setLibrary(prev => prev.map(i => i.id === item.id ? updated : i));
  };

  const handleRecommendationSelect = async (title: string, type: string) => {
      setView('search');
      setSearchKey(prev => prev + 1); 
      if (!userProfile?.apiKey) return;
      setIsSearching(true);
      try {
        const data = await searchMediaInfo(title, userProfile.apiKey, type);
        setSearchResult(data);
      } catch (e) {
          showToast("Error buscando recomendación", "error");
      } finally {
        setIsSearching(false);
      }
  };

  // Filter Logic
  const getFilteredLibrary = () => {
      let filtered = library;

      if (view === 'upcoming') {
          return filtered.filter(item => 
              item.trackingData.status === 'Planeado / Pendiente' || 
              (item.trackingData.status === 'En Pausa' && item.trackingData.scheduledReturnDate)
          ).sort((a, b) => {
              const dateA = a.trackingData.nextReleaseDate || a.trackingData.scheduledReturnDate || '9999';
              const dateB = b.trackingData.nextReleaseDate || b.trackingData.scheduledReturnDate || '9999';
              return dateA.localeCompare(dateB);
          });
      }

      if (filters.query) {
          const q = filters.query.toLowerCase();
          filtered = filtered.filter(i => i.aiData.title.toLowerCase().includes(q));
      }
      if (filters.type !== 'All') {
          filtered = filtered.filter(i => i.aiData.mediaType === filters.type);
      }
      if (filters.status !== 'All') {
          filtered = filtered.filter(i => i.trackingData.status === filters.status);
      }
      if (filters.rating !== 'All') {
          filtered = filtered.filter(i => i.trackingData.rating === filters.rating);
      }
      if (filters.genre !== 'All') {
          filtered = filtered.filter(i => (i.aiData.genres || []).some(g => g.toLowerCase() === filters.genre.toLowerCase()));
      }
      if (filters.onlyFavorites) {
          filtered = filtered.filter(i => i.trackingData.is_favorite);
      }

      // Sort
      return filtered.sort((a, b) => {
          if (filters.sortBy === 'title') return a.aiData.title.localeCompare(b.aiData.title);
          if (filters.sortBy === 'progress') {
              const progA = a.trackingData.totalEpisodesInSeason ? (a.trackingData.watchedEpisodes / a.trackingData.totalEpisodesInSeason) : 0;
              const progB = b.trackingData.totalEpisodesInSeason ? (b.trackingData.watchedEpisodes / b.trackingData.totalEpisodesInSeason) : 0;
              return progB - progA;
          }
          // Default: Updated/Created
          return (b.lastInteraction || b.createdAt) - (a.lastInteraction || a.createdAt);
      });
  };

  const displayedLibrary = getFilteredLibrary();
  const availableGenres = Array.from(new Set(library.flatMap(i => i.aiData.genres || []).map(g => g.toLowerCase())));

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>;

  if (!userProfile) {
    return (
        <>
            <Onboarding onComplete={handleOnboardingComplete} onImport={handleImportBackup} />
            <LoadingOverlay isVisible={isRestoring} type="restore" />
        </>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen 
        onUnlock={handleLogin} 
        username={userProfile.username} 
        avatarUrl={userProfile.avatarUrl} 
        library={library}
    />;
  }

  // Helper for Desktop Nav Link
  const DesktopNavLink = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
      <button 
          onClick={onClick}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-bold ${active ? 'bg-white/10 text-white shadow-sm border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
      >
          <Icon className={`w-4 h-4 ${active ? 'text-primary' : ''}`} />
          {label}
      </button>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Loading Overlays */}
      <LoadingOverlay isVisible={isRestoring} type="restore" />
      <LoadingOverlay isVisible={isSearching} type="search" />

      {/* Header (Hidden in Immersive) */}
      {!isImmersiveMode && (
          <header className="fixed top-0 w-full bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 z-40 px-4 md:px-8 py-3 flex items-center justify-between">
             
             {/* Left: User Identity */}
             <div className="flex items-center gap-3">
                 <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5">
                     <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden">
                        {userProfile.avatarUrl ? (
                            <img src={userProfile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5" /></div>
                        )}
                     </div>
                 </div>
                 <h1 className="font-bold text-white text-lg hidden lg:block">{userProfile.username}'s Library</h1>
             </div>
             
             {/* Center: Desktop Navigation (Restored) */}
             <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 absolute left-1/2 -translate-x-1/2">
                 <DesktopNavLink icon={LayoutGrid} label="Biblioteca" active={view === 'library' || view === 'details'} onClick={() => { setView('library'); setSelectedItem(null); }} />
                 <DesktopNavLink icon={Bookmark} label="Deseos" active={view === 'upcoming'} onClick={() => { setView('upcoming'); setSelectedItem(null); }} />
                 <DesktopNavLink icon={PlusCircle} label="Añadir" active={view === 'search'} onClick={() => { setView('search'); setSelectedItem(null); setSearchKey(k => k+1); }} />
                 <DesktopNavLink icon={Compass} label="Descubrir" active={view === 'discovery'} onClick={() => { setView('discovery'); setSelectedItem(null); }} />
                 <DesktopNavLink icon={BarChart2} label="Stats" active={view === 'stats'} onClick={() => { setView('stats'); setSelectedItem(null); }} />
             </nav>

             {/* Right: Actions */}
             <div className="flex items-center gap-2 md:gap-4">
                 <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                 >
                     <Settings className="w-5 h-5" />
                 </button>
                 <button 
                    onClick={() => setIsAuthenticated(false)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                 >
                     <LogOut className="w-5 h-5" />
                 </button>
             </div>
          </header>
      )}

      {/* Main Content Area */}
      <main className={`pt-20 pb-24 md:pt-24 px-4 md:px-8 max-w-7xl mx-auto min-h-screen transition-all ${isImmersiveMode ? 'pt-0 px-0 max-w-none' : ''}`}>
          
          {/* VIEW: LIBRARY / UPCOMING */}
          {(view === 'library' || view === 'upcoming') && !selectedItem && (
              <div className="animate-fade-in">
                  <ContextualGreeting userProfile={userProfile} library={library} view={view} />
                  
                  <LibraryFilters 
                    filters={filters} 
                    onChange={setFilters} 
                    availableGenres={availableGenres} 
                    viewMode={libraryViewMode}
                    onToggleViewMode={() => setLibraryViewMode(prev => prev === 'grid' ? 'catalog' : 'grid')}
                  />
                  
                  {libraryViewMode === 'catalog' && view === 'library' ? (
                      <CatalogView 
                          library={displayedLibrary} 
                          onOpenDetail={(item) => { setSelectedItem(item); setView('details'); }} 
                      />
                  ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                          {displayedLibrary.map(item => (
                              <CompactMediaCard 
                                  key={item.id} 
                                  item={item} 
                                  onClick={() => { setSelectedItem(item); setView('details'); }}
                                  onIncrement={handleIncrementProgress}
                                  onToggleFavorite={handleToggleFavorite}
                                  onDelete={requestDelete} 
                              />
                          ))}
                          {displayedLibrary.length === 0 && (
                              <div className="col-span-full text-center py-20 text-slate-500 flex flex-col items-center">
                                  <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
                                      <SearchIcon className="w-8 h-8 opacity-20" />
                                  </div>
                                  <p>No se encontraron obras</p>
                                  {view === 'upcoming' && <p className="text-sm mt-1">Añade obras a "Planeado" para verlas aquí.</p>}
                              </div>
                          )}
                      </div>
                  )}
              </div>
          )}

          {/* VIEW: DETAILS */}
          {view === 'details' && selectedItem && (
              <div className="animate-fade-in">
                  <button 
                    onClick={() => { setSelectedItem(null); setView('library'); }}
                    className="mb-4 flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-medium"
                  >
                      ← Volver a la biblioteca
                  </button>
                  <MediaCard 
                      item={selectedItem} 
                      onUpdate={handleUpdateItem} 
                      onDelete={() => requestDelete(selectedItem)}
                      username={userProfile.username}
                      apiKey={userProfile.apiKey}
                      isNew={!library.find(i => i.id === selectedItem.id)} // Es nuevo si no está en librería
                  />
              </div>
          )}

          {/* VIEW: SEARCH */}
          {view === 'search' && (
              <div className={`animate-fade-in pt-4 ${searchResult ? 'w-full' : 'max-w-2xl mx-auto'}`}>
                  <div className={`mb-6 ${searchResult ? 'max-w-2xl mx-auto' : ''}`}>
                      <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                        <PlusCircle className="w-6 h-6 text-primary" />
                        Añadir Obra
                      </h2>
                      <p className="text-slate-400 text-sm mb-4">Busca información automática con IA o crea una entrada vacía.</p>
                      
                      <SearchBar 
                        onSearch={handleSearch} 
                        isLoading={isSearching} 
                        placeholder="Ej: Solo Leveling, Inception, Breaking Bad..."
                      />
                  </div>
                  
                  {searchResult ? (
                      <div className="mt-8 animate-fade-in-up">
                          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">Resultado de la Búsqueda</h3>
                          <MediaCard 
                              item={{
                                  id: 'preview',
                                  aiData: searchResult,
                                  trackingData: {
                                    status: 'Sin empezar', currentSeason: 1, totalSeasons: 1, 
                                    watchedEpisodes: 0, totalEpisodesInSeason: 0, 
                                    emotionalTags: [], favoriteCharacters: [], rating: '', comment: ''
                                  },
                                  createdAt: Date.now()
                              }}
                              onUpdate={() => {}} 
                              isNew={true}
                              onDelete={() => setSearchResult(null)}
                          />
                          <div className="flex gap-3 mt-6 max-w-2xl mx-auto">
                            <button 
                                onClick={() => setSearchResult(null)}
                                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => handleAddFromSearch(searchResult)}
                                className="flex-[2] py-4 bg-primary hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                                <PlusCircle className="w-5 h-5" /> AÑADIR A BIBLIOTECA
                            </button>
                          </div>
                      </div>
                  ) : (
                      <div className="mt-12 text-center border-t border-slate-800 pt-8">
                          <p className="text-slate-500 mb-4 text-sm font-medium">¿No encuentras lo que buscas o prefieres rellenarlo tú?</p>
                          <button
                              onClick={handleManualAdd}
                              className="px-6 py-3 bg-slate-800/50 hover:bg-slate-800 text-white rounded-xl font-bold transition-all border border-slate-700 hover:border-slate-500 flex items-center justify-center gap-2 mx-auto group"
                          >
                              <PenTool className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                              Crear Obra Manualmente
                          </button>
                      </div>
                  )}
              </div>
          )}

          {/* VIEW: DISCOVERY */}
          {view === 'discovery' && (
              <DiscoveryView 
                  library={library} 
                  apiKey={userProfile.apiKey} 
                  onSelectRecommendation={handleRecommendationSelect}
                  onToggleImmersive={setIsImmersiveMode}
              />
          )}

          {/* VIEW: STATS */}
          {view === 'stats' && (
              <StatsView 
                  library={library} 
                  userProfile={userProfile} 
                  onUpdateProfile={(p) => { setUserProfile(p); saveUserProfile(p); }} 
              />
          )}

      </main>

      {/* DELETE CONFIRMATION MODAL */}
      {itemToDelete && (
          <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-surface border border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-fade-in-up">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                      <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">¿Eliminar Obra?</h3>
                  <p className="text-sm text-slate-400 mb-6">
                      Estás a punto de borrar <span className="text-white font-bold">"{itemToDelete.aiData.title}"</span>. 
                      <br />
                      Esta acción es irreversible y perderás todo tu progreso.
                  </p>
                  
                  <div className="flex gap-3">
                      <button 
                          onClick={() => setItemToDelete(null)}
                          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={confirmDelete}
                          className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                      >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Mobile Bottom Navigation (Hidden in Immersive Mode and on Scroll) */}
      <nav className={`md:hidden fixed bottom-0 w-full bg-surface/95 backdrop-blur-xl border-t border-slate-700/50 pb-safe pt-2 px-1 flex justify-around items-center z-40 transition-transform duration-300 ${isImmersiveMode || !isBottomNavVisible ? 'translate-y-full' : 'translate-y-0'}`}>
          <button onClick={() => { setView('library'); setSelectedItem(null); }} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${view === 'library' || view === 'details' ? 'text-primary' : 'text-slate-500'}`}>
              <LayoutGrid className="w-5 h-5" />
              <span className="text-[9px] font-bold">Biblio</span>
          </button>
          
          <button onClick={() => { setView('upcoming'); setSelectedItem(null); }} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${view === 'upcoming' ? 'text-primary' : 'text-slate-500'}`}>
              <Bookmark className="w-5 h-5" />
              <span className="text-[9px] font-bold">Deseos</span>
          </button>

          <button onClick={() => { setView('search'); setSelectedItem(null); setSearchKey(prev => prev + 1); }} className="flex flex-col items-center gap-1 p-2 min-w-[60px]">
              <div className={`bg-primary text-white p-3 rounded-full -mt-8 shadow-lg border-4 border-slate-950 transition-transform active:scale-95 ${view === 'search' ? 'ring-2 ring-primary/50' : ''}`}>
                  <PlusCircle className="w-6 h-6" />
              </div>
              <span className="text-[9px] font-bold opacity-0">Nuevo</span>
          </button>

          <button onClick={() => { setView('discovery'); setSelectedItem(null); }} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${view === 'discovery' ? 'text-primary' : 'text-slate-500'}`}>
              <Compass className="w-5 h-5" />
              <span className="text-[9px] font-bold">Descubrir</span>
          </button>

          <button onClick={() => { setView('stats'); setSelectedItem(null); }} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${view === 'stats' ? 'text-primary' : 'text-slate-500'}`}>
              <BarChart2 className="w-5 h-5" />
              <span className="text-[9px] font-bold">Stats</span>
          </button>
      </nav>

      <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)}
          userProfile={userProfile}
          onUpdateProfile={async (p) => { 
              await saveUserProfile(p); 
              setUserProfile(p); 
          }}
          onImportBackup={handleImportBackup}
          onExportBackup={handleExportBackup}
          onImportCatalog={handleImportCatalog}
          onExportCatalog={handleExportCatalog}
          onClearLibrary={handleClearLibrary}
          library={library}
          onLibraryUpdate={setLibrary}
      />
    </div>
  );
};

export default App;
