import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutGrid, Bookmark, PlusCircle, Compass, BarChart2, 
  Search as SearchIcon, LogOut, Settings, User
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
          if (!profile.password) {
            setIsAuthenticated(true);
            loadLibrary();
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
      loadLibrary();
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
      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const content = e.target?.result as string;
              if (!content) return;
              
              const json = JSON.parse(content);
              
              // 1. Detección de error común: Usuario intenta cargar un Catálogo (Array) como Backup (Objeto)
              if (Array.isArray(json)) {
                  showToast("Esto parece un Catálogo. Usa la opción 'Importar Catálogo' en Ajustes.", "warning");
                  return;
              }

              // 2. Validación de Backup (Debe tener perfil)
              // Support legacy 'userProfile' key or standard 'profile' key
              const profileData = json.profile || json.userProfile;

              // Relajamos la condición de 'library': si falta, asumimos array vacío.
              if (profileData && (Array.isArray(json.library) || !json.library)) {
                  const libraryItems = Array.isArray(json.library) ? json.library : [];

                  await saveUserProfile(profileData);
                  await clearLibrary();
                  for (const item of libraryItems) {
                      await saveMediaItem(item);
                  }
                  
                  setUserProfile(profileData);
                  setIsAuthenticated(true);
                  loadLibrary();
                  showToast("Copia de seguridad restaurada exitosamente", "success");
              } else {
                console.error("Formato inválido:", Object.keys(json));
                if (!profileData) showToast("Archivo inválido: No se encontró el perfil de usuario.", "error");
                else showToast("Formato de archivo no reconocido.", "error");
              }
          } catch (err) {
              console.error(err);
              showToast("Error al leer el archivo. Asegúrate de que es un JSON válido.", "error");
          }
      };
      reader.readAsText(file);
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
                loadLibrary();
                showToast(`Importadas ${count} obras nuevas`, "success");
            } else {
              showToast("Formato inválido. Se esperaba una lista (Array) de obras.", "error");
            }
        } catch (err) {
            showToast("Error al importar catálogo", "error");
        }
    };
    reader.readAsText(file);
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
      const data = await searchMediaInfo(query, userProfile.apiKey);
      setSearchResult(data);
      setIsSearching(false);
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
      // Go to details to edit immediately
      setSelectedItem(newItem);
      setView('details');
  };

  const handleUpdateItem = async (updated: MediaItem) => {
      const withTimestamp = { ...updated, lastInteraction: Date.now() };
      await saveMediaItem(withTimestamp);
      setLibrary(prev => prev.map(item => item.id === updated.id ? withTimestamp : item));
      if (selectedItem?.id === updated.id) setSelectedItem(withTimestamp);
  };

  const handleDeleteItem = async (item: MediaItem) => {
      if (window.confirm(`¿Eliminar "${item.aiData.title}"?`)) {
          await deleteMediaItem(item.id);
          setLibrary(prev => prev.filter(i => i.id !== item.id));
          if (selectedItem?.id === item.id) {
              setSelectedItem(null);
              setView('library');
          }
          showToast("Eliminado", "info");
      }
  };

  const handleIncrementProgress = async (item: MediaItem) => {
      const newEp = item.trackingData.watchedEpisodes + 1;
      const updated = {
          ...item,
          trackingData: { ...item.trackingData, watchedEpisodes: newEp },
          lastInteraction: Date.now()
      };
      await saveMediaItem(updated);
      setLibrary(prev => prev.map(i => i.id === item.id ? updated : i));
      showToast(`+1 Capítulo a ${item.aiData.title}`, "success");
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
      const data = await searchMediaInfo(title, userProfile.apiKey, type);
      setSearchResult(data);
      setIsSearching(false);
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
    return <Onboarding onComplete={handleOnboardingComplete} onImport={handleImportBackup} />;
  }

  if (!isAuthenticated) {
    return <LoginScreen 
        onUnlock={handleLogin} 
        username={userProfile.username} 
        avatarUrl={userProfile.avatarUrl} 
        library={library}
    />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Header (Hidden in Immersive) */}
      {!isImmersiveMode && (
          <header className="fixed top-0 w-full bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 z-40 px-4 md:px-8 py-3 flex items-center justify-between">
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
                 <h1 className="font-bold text-white text-lg hidden md:block">{userProfile.username}'s Library</h1>
             </div>
             
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
                                  onDelete={handleDeleteItem}
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
                      onDelete={() => handleDeleteItem(selectedItem)}
                      username={userProfile.username}
                      apiKey={userProfile.apiKey}
                  />
              </div>
          )}

          {/* VIEW: SEARCH */}
          {view === 'search' && (
              <div className="max-w-3xl mx-auto animate-fade-in">
                  <div className="text-center mb-8">
                      <h2 className="text-3xl font-bold text-white mb-2">Añadir Nueva Obra</h2>
                      <p className="text-slate-400">Busca anime, series, libros o películas para tu colección.</p>
                  </div>
                  
                  <SearchBar onSearch={handleSearch} isLoading={isSearching} />
                  
                  {searchResult && (
                      <div className="mt-8 animate-fade-in-up">
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
                          <button 
                              onClick={() => handleAddFromSearch(searchResult)}
                              className="w-full mt-4 py-4 bg-primary hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                          >
                              <PlusCircle className="w-5 h-5" /> AÑADIR A MI BIBLIOTECA
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

      {/* Mobile Bottom Navigation (Hidden in Immersive Mode and on Scroll) */}
      <nav className={`md:hidden fixed bottom-0 w-full bg-surface/90 backdrop-blur-xl border-t border-slate-700/50 pb-safe pt-2 px-1 flex justify-around items-center z-40 transition-transform duration-300 ${isImmersiveMode || !isBottomNavVisible ? 'translate-y-full' : 'translate-y-0'}`}>
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