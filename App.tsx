
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { SearchBar } from './components/SearchBar';
import { MediaCard } from './components/MediaCard';
import { CompactMediaCard } from './components/CompactMediaCard';
import { CatalogView } from './components/CatalogView'; 
import { Onboarding } from './components/Onboarding';
import { LoginScreen } from './components/LoginScreen';
import { SettingsModal } from './components/SettingsModal';
import { LibraryFilters, FilterState } from './components/LibraryFilters';
import { StatsView } from './components/StatsView';
import { DiscoveryView } from './components/DiscoveryView'; 
import { ContextualGreeting } from './components/ContextualGreeting'; 
import { searchMediaInfo } from './services/geminiService';
import { getLibrary, saveMediaItem, getUserProfile, saveUserProfile, initDB, deleteMediaItem, clearLibrary } from './services/storage';
import { MediaItem, UserProfile, normalizeGenre } from './types';
import { useToast } from './context/ToastContext';
import { LayoutGrid, Sparkles, PlusCircle, ArrowLeft, User, BarChart2, AlertCircle, Trash2, Download, Upload, ChevronDown, Settings, Compass, CalendarClock, Bookmark, Search, GitMerge, Loader2, PenTool, Edit3, ArrowUp } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function App() {
  const { showToast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentMedia, setCurrentMedia] = useState<MediaItem | null>(null);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  
  // States separated to avoid full screen modal on search
  const [isLoading, setIsLoading] = useState(false); // Global Overlay (Imports/Backups)
  const [isSearching, setIsSearching] = useState(false); // Search Bar specific loading
  const [loadingMessage, setLoadingMessage] = useState<string>(''); 

  const [view, setView] = useState<'search' | 'library' | 'details' | 'stats' | 'discovery' | 'upcoming'>('search');
  const [searchMode, setSearchMode] = useState<'auto' | 'manual'>('auto');
  
  // New View Mode State for Library (Grid vs Catalog)
  const [libraryViewMode, setLibraryViewMode] = useState<'grid' | 'catalog'>('grid');

  const [dbReady, setDbReady] = useState(false);
  
  // App Lock State
  const [isLocked, setIsLocked] = useState(false);

  // User Menu State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Search State
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState(0); // Used to reset search bar

  // Manual Entry State
  const [manualTitle, setManualTitle] = useState('');
  const [manualType, setManualType] = useState('Anime');

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);

  // Import Merge Confirmation State
  const [pendingImport, setPendingImport] = useState<{ library: MediaItem[] } | null>(null);

  // Scroll to Top State
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Pagination / Infinite Scroll State
  const [visibleCount, setVisibleCount] = useState(24);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Filters State
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    type: 'All',
    status: 'All',
    rating: 'All',
    genre: 'All', // Initialize genre filter
    sortBy: 'updated',
    onlyFavorites: false
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
        showToast("Error iniciando base de datos", "error");
      }
    };
    init();
  }, []);

  // Scroll Listener for Back to Top Button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Infinite Scroll Observer
  useEffect(() => {
    if (view !== 'library' && view !== 'upcoming') return;
    if (libraryViewMode === 'catalog') return; // Disable infinite scroll logic for Catalog view (it has its own structure)

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 24);
        }
      },
      { rootMargin: '400px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [view, filters, library, libraryViewMode]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  // Helper to check duplicates
  const checkDuplicate = useCallback((title: string, type: string) => {
      return library.find(item => 
          item.aiData.title.toLowerCase().trim() === title.toLowerCase().trim() &&
          item.aiData.mediaType === type
      );
  }, [library]);

  const handleSearch = async (query: string) => {
    if (!userProfile?.apiKey) {
        setSearchError("No tienes una API Key configurada. Ve a Configuración.");
        showToast("Falta API Key", "warning");
        return;
    }

    // UPDATE: Use local searching state to avoid global full-screen modal
    setIsSearching(true);
    setCurrentMedia(null);
    setSearchError(null);
    setView('search');

    try {
      const aiData = await searchMediaInfo(query, userProfile.apiKey);
      
      // Check for soft failure/generic fallback
      if (aiData.synopsis.includes("No se pudo obtener información automática")) {
         setSearchError(aiData.synopsis); // Use the message returned by service
         return;
      }

      // DUPLICATE CHECK
      const existingItem = checkDuplicate(aiData.title, aiData.mediaType);
      if (existingItem) {
          showToast(`"${aiData.title}" (${aiData.mediaType}) ya existe en tu biblioteca.`, "info");
          setCurrentMedia(existingItem);
          setView('details'); // Redirect directly to existing item
          return;
      }

      const newItem: MediaItem = {
        id: uuidv4(),
        aiData,
        createdAt: Date.now(),
        lastInteraction: Date.now(), // Initialize timestamp
        trackingData: {
          status: 'Sin empezar', // Updated default status
          currentSeason: 1,
          totalSeasons: 1, 
          watchedEpisodes: 0,
          totalEpisodesInSeason: aiData.mediaType === 'Pelicula' ? 1 : 12, 
          accumulated_consumption: 0, // Initialize new field
          emotionalTags: [],
          favoriteCharacters: [],
          rating: '',
          comment: '',
          recommendedBy: '',
          isSaga: false,
          finishedAt: undefined,
          nextReleaseDate: undefined,
          is_favorite: false
        }
      };

      setCurrentMedia(newItem);
    } catch (error) {
      console.error("Error searching media", error);
      setSearchError("Límite de Búsqueda o Error de API.");
      showToast("Error de conexión con IA", "error");
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualEntry = () => {
      if (!manualTitle.trim()) {
          showToast("El título es obligatorio", "error");
          return;
      }

      // DUPLICATE CHECK
      const existingItem = checkDuplicate(manualTitle, manualType);
      if (existingItem) {
          showToast(`"${existingItem.aiData.title}" ya existe como ${manualType}.`, "error");
          return;
      }

      const newItem: MediaItem = {
          id: uuidv4(),
          aiData: {
              title: manualTitle,
              originalTitle: "",
              mediaType: manualType as any,
              synopsis: "Sinopsis pendiente...",
              genres: [],
              status: "Desconocido",
              totalContent: "?",
              coverDescription: "",
              coverImage: "",
              sourceUrls: [],
              primaryColor: "#6366f1"
          },
          createdAt: Date.now(),
          lastInteraction: Date.now(),
          trackingData: {
            status: 'Sin empezar',
            currentSeason: 1,
            totalSeasons: 1,
            watchedEpisodes: 0,
            totalEpisodesInSeason: manualType === 'Pelicula' ? 1 : 12,
            accumulated_consumption: 0,
            emotionalTags: [],
            favoriteCharacters: [],
            rating: '',
            comment: '',
            recommendedBy: '',
            isSaga: false,
            is_favorite: false
          }
      };

      setCurrentMedia(newItem);
      setManualTitle('');
      setSearchError(null);
  };

  const handleUpdateMedia = useCallback(async (updatedItem: MediaItem) => {
    setCurrentMedia(updatedItem);
    setLibrary(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    await saveMediaItem(updatedItem);
  }, []);

  const handleToggleFavorite = useCallback(async (item: MediaItem) => {
      const updatedTracking = {
          ...item.trackingData,
          is_favorite: !item.trackingData.is_favorite
      };
      const updatedItem = {
          ...item,
          trackingData: updatedTracking,
          lastInteraction: item.lastInteraction
      };
      
      setLibrary(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      
      if (currentMedia && currentMedia.id === updatedItem.id) {
          setCurrentMedia(updatedItem);
      }

      await saveMediaItem(updatedItem);
      if (updatedTracking.is_favorite) showToast("Añadido a Favoritos ⭐", "success");
  }, [currentMedia, showToast]);

  const handleDeleteRequest = useCallback((item: MediaItem) => setDeleteTarget(item), []);

  const confirmDelete = async () => {
      if (deleteTarget) {
          await deleteMediaItem(deleteTarget.id);
          setLibrary(prev => prev.filter(i => i.id !== deleteTarget.id));
          if (currentMedia?.id === deleteTarget.id) {
              setView('library');
              setCurrentMedia(null);
          }
          setDeleteTarget(null);
          showToast("Obra eliminada", "info");
      }
  };

  const cancelDelete = () => setDeleteTarget(null);

  const handleClearLibrary = async () => {
      await clearLibrary();
      setLibrary([]);
      setCurrentMedia(null);
  };

  const handleQuickIncrement = useCallback(async (item: MediaItem) => {
    const { trackingData, aiData } = item;
    const isSeries = ['Anime', 'Serie'].includes(aiData.mediaType);
    const isBookSaga = aiData.mediaType === 'Libro' && trackingData.isSaga;
    const isMovie = aiData.mediaType === 'Pelicula';

    if (isMovie) return;

    let updatedTracking = { ...trackingData };
    
    if (trackingData.totalEpisodesInSeason > 0 && trackingData.watchedEpisodes >= trackingData.totalEpisodesInSeason) {
        if (isSeries || isBookSaga) {
            if (trackingData.totalSeasons > 0 && trackingData.currentSeason >= trackingData.totalSeasons) {
                updatedTracking.status = 'Completado';
            } else {
                const currentAccumulated = updatedTracking.accumulated_consumption || 0;
                updatedTracking.accumulated_consumption = currentAccumulated + updatedTracking.watchedEpisodes;
                updatedTracking.currentSeason += 1;
                updatedTracking.watchedEpisodes = 0;
                updatedTracking.status = 'Viendo/Leyendo';
            }
        } else {
             updatedTracking.status = 'Completado';
        }
    } else {
        updatedTracking.watchedEpisodes += 1;
        if (updatedTracking.status === 'Sin empezar') {
            updatedTracking.status = 'Viendo/Leyendo';
        }
    }

    const updatedItem = { 
        ...item, 
        trackingData: updatedTracking,
        lastInteraction: Date.now() 
    };
    
    setLibrary(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    await saveMediaItem(updatedItem);
    if (currentMedia && currentMedia.id === updatedItem.id) setCurrentMedia(updatedItem);
    
    showToast(`+1 Agregado a ${aiData.title}`, "success");
  }, [currentMedia, showToast]);

  const addToLibrary = async () => {
    if (currentMedia) {
      // Final duplicate check in case title was edited in draft mode
      const existingItem = checkDuplicate(currentMedia.aiData.title, currentMedia.aiData.mediaType);
      if (existingItem) {
          showToast(`Error: "${existingItem.aiData.title}" ya existe en la biblioteca.`, "error");
          return;
      }

      if (!library.find(i => i.id === currentMedia.id)) {
        const mediaToAdd = { ...currentMedia, lastInteraction: Date.now() };
        const newLib = [mediaToAdd, ...library];
        setLibrary(newLib);
        await saveMediaItem(mediaToAdd);
        setCurrentMedia(null);
        setSearchKey(prev => prev + 1);
        setManualTitle('');
        showToast("Agregado a la biblioteca", "success");
      }
    }
  };

  const openDetail = useCallback((item: MediaItem) => {
    setCurrentMedia(item);
    setView('details');
  }, []);

  // --- DATA MANAGEMENT & OPTIMIZATION ---

  // Helper for Smart Compression (Shared logic for export)
  const compressImageForExport = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const maxWidth = 300; // Optimal size for mobile cards
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
                // Aggressive compression for sharing (WebP q=0.7)
                resolve(canvas.toDataURL('image/webp', 0.7));
            } else {
                resolve(base64Str);
            }
        };
        img.onerror = () => resolve(""); // Remove if broken
    });
  };

  const optimizeForExport = (obj: any): any => {
      if (Array.isArray(obj)) {
          return obj.map(v => optimizeForExport(v)).filter(v => v !== null && v !== undefined);
      } else if (obj !== null && typeof obj === 'object') {
          return Object.entries(obj).reduce((acc, [key, value]) => {
              if (value === null || value === undefined) return acc;
              if (typeof value === 'string' && value.trim() === '') return acc;
              if (Array.isArray(value) && value.length === 0) return acc;
              if (key === 'coverImage' && typeof value === 'string' && value.includes('placehold.co')) {
                  return acc;
              }
              acc[key] = optimizeForExport(value);
              return acc;
          }, {} as any);
      }
      return obj;
  };

  const handleExportBackup = () => {
    if (!userProfile) return;
    const rawData = {
        profile: userProfile,
        library: library,
        version: 1,
        exportedAt: new Date().toISOString(),
        type: 'full_backup'
    };
    const optimizedData = optimizeForExport(rawData);
    const blob = new Blob([JSON.stringify(optimizedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mediatracker_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCatalog = async () => {
      setIsLoading(true);
      setLoadingMessage('Optimizando imágenes para compartir...');

      try {
          // Process library to compress images instead of stripping them
          const sanitizedLibrary = await Promise.all(library.map(async (item) => {
              let finalImage = item.aiData.coverImage || "";

              // If it's a heavy base64 string, compress it
              if (finalImage.startsWith('data:')) {
                  finalImage = await compressImageForExport(finalImage);
              }

              return {
                  ...item,
                  aiData: {
                      ...item.aiData,
                      coverImage: finalImage // Keep the visual!
                  },
                  trackingData: {
                    status: 'Sin empezar',
                    currentSeason: 1,
                    totalSeasons: item.trackingData.totalSeasons || 1,
                    watchedEpisodes: 0,
                    totalEpisodesInSeason: item.trackingData.totalEpisodesInSeason,
                    accumulated_consumption: 0,
                    emotionalTags: [],
                    favoriteCharacters: [],
                    rating: '',
                    comment: '',
                    recommendedBy: '',
                    isSaga: item.trackingData.isSaga || false,
                    finishedAt: undefined,
                    customLinks: [],
                    scheduledReturnDate: undefined,
                    nextReleaseDate: undefined,
                    is_favorite: false
                  },
                  createdAt: Date.now(),
                  lastInteraction: Date.now()
              };
          }));

          const rawData = {
              library: sanitizedLibrary,
              version: 1,
              exportedAt: new Date().toISOString(),
              type: 'catalog_share'
          };

          const optimizedData = optimizeForExport(rawData);
          const blob = new Blob([JSON.stringify(optimizedData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `mediatracker_catalog_share_${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
      } catch (error) {
          console.error("Export error", error);
          showToast("Error al exportar catálogo", "error");
      } finally {
          setIsLoading(false);
          setLoadingMessage('');
      }
  };

  const importItemsInBatch = async (items: MediaItem[], onProgress: (count: number, total: number) => void) => {
      const CHUNK_SIZE = 20; 
      let processed = 0;
      
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
          const chunk = items.slice(i, i + CHUNK_SIZE);
          await Promise.all(chunk.map(item => saveMediaItem(item)));
          processed += chunk.length;
          onProgress(Math.min(processed, items.length), items.length);
          await new Promise(resolve => setTimeout(resolve, 10));
      }
  };

  const handleImportBackup = (file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        showToast("El archivo debe ser JSON", "error");
        return;
    }

    const reader = new FileReader();
    reader.onerror = () => showToast("Error leyendo archivo", "error");

    reader.onload = async (event) => {
        try {
            const content = event.target?.result;
            if (typeof content !== 'string') return;
            const data = JSON.parse(content);

            if (!data.profile || !Array.isArray(data.library)) {
                showToast("Formato de backup inválido", "error");
                return;
            }

            setIsLoading(true);
            setLoadingMessage('Restaurando biblioteca...');
            
            try {
                await saveUserProfile(data.profile);
                await importItemsInBatch(data.library, (current, total) => {
                    setLoadingMessage(`Restaurando obras: ${current}/${total}`);
                });
                
                setUserProfile(data.profile);
                applyTheme(data.profile.accentColor);
                const updatedLibrary = await getLibrary();
                setLibrary(updatedLibrary);
                
                setIsLoading(false);
                setLoadingMessage('');
                setIsUserMenuOpen(false);
                setIsSettingsOpen(false);
                showToast("Copia de seguridad restaurada", "success");

            } catch (saveError) {
                console.error("Save error", saveError);
                showToast("Error guardando datos", "error");
                setIsLoading(false);
                setLoadingMessage('');
            }

        } catch (error) {
            console.error("JSON Parse error", error);
            showToast("Archivo corrupto", "error");
            setIsLoading(false);
            setLoadingMessage('');
        }
    };
    reader.readAsText(file);
  };

  const handleImportCatalog = (file: File) => {
      if (!file.name.endsWith('.json') && file.type !== 'application/json') {
          showToast("El archivo debe ser JSON", "error");
          return;
      }

      const reader = new FileReader();
      reader.onerror = () => showToast("Error de lectura", "error");
      
      reader.onload = async (event) => {
          try {
              const content = event.target?.result;
              if (typeof content !== 'string') return;
              const data = JSON.parse(content);
              
              if (!data.library || !Array.isArray(data.library)) {
                  showToast("Lista de obras no encontrada", "error");
                  return;
              }

              if (data.profile) {
                   setPendingImport({ library: data.library });
              } else {
                   processCatalogImport(data.library);
              }

          } catch (error) {
              console.error("Import error", error);
              showToast("Error al procesar archivo", "error");
              setIsLoading(false);
          }
      };
      reader.readAsText(file);
  };

  const processCatalogImport = async (incomingItems: MediaItem[]) => {
       setIsLoading(true);
       setLoadingMessage('Analizando obras...');
       
       const itemsToImport: MediaItem[] = [];

       for (const item of incomingItems) {
           const exists = library.some(existing => 
               existing.aiData.title.toLowerCase() === item.aiData.title.toLowerCase() && 
               existing.aiData.mediaType === item.aiData.mediaType
           );

           if (!exists) {
               const newItem: MediaItem = {
                   ...item,
                   id: uuidv4(), 
                   trackingData: {
                       ...item.trackingData,
                       status: 'Sin empezar',
                       watchedEpisodes: 0,
                       accumulated_consumption: 0,
                       rating: '',
                       emotionalTags: [],
                       favoriteCharacters: [],
                       comment: '',
                       customLinks: [],
                       is_favorite: false
                   },
                   createdAt: Date.now(),
                   lastInteraction: Date.now()
               };
               itemsToImport.push(newItem);
           }
       }
       
       if (itemsToImport.length > 0) {
            setLoadingMessage('Importando catálogo...');
            await importItemsInBatch(itemsToImport, (current, total) => {
                 setLoadingMessage(`Importando: ${current}/${total}`);
            });
       }

       const updatedLibrary = await getLibrary();
       setLibrary(updatedLibrary);
       setIsLoading(false);
       setLoadingMessage('');
       setPendingImport(null);
       setIsSettingsOpen(false);
       
       if (itemsToImport.length > 0) {
           showToast(`Se importaron ${itemsToImport.length} obras nuevas`, "success");
       } else {
           showToast("No se encontraron obras nuevas para importar", "info");
       }
  };

  const availableGenres = useMemo(() => {
    const genreSet = new Set<string>();
    library.forEach(item => {
        if (item.aiData.genres && Array.isArray(item.aiData.genres)) {
            item.aiData.genres.forEach(g => genreSet.add(normalizeGenre(g)));
        }
    });
    return Array.from(genreSet).sort();
  }, [library]);

  const filteredLibrary = useMemo(() => {
    let result = [...library];
    if (filters.query.trim()) {
      const q = filters.query.toLowerCase();
      result = result.filter(item => item.aiData.title.toLowerCase().includes(q));
    }
    if (filters.type !== 'All') result = result.filter(item => item.aiData.mediaType === filters.type);
    if (filters.status !== 'All') result = result.filter(item => item.trackingData.status === filters.status);
    if (filters.rating !== 'All') result = result.filter(item => item.trackingData.rating === filters.rating);
    if (filters.onlyFavorites) {
        result = result.filter(item => item.trackingData.is_favorite);
    }
    if (filters.genre !== 'All') {
        result = result.filter(item => 
            item.aiData.genres && item.aiData.genres.some(g => normalizeGenre(g) === filters.genre)
        );
    }
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'title': return a.aiData.title.localeCompare(b.aiData.title);
        case 'progress':
          const progA = a.trackingData.totalEpisodesInSeason > 0 ? (a.trackingData.watchedEpisodes / a.trackingData.totalEpisodesInSeason) : 0;
          const progB = b.trackingData.totalEpisodesInSeason > 0 ? (b.trackingData.watchedEpisodes / b.trackingData.totalEpisodesInSeason) : 0;
          return progB - progA;
        case 'updated': default: 
          return (b.lastInteraction || b.createdAt) - (a.lastInteraction || a.createdAt); 
      }
    });
    return result;
  }, [library, filters]);

  // Reset pagination when filters or view change
  useEffect(() => {
    setVisibleCount(24);
  }, [filters, view]);

  const upcomingLibrary = useMemo(() => {
     const now = new Date();
     return library.filter(item => {
         return item.trackingData.status === 'Planeado / Pendiente';
     }).sort((a, b) => {
         const dateAStr = a.trackingData.nextReleaseDate || a.aiData.releaseDate;
         const dateBStr = b.trackingData.nextReleaseDate || b.aiData.releaseDate;
         const dateA = dateAStr ? new Date(dateAStr) : null;
         const dateB = dateBStr ? new Date(dateBStr) : null;
         const isFutureA = dateA && !isNaN(dateA.getTime()) && dateA > now;
         const isFutureB = dateB && !isNaN(dateB.getTime()) && dateB > now;

         if (isFutureA && isFutureB) {
             return dateA!.getTime() - dateB!.getTime();
         }
         if (isFutureA) return -1;
         if (isFutureB) return 1;
         return b.createdAt - a.createdAt;
     });
  }, [library]);

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Sparkles className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!userProfile) {
      return (
        <Onboarding 
            onComplete={handleOnboardingComplete} 
            onImport={handleImportBackup} 
        />
      );
  }

  if (isLocked) {
      return (
          <LoginScreen 
            onUnlock={handleUnlock} 
            username={userProfile.username}
            avatarUrl={userProfile.avatarUrl}
            library={library}
          />
      );
  }

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
      <main className="max-w-7xl mx-auto px-4 pt-20 md:pt-24 pb-12 animate-fade-in min-h-[calc(100vh-80px)]">
         
         {/* Contextual Greeting (Only on Library/Home view) */}
         {view === 'library' && userProfile && (
             <ContextualGreeting userProfile={userProfile} library={library} view={view} />
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
                 <LibraryFilters 
                    filters={filters} 
                    onChange={setFilters} 
                    availableGenres={availableGenres}
                    viewMode={libraryViewMode}
                    onToggleViewMode={() => setLibraryViewMode(prev => prev === 'grid' ? 'catalog' : 'grid')}
                 />
                 
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
             <div className="animate-fade-in">
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
      <nav className="md:hidden fixed bottom-0 w-full bg-surface/95 backdrop-blur-xl border-t border-slate-700 z-50 pb-safe transition-all duration-300">
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
