
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Loader2, Sparkles, User, PlusCircle, LayoutGrid, Bookmark, Compass, 
  BarChart2, ChevronDown, Settings, Download, ArrowLeft, Trash2, GitMerge, ArrowUp,
  AlertCircle, PenTool
} from 'lucide-react';
import { useToast } from './context/ToastContext';
import { MediaItem, UserProfile, AIWorkData, UserTrackingData, normalizeGenre, THEME_COLORS } from './types';
import { 
  initDB, getUserProfile, saveUserProfile, getLibrary, 
  saveMediaItem, deleteMediaItem, clearLibrary 
} from './services/storage';
import { searchMediaInfo } from './services/geminiService';

import { SearchBar } from './components/SearchBar';
import { MediaCard } from './components/MediaCard';
import { CompactMediaCard } from './components/CompactMediaCard';
import { LibraryFilters, FilterState } from './components/LibraryFilters';
import { SettingsModal } from './components/SettingsModal';
import { StatsView } from './components/StatsView';
import { DiscoveryView } from './components/DiscoveryView';
import { CatalogView } from './components/CatalogView';
import { ContextualGreeting } from './components/ContextualGreeting';
import { LoginScreen } from './components/LoginScreen';
import { Onboarding } from './components/Onboarding';

export default function App() {
  const { showToast } = useToast();

  // --- STATE ---
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Auth & Profile
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);

  // Library Data
  const [library, setLibrary] = useState<MediaItem[]>([]);
  
  // Navigation & Views
  const [view, setView] = useState('library'); // library, search, details, stats, discovery, upcoming
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Search View State
  const [searchMode, setSearchMode] = useState<'auto' | 'manual'>('auto');
  const [isSearching, setIsSearching] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const [currentMedia, setCurrentMedia] = useState<MediaItem | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Manual Entry State
  const [manualTitle, setManualTitle] = useState('');
  const [manualType, setManualType] = useState('Anime');

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
  const [libraryViewMode, setLibraryViewMode] = useState<'grid' | 'catalog'>('grid');

  // Pagination / Scroll
  const [visibleCount, setVisibleCount] = useState(24);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Modals
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [pendingImport, setPendingImport] = useState<{ library: MediaItem[] } | null>(null);

  // --- THEME APPLICATION ---
  const applyTheme = useCallback((colorValue: string) => {
      const colorObj = THEME_COLORS.find(c => c.value === colorValue);
      const rgbValue = colorObj ? colorObj.value : colorValue; 
      document.documentElement.style.setProperty('--color-primary', rgbValue);
  }, []);

  useEffect(() => {
      if (userProfile?.accentColor) {
          applyTheme(userProfile.accentColor);
      }
  }, [userProfile, applyTheme]);

  // --- INITIALIZATION ---

  useEffect(() => {
    const init = async () => {
      try {
        await initDB();
        const profile = await getUserProfile();
        const libs = await getLibrary();
        
        setLibrary(libs);

        if (profile) {
          setUserProfile(profile);
          applyTheme(profile.accentColor); 
          if (profile.password) {
            setIsAuthenticated(false);
          } else {
            setIsAuthenticated(true);
          }
        } else {
          setIsOnboarding(true);
        }
      } catch (e) {
        console.error("Init failed", e);
        showToast("Error inicializando base de datos", "error");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [showToast, applyTheme]);

  // --- AUTH HANDLERS ---
  const handleUnlock = (password: string) => {
    if (userProfile && userProfile.password === password) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const handleOnboardingComplete = async (profile: UserProfile) => {
    await saveUserProfile(profile);
    setUserProfile(profile);
    setIsAuthenticated(true);
    setIsOnboarding(false);
  };

  const handleUpdateUserProfile = async (profile: UserProfile) => {
    await saveUserProfile(profile);
    setUserProfile(profile);
  };

  // --- LIBRARY ACTIONS ---

  const addToLibrary = async () => {
    if (!currentMedia) return;
    try {
      await saveMediaItem(currentMedia);
      setLibrary(prev => [currentMedia, ...prev]);
      showToast("Guardado en la biblioteca", "success");
      setView('library');
    } catch (e) {
      showToast("Error al guardar", "error");
    }
  };

  const handleUpdateMedia = async (updatedItem: MediaItem) => {
    try {
      await saveMediaItem(updatedItem);
      setLibrary(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
      if (currentMedia && currentMedia.id === updatedItem.id) {
        setCurrentMedia(updatedItem);
      }
    } catch (e) {
      showToast("Error al actualizar", "error");
    }
  };

  const handleDeleteRequest = (item: MediaItem) => {
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMediaItem(deleteTarget.id);
      setLibrary(prev => prev.filter(i => i.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("Eliminado correctamente", "success");
      if (view === 'details' && currentMedia?.id === deleteTarget.id) {
        setView('library');
      }
    } catch (e) {
      showToast("Error al eliminar", "error");
    }
  };

  const cancelDelete = () => setDeleteTarget(null);

  const handleClearLibrary = async () => {
    await clearLibrary();
    setLibrary([]);
  };

  const handleQuickIncrement = async (item: MediaItem) => {
    const updated = { 
        ...item, 
        trackingData: { 
            ...item.trackingData, 
            watchedEpisodes: item.trackingData.watchedEpisodes + 1 
        },
        lastInteraction: Date.now()
    };
    await handleUpdateMedia(updated);
    showToast(`Progreso actualizado: ${updated.trackingData.watchedEpisodes}`, "success");
  };

  const handleToggleFavorite = async (item: MediaItem) => {
      const updated = {
          ...item,
          trackingData: {
              ...item.trackingData,
              is_favorite: !item.trackingData.is_favorite
          }
      };
      await handleUpdateMedia(updated);
      showToast(updated.trackingData.is_favorite ? "Añadido a Favoritos" : "Eliminado de Favoritos", "success");
  }

  // --- SEARCH & ENTRY ---

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setSearchError(null);
    setSearchMode('auto'); 
    if (view !== 'search') setView('search');

    try {
        const apiKey = userProfile?.apiKey || '';
        if (!apiKey) {
            throw new Error("Falta API Key");
        }
        
        const info = await searchMediaInfo(query, apiKey);
        
        const newItem: MediaItem = {
            id: Date.now().toString(),
            aiData: info,
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
            createdAt: Date.now(),
            lastInteraction: Date.now()
        };
        setCurrentMedia(newItem);
    } catch (e) {
        setSearchError("Error buscando información. Intenta de nuevo o usa modo manual.");
    } finally {
        setIsSearching(false);
    }
  };

  const handleManualEntry = () => {
      if (!manualTitle.trim()) return;
      
      const newItem: MediaItem = {
          id: Date.now().toString(),
          aiData: {
              title: manualTitle,
              mediaType: manualType as any,
              synopsis: 'Sinopsis pendiente...',
              genres: [],
              status: 'Desconocido',
              totalContent: '?',
              coverDescription: '',
              coverImage: ''
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
          createdAt: Date.now(),
          lastInteraction: Date.now()
      };
      setCurrentMedia(newItem);
      setManualTitle('');
  };

  // --- IMPORT / EXPORT ---

  const handleExportBackup = () => {
      if (!userProfile) {
          showToast("Error: No hay perfil para exportar", "error");
          return;
      }
      const data = {
          userProfile,
          library,
          exportedAt: new Date().toISOString(),
          version: 1
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mediatracker_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleImportBackup = (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
          setIsLoading(true);
          setLoadingMessage('Analizando archivo...');
          
          try {
              const content = e.target?.result;
              if (typeof content !== 'string') throw new Error("No se pudo leer el archivo");

              let data;
              try {
                  data = JSON.parse(content);
              } catch (parseError) {
                  throw new Error("El archivo no es un JSON válido");
              }

              // Normalization logic: Handle legacy, flat arrays, or structured backups
              let importedLibrary: MediaItem[] = [];
              let importedProfile: UserProfile | null = null;

              if (Array.isArray(data)) {
                  // Legacy: Root is array
                  importedLibrary = data;
              } else {
                  // Structured: has library/catalog/userProfile keys
                  importedLibrary = Array.isArray(data.library) ? data.library : (Array.isArray(data.catalog) ? data.catalog : []);
                  importedProfile = data.userProfile || data.profile || null;
              }

              if (importedLibrary.length === 0 && !importedProfile) {
                  throw new Error("El archivo no contiene datos reconocibles.");
              }

              setLoadingMessage('Restaurando datos...');

              // 1. Restore Library if present
              if (importedLibrary.length > 0) {
                  // Clear existing if it's a full backup restore
                  await clearLibrary();
                  
                  // Batch Import
                  const CHUNK_SIZE = 50;
                  for (let i = 0; i < importedLibrary.length; i += CHUNK_SIZE) {
                      const chunk = importedLibrary.slice(i, i + CHUNK_SIZE);
                      await Promise.all(chunk.map((item: MediaItem) => saveMediaItem(item)));
                      await new Promise(resolve => setTimeout(resolve, 5));
                  }
                  setLibrary(importedLibrary);
              }

              // 2. Restore Profile if present
              if (importedProfile) {
                  await saveUserProfile(importedProfile);
                  setUserProfile(importedProfile);
                  applyTheme(importedProfile.accentColor);
                  if (isOnboarding) setIsOnboarding(false);
              } else {
                  // Fallback: If no profile but we have library (e.g. catalog import as backup),
                  // we notify the user but don't crash.
                  if (isOnboarding && importedLibrary.length > 0) {
                      showToast("Biblioteca importada. Por favor completa tu perfil.", "info");
                      // Does NOT close onboarding, allows user to set name/key manually
                  }
              }

              showToast("Restauración completada", "success");
              setIsSettingsOpen(false);

          } catch (err: any) {
              console.error(err);
              showToast(err.message || "Error al importar el archivo", "error");
          } finally {
              setIsLoading(false);
              setLoadingMessage('');
          }
      };
      reader.readAsText(file);
  };

  const handleExportCatalog = () => {
       const catalog = library.map(item => ({
           id: item.id,
           aiData: item.aiData,
           // Only basic tracking info for sharing catalog
           status: item.trackingData.status, 
           rating: item.trackingData.rating
       }));
       const blob = new Blob([JSON.stringify({ catalog, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `mediatracker_catalog_${new Date().toISOString().split('T')[0]}.json`;
       a.click();
       URL.revokeObjectURL(url);
  };

  const handleImportCatalog = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const data = JSON.parse(e.target?.result as string);
              // Handle both full backup format (data.library) and catalog format (data.catalog)
              const items = data.library || data.catalog; 
              
              if (Array.isArray(items)) {
                  // Filter out items that already exist by ID or Title (approx)
                  const newItems = items.filter((newItem: any) => {
                       // Convert simplified catalog item to full MediaItem if needed
                       return !library.some(existing => existing.id === newItem.id || existing.aiData.title === newItem.aiData.title);
                  }).map((item: any) => {
                      // Ensure full structure if importing simplified catalog
                      if (!item.trackingData) {
                          return {
                              ...item,
                              id: Date.now().toString() + Math.random().toString().slice(2,6), // Regen ID to avoid collision
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
                              createdAt: Date.now(),
                              lastInteraction: Date.now()
                          } as MediaItem;
                      }
                      return item as MediaItem;
                  });

                  if (newItems.length > 0) {
                      setPendingImport({ library: newItems });
                  } else {
                      showToast("No se encontraron obras nuevas para importar.", "info");
                  }
              } else {
                  throw new Error("Formato inválido");
              }
          } catch (err) {
              showToast("Error al leer catálogo", "error");
          }
      };
      reader.readAsText(file);
  };

  const processCatalogImport = async (newItems: MediaItem[]) => {
      setIsLoading(true);
      setLoadingMessage('Importando obras...');
      try {
          // Batch process import
          const CHUNK_SIZE = 50;
          for (let i = 0; i < newItems.length; i += CHUNK_SIZE) {
              const chunk = newItems.slice(i, i + CHUNK_SIZE);
              await Promise.all(chunk.map(item => saveMediaItem(item)));
              await new Promise(resolve => setTimeout(resolve, 5));
          }

          const updatedLib = await getLibrary();
          setLibrary(updatedLib);
          setPendingImport(null);
          showToast(`Importadas ${newItems.length} obras exitosamente`, "success");
      } catch (e) {
          showToast("Error guardando importación", "error");
      } finally {
          setIsLoading(false);
          setLoadingMessage('');
      }
  };


  // --- VIEW HELPERS ---
  const openDetail = (item: MediaItem) => {
      setCurrentMedia(item);
      setView('details');
      window.scrollTo(0,0);
  };

  // --- FILTER & SORT LOGIC ---
  const filteredLibrary = useMemo(() => {
    let result = [...library];
    
    if (filters.query) {
      const q = filters.query.toLowerCase();
      result = result.filter(i => i.aiData.title.toLowerCase().includes(q));
    }

    if (filters.type !== 'All') {
      result = result.filter(i => i.aiData.mediaType === filters.type);
    }

    if (filters.status !== 'All') {
      result = result.filter(i => i.trackingData.status === filters.status);
    }

    if (filters.rating !== 'All') {
      result = result.filter(i => i.trackingData.rating === filters.rating);
    }

    if (filters.genre !== 'All') {
       result = result.filter(i => 
           i.aiData.genres.some(g => normalizeGenre(g) === filters.genre)
       );
    }

    if (filters.onlyFavorites) {
        result = result.filter(i => i.trackingData.is_favorite);
    }

    // Sort
    if (filters.sortBy === 'title') {
      result.sort((a, b) => a.aiData.title.localeCompare(b.aiData.title));
    } else if (filters.sortBy === 'progress') {
       result.sort((a, b) => {
           // Helper to get pct
           const getPct = (i: MediaItem) => {
               if (i.trackingData.status === 'Completado') return 100;
               if (i.trackingData.totalEpisodesInSeason > 0) return (i.trackingData.watchedEpisodes / i.trackingData.totalEpisodesInSeason) * 100;
               return 0;
           };
           return getPct(b) - getPct(a);
       });
    } else {
      // Updated / Recent interaction
      result.sort((a, b) => (b.lastInteraction || b.createdAt) - (a.lastInteraction || a.createdAt));
    }

    return result;
  }, [library, filters]);

  const upcomingLibrary = useMemo(() => {
      return library.filter(i => i.trackingData.status === 'Planeado / Pendiente')
             .sort((a, b) => {
                 // Sort by release date if available, else creation
                 const dateA = a.trackingData.nextReleaseDate || a.aiData.releaseDate || '';
                 const dateB = b.trackingData.nextReleaseDate || b.aiData.releaseDate || '';
                 if (dateA && dateB) return dateA.localeCompare(dateB);
                 if (dateA) return -1;
                 if (dateB) return 1;
                 return (b.createdAt - a.createdAt);
             });
  }, [library]);

  const availableGenres = useMemo(() => {
      const s = new Set<string>();
      library.forEach(i => i.aiData.genres.forEach(g => s.add(normalizeGenre(g))));
      return Array.from(s).sort();
  }, [library]);


  // --- INFINITE SCROLL SIMULATION ---
  useEffect(() => {
      const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
              setVisibleCount(prev => prev + 24);
          }
      }, { rootMargin: '100px' });
      
      if (loadMoreRef.current) observer.observe(loadMoreRef.current);
      return () => observer.disconnect();
  }, [filteredLibrary, view]);


  // --- SCROLL HANDLERS ---
  const scrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
      const handleScroll = () => {
          const currentScrollY = window.scrollY;
          
          // Bottom Nav Logic
          if (currentScrollY > lastScrollY && currentScrollY > 100) {
              setIsBottomNavVisible(false);
          } else {
              setIsBottomNavVisible(true);
          }
          
          // Scroll Top Logic
          setShowScrollTop(currentScrollY > 300);
          
          setLastScrollY(currentScrollY);
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Determine if we are in Full Screen Catalog Mode
  const isCatalogMode = view === 'library' && libraryViewMode === 'catalog';

  // --- RENDER ---

  if (isLoading) {
      return (
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center fixed inset-0 z-[100]">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
              <p className="text-white font-medium animate-pulse">{loadingMessage || 'Cargando tu universo...'}</p>
          </div>
      );
  }

  if (isOnboarding) {
      return <Onboarding onComplete={handleOnboardingComplete} onImport={handleImportBackup} />;
  }

  if (!isAuthenticated && userProfile) {
      return (
        <LoginScreen 
            onUnlock={handleUnlock} 
            username={userProfile.username} 
            avatarUrl={userProfile.avatarUrl}
            library={library}
        />
      );
  }

  if (!userProfile) return null; // Should not happen after init

  return (
    <div className="min-h-screen bg-background text-slate-200 font-sans selection:bg-primary selection:text-white flex flex-col pb-24 md:pb-0 relative">
      
      {isLoading && (
          <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-white font-bold text-lg animate-pulse">{loadingMessage || 'Cargando...'}</p>
          </div>
      )}

      <SettingsModal 
         isOpen={isSettingsOpen} 
         onClose={() => setIsSettingsOpen(false)} 
         userProfile={userProfile}
         onUpdateProfile={handleUpdateUserProfile}
         onExportBackup={handleExportBackup}
         onImportBackup={handleImportBackup}
         onExportCatalog={handleExportCatalog}
         onImportCatalog={handleImportCatalog}
         onClearLibrary={handleClearLibrary}
         library={library}
         onLibraryUpdate={setLibrary}
      />

      {/* Header */}
      <header className="bg-surface/80 backdrop-blur-md border-b border-slate-700 fixed top-0 w-full z-50 transition-colors duration-500 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="hidden md:flex items-center gap-2 cursor-pointer group" onClick={() => setView('library')}>
                <div className="w-8 h-8 bg-gradient-to-tr from-primary to-secondary rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform">
                  <Sparkles className="text-white w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                  MediaTracker AI
                </h1>
             </div>
             <div className="md:hidden flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center border border-slate-500 overflow-hidden">
                     {userProfile.avatarUrl ? (
                         <img src={userProfile.avatarUrl} alt={userProfile.username} className="w-full h-full object-cover" />
                     ) : (
                         <User className="w-4 h-4 text-slate-300" />
                     )}
                 </div>
                 <span className="text-sm font-bold text-white truncate max-w-[150px]">
                    {userProfile.username}
                 </span>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-2 mr-2">
              <button 
                onClick={() => {
                    setView('search');
                    setCurrentMedia(null);
                    setSearchKey(prev => prev + 1);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'search' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nuevo</span>
              </button>
              <button 
                onClick={() => setView('library')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'library' || view === 'details' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Biblioteca</span>
              </button>
              <button 
                onClick={() => setView('upcoming')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'upcoming' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
              >
                <Bookmark className="w-4 h-4" />
                <span>Wishlist</span>
              </button>
              <button 
                onClick={() => setView('discovery')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'discovery' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
              >
                <Compass className="w-4 h-4" />
                <span>Descubrir</span>
              </button>
              <button 
                onClick={() => setView('stats')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'stats' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
              >
                <BarChart2 className="w-4 h-4" />
                <span>Stats</span>
              </button>
            </nav>

            <div className="relative border-l border-slate-700 pl-4 ml-2 flex items-center">
                 <div className="hidden md:block">
                     <button 
                       onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                       className="flex items-center gap-2 hover:bg-slate-800 p-1.5 pr-3 rounded-full transition-colors group"
                     >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center border border-slate-500 group-hover:border-primary transition-colors shadow-sm overflow-hidden">
                            {userProfile.avatarUrl ? (
                                <img src={userProfile.avatarUrl} alt={userProfile.username} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-4 h-4 text-slate-300" />
                            )}
                        </div>
                        <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                          {userProfile.username}
                        </span>
                        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                     </button>

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
                                    onClick={handleExportBackup}
                                    className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white flex items-center gap-2 transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                    Exportar Datos
                                </button>
                            </div>
                        </>
                     )}
                 </div>
                 
                 <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
                 >
                     <Settings className="w-6 h-6" />
                 </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area - Renders the selected View */}
      {/* DYNAMIC LAYOUT: Full width for Catalog, Centered container for others */}
      <main className={`transition-all duration-300 min-h-[calc(100vh-80px)] overflow-x-hidden ${
          isCatalogMode 
            ? 'w-full pt-16 pb-0' // Full width, less top padding (header is floating)
            : 'max-w-7xl mx-auto px-2 md:px-4 pt-20 md:pt-24 pb-12' // Standard container with reduced mobile padding
      }`}>
         
         {/* Contextual Greeting (Always visible on Library) */}
         {view === 'library' && userProfile && (
             <div className={isCatalogMode ? "max-w-5xl mx-auto px-4 md:px-0 pt-6" : ""}>
                <ContextualGreeting userProfile={userProfile} library={library} view={view} />
             </div>
         )}

         {/* VIEW: SEARCH (New Entry) */}
         {view === 'search' && (
            <div className="animate-fade-in">
               <div className="flex flex-col items-center mb-8">
                   <h2 className="text-3xl font-bold text-white mb-2">Añadir Nueva Obra</h2>
                   <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                       <button 
                         onClick={() => setSearchMode('auto')}
                         className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${searchMode === 'auto' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}
                       >
                           Búsqueda AI
                       </button>
                       <button 
                         onClick={() => setSearchMode('manual')}
                         className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${searchMode === 'manual' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}
                       >
                           Manual
                       </button>
                   </div>
               </div>

               {searchMode === 'auto' ? (
                   <>
                     <SearchBar onSearch={handleSearch} isLoading={isSearching} key={searchKey} />
                     {searchError && (
                        <div className="max-w-2xl mx-auto mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 animate-fade-in">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p>{searchError}</p>
                        </div>
                     )}
                   </>
               ) : (
                   <div className="max-w-xl mx-auto bg-surface p-6 rounded-2xl border border-slate-700 shadow-xl">
                       <div className="space-y-4">
                           <div>
                               <label className="block text-sm font-bold text-slate-400 mb-2">Título</label>
                               <input 
                                 className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-primary outline-none"
                                 placeholder="Ej: Solo Leveling"
                                 value={manualTitle}
                                 onChange={(e) => setManualTitle(e.target.value)}
                               />
                           </div>
                           <div>
                               <label className="block text-sm font-bold text-slate-400 mb-2">Tipo</label>
                               <div className="grid grid-cols-3 gap-2">
                                   {['Anime', 'Serie', 'Pelicula', 'Manhwa', 'Libro', 'Comic'].map(t => (
                                       <button
                                         key={t}
                                         onClick={() => setManualType(t)}
                                         className={`py-2 rounded-lg text-xs font-bold border transition-colors ${manualType === t ? 'bg-primary border-primary text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                                       >
                                           {t}
                                       </button>
                                   ))}
                               </div>
                           </div>
                           <button 
                             onClick={handleManualEntry}
                             className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                           >
                               <PenTool className="w-4 h-4" /> Crear Borrador
                           </button>
                       </div>
                   </div>
               )}

               {currentMedia && !library.find(i => i.id === currentMedia.id) && (
                   <div className="mt-8 animate-fade-in-up">
                       <div className="flex justify-center mb-4">
                           <button 
                             onClick={addToLibrary}
                             className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-green-600/20 transform hover:scale-105 transition-all flex items-center gap-2"
                           >
                               <PlusCircle className="w-5 h-5" />
                               Guardar en Biblioteca
                           </button>
                       </div>
                       <MediaCard 
                          item={currentMedia} 
                          onUpdate={(updated) => setCurrentMedia(updated)} 
                          isNew={true} 
                          username={userProfile?.username}
                          apiKey={userProfile?.apiKey}
                          initialEditMode={searchMode === 'manual'}
                          onSearch={handleSearch}
                       />
                   </div>
               )}
            </div>
         )}

         {/* VIEW: LIBRARY */}
         {view === 'library' && (
             <div className="animate-fade-in">
                 {/* Wrap filters to keep them contained even in full-width mode */}
                 <div className={isCatalogMode ? "max-w-7xl mx-auto px-4 pt-4 md:pt-4 z-30 relative" : ""}>
                    <LibraryFilters 
                        filters={filters} 
                        onChange={setFilters} 
                        availableGenres={availableGenres}
                        viewMode={libraryViewMode}
                        onToggleViewMode={() => setLibraryViewMode(prev => prev === 'grid' ? 'catalog' : 'grid')}
                    />
                 </div>
                 
                 {library.length === 0 ? (
                     <div className="text-center py-20 opacity-50">
                         <LayoutGrid className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                         <p className="text-xl font-bold text-slate-500">Tu biblioteca está vacía</p>
                         <button onClick={() => setView('search')} className="mt-4 text-primary hover:underline">
                             Buscar algo para añadir
                         </button>
                     </div>
                 ) : (
                     <>
                        {libraryViewMode === 'catalog' ? (
                            <CatalogView 
                                library={filteredLibrary} 
                                onOpenDetail={openDetail} 
                            />
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-6">
                                {filteredLibrary.slice(0, visibleCount).map(item => (
                                    <CompactMediaCard 
                                        key={item.id} 
                                        item={item} 
                                        onClick={() => openDetail(item)}
                                        onIncrement={handleQuickIncrement}
                                        onToggleFavorite={handleToggleFavorite}
                                        onDelete={handleDeleteRequest}
                                    />
                                ))}
                            </div>
                        )}
                        
                        {/* Infinite Scroll Trigger */}
                        {libraryViewMode === 'grid' && filteredLibrary.length > visibleCount && (
                            <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                            </div>
                        )}
                     </>
                 )}
             </div>
         )}

         {/* VIEW: DETAILS */}
         {view === 'details' && currentMedia && (
             <div className="animate-fade-in max-w-7xl mx-auto px-0 md:px-0">
                 <button 
                   onClick={() => setView('library')}
                   className="mb-4 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                 >
                     <ArrowLeft className="w-4 h-4" /> Volver
                 </button>
                 <MediaCard 
                    item={currentMedia} 
                    onUpdate={handleUpdateMedia} 
                    onDelete={() => handleDeleteRequest(currentMedia)}
                    username={userProfile?.username}
                    apiKey={userProfile?.apiKey}
                    onSearch={handleSearch}
                 />
             </div>
         )}

         {/* VIEW: STATS */}
         {view === 'stats' && userProfile && (
             <StatsView 
                library={library} 
                userProfile={userProfile} 
                onUpdateProfile={handleUpdateUserProfile}
             />
         )}

         {/* VIEW: DISCOVERY */}
         {view === 'discovery' && userProfile && (
             <DiscoveryView 
                library={library}
                apiKey={userProfile.apiKey}
                onSelectRecommendation={(title) => {
                    handleSearch(title);
                }}
             />
         )}

         {/* VIEW: UPCOMING / WISHLIST */}
         {view === 'upcoming' && (
             <div className="animate-fade-in">
                 <div className="flex items-center gap-3 mb-6 border-l-4 border-yellow-500 pl-4">
                     <h2 className="text-2xl font-bold text-white">Wishlist & Próximos</h2>
                     <span className="bg-yellow-500/20 text-yellow-500 text-xs font-bold px-2 py-1 rounded-full border border-yellow-500/30">
                         {upcomingLibrary.length}
                     </span>
                 </div>

                 {upcomingLibrary.length === 0 ? (
                     <div className="text-center py-20 opacity-50 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
                         <Bookmark className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                         <p className="text-lg font-bold text-slate-500">No tienes nada planeado.</p>
                         <p className="text-sm text-slate-600">Marca obras como "Planeado" para verlas aquí.</p>
                     </div>
                 ) : (
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-6">
                         {upcomingLibrary.slice(0, visibleCount).map(item => (
                             <CompactMediaCard 
                                 key={item.id} 
                                 item={item} 
                                 onClick={() => openDetail(item)}
                                 onIncrement={handleQuickIncrement}
                                 onToggleFavorite={handleToggleFavorite}
                                 onDelete={handleDeleteRequest}
                             />
                         ))}
                     </div>
                 )}
                 {upcomingLibrary.length > visibleCount && (
                    <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                 )}
             </div>
         )}

      </main>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-surface border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center animate-fade-in-up">
                  <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trash2 className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">¿Eliminar obra?</h3>
                  <p className="text-slate-400 mb-6 text-sm">
                      Se borrará "{deleteTarget.aiData.title}" y todo su progreso. Esta acción no se puede deshacer.
                  </p>
                  <div className="flex gap-3">
                      <button 
                        onClick={cancelDelete}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
                      >
                          Cancelar
                      </button>
                      <button 
                        onClick={confirmDelete}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 transition-colors"
                      >
                          Eliminar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Import Merge Modal */}
      {pendingImport && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-surface border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-md w-full animate-fade-in-up">
                  <div className="flex items-center gap-3 mb-4">
                      <GitMerge className="w-6 h-6 text-purple-400" />
                      <h3 className="text-xl font-bold text-white">Importar Catálogo</h3>
                  </div>
                  <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                      Se han detectado <strong>{pendingImport.library.length}</strong> obras en el archivo. 
                      Las obras que ya existan en tu biblioteca se omitirán para evitar duplicados. 
                      Se importarán como "Sin empezar".
                  </p>
                  <div className="flex gap-3">
                      <button 
                        onClick={() => setPendingImport(null)}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
                      >
                          Cancelar
                      </button>
                      <button 
                        onClick={() => processCatalogImport(pendingImport.library)}
                        className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-lg shadow-purple-600/20 transition-colors"
                      >
                          Confirmar Importación
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className={`md:hidden fixed bottom-0 w-full bg-surface/95 backdrop-blur-xl border-t border-slate-700 z-50 pb-safe transition-transform duration-300 ${isBottomNavVisible ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex justify-around items-center h-16 px-2">
              <button 
                  onClick={() => setView('library')}
                  className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'library' || view === 'details' ? 'text-primary' : 'text-slate-400'}`}
              >
                  <LayoutGrid className="w-5 h-5" />
                  <span className="text-[10px] font-medium">Colección</span>
              </button>
              
              <button 
                  onClick={() => setView('upcoming')}
                  className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'upcoming' ? 'text-primary' : 'text-slate-400'}`}
              >
                  <Bookmark className="w-5 h-5" />
                  <span className="text-[10px] font-medium">Wishlist</span>
              </button>

              <button 
                  onClick={() => {
                      setView('search');
                      setCurrentMedia(null);
                      setSearchKey(prev => prev + 1);
                  }}
                  className="flex flex-col items-center justify-center w-full h-full -mt-5"
              >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-4 border-background ${view === 'search' ? 'bg-primary text-white' : 'bg-slate-700 text-slate-300'}`}>
                      <PlusCircle className="w-6 h-6" />
                  </div>
                  <span className={`text-[10px] font-medium mt-1 ${view === 'search' ? 'text-primary' : 'text-slate-400'}`}>Nuevo</span>
              </button>

              <button 
                  onClick={() => setView('discovery')}
                  className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'discovery' ? 'text-primary' : 'text-slate-400'}`}
              >
                  <Compass className="w-5 h-5" />
                  <span className="text-[10px] font-medium">Explorar</span>
              </button>

              <button 
                  onClick={() => setView('stats')}
                  className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'stats' ? 'text-primary' : 'text-slate-400'}`}
              >
                  <BarChart2 className="w-5 h-5" />
                  <span className="text-[10px] font-medium">Stats</span>
              </button>
          </div>
      </nav>

      {/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-24 md:bottom-8 left-1/2 md:left-auto md:right-8 -translate-x-1/2 md:translate-x-0 z-40 bg-slate-800/80 backdrop-blur-md border border-slate-600 p-3 rounded-full shadow-xl transition-all duration-300 ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
      >
          <ArrowUp className="w-5 h-5 text-white" />
      </button>

    </div>
  );
}
