
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
import { ContextualGreeting } from './components/ContextualGreeting'; // Import ContextualGreeting
import { searchMediaInfo } from './services/geminiService';
import { getLibrary, saveMediaItem, getUserProfile, saveUserProfile, initDB, deleteMediaItem } from './services/storage';
import { MediaItem, UserProfile, normalizeGenre } from './types';
import { useToast } from './context/ToastContext';
import { LayoutGrid, Sparkles, PlusCircle, ArrowLeft, User, BarChart2, AlertCircle, Trash2, Download, Upload, ChevronDown, Settings, Compass, CalendarClock, Bookmark, Search, GitMerge, Loader2 } from 'lucide-react';
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

  // Import Merge Confirmation State
  const [pendingImport, setPendingImport] = useState<{ library: MediaItem[] } | null>(null);

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
      setSearchError("Hubo un error de conexión buscando la información. Intenta de nuevo.");
      showToast("Error de conexión con IA", "error");
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpdateMedia = async (updatedItem: MediaItem) => {
    // Only update the state and DB. 
    // The timestamp logic for lastInteraction is now handled by the caller (MediaCard) 
    // to strictly track consumption events only.
    
    setCurrentMedia(updatedItem);
    
    const itemExists = library.some(i => i.id === updatedItem.id);
    if (itemExists) {
        setLibrary(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        await saveMediaItem(updatedItem);
    }
  };

  const handleToggleFavorite = async (item: MediaItem) => {
      const updatedTracking = {
          ...item.trackingData,
          is_favorite: !item.trackingData.is_favorite
      };
      const updatedItem = {
          ...item,
          trackingData: updatedTracking,
          lastInteraction: item.lastInteraction // Preserve timestamp, toggling favorite is not a consumption event
      };
      
      // Update Library state immediately
      setLibrary(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      
      // If currently viewing details, update currentMedia
      if (currentMedia && currentMedia.id === updatedItem.id) {
          setCurrentMedia(updatedItem);
      }

      await saveMediaItem(updatedItem);
      
      if (updatedTracking.is_favorite) {
          showToast("Añadido a Favoritos ⭐", "success");
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
          showToast("Obra eliminada", "info");
      }
  };

  const cancelDelete = () => setDeleteTarget(null);

  const handleQuickIncrement = async (item: MediaItem) => {
    // covers: "Clic en +1 Visto/Leído"
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
                // ARCHIVE PROGRESS WHEN AUTO-INCREMENTING SEASON
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
        // If it was "Sin empezar", change to "Viendo/Leyendo" on first increment
        if (updatedTracking.status === 'Sin empezar') {
            updatedTracking.status = 'Viendo/Leyendo';
        }
    }

    // Update timestamp strictly - Quick Increment is always a consumption event
    const updatedItem = { 
        ...item, 
        trackingData: updatedTracking,
        lastInteraction: Date.now() 
    };
    
    setLibrary(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    await saveMediaItem(updatedItem);
    if (currentMedia && currentMedia.id === updatedItem.id) setCurrentMedia(updatedItem);
    
    showToast(`+1 Agregado a ${aiData.title}`, "success");
  };

  const addToLibrary = async () => {
    if (currentMedia && !library.find(i => i.id === currentMedia.id)) {
      // Ensure timestamp is set when adding initially
      const mediaToAdd = { ...currentMedia, lastInteraction: Date.now() };
      
      const newLib = [mediaToAdd, ...library];
      setLibrary(newLib);
      await saveMediaItem(mediaToAdd);
      
      // Clear the search view and reset the search bar
      setCurrentMedia(null);
      setSearchKey(prev => prev + 1);
      showToast("Agregado a la biblioteca", "success");
    }
  };

  const openDetail = (item: MediaItem) => {
    setCurrentMedia(item);
    setView('details');
  };

  // --- DATA MANAGEMENT & OPTIMIZATION ---

  // OPTIMIZATION HELPER: Removes nulls, undefined, and empty strings recursively
  // Also filters out placeholder images to save space
  const optimizeForExport = (obj: any): any => {
      if (Array.isArray(obj)) {
          return obj.map(v => optimizeForExport(v)).filter(v => v !== null && v !== undefined);
      } else if (obj !== null && typeof obj === 'object') {
          return Object.entries(obj).reduce((acc, [key, value]) => {
              // Skip null/undefined
              if (value === null || value === undefined) return acc;
              // Skip empty strings
              if (typeof value === 'string' && value.trim() === '') return acc;
              // Skip empty arrays
              if (Array.isArray(value) && value.length === 0) return acc;

              // IMAGE OPTIMIZATION: Do not export placeholder images
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

    // Apply optimization
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

  const handleExportCatalog = () => {
      // Exports only library data, STRIPPING personal data
      const sanitizedLibrary = library.map(item => ({
          ...item,
          // KEEP AI Data (Public info)
          aiData: item.aiData,
          // RESET Tracking Data (Sensitive info)
          trackingData: {
            status: 'Sin empezar', // Reset
            currentSeason: 1,
            totalSeasons: item.trackingData.totalSeasons || 1, // Keep structural structure
            watchedEpisodes: 0, // Reset
            totalEpisodesInSeason: item.trackingData.totalEpisodesInSeason, // Keep structure
            accumulated_consumption: 0,
            emotionalTags: [], // Remove
            favoriteCharacters: [], // Remove
            rating: '', // Remove
            comment: '', // Remove
            recommendedBy: '', // Remove
            isSaga: item.trackingData.isSaga || false, // Keep structural
            finishedAt: undefined,
            customLinks: [], // Remove user links
            scheduledReturnDate: undefined,
            nextReleaseDate: undefined,
            is_favorite: false // Reset favorite
          },
          // Update Timestamps for the export
          createdAt: Date.now(),
          lastInteraction: Date.now()
      }));

      const rawData = {
          library: sanitizedLibrary,
          version: 1,
          exportedAt: new Date().toISOString(),
          type: 'catalog_share' // Marker to identify this is just a list
      };

      // Apply Optimization
      const optimizedData = optimizeForExport(rawData);

      const blob = new Blob([JSON.stringify(optimizedData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mediatracker_catalog_share_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // BATCH IMPORT HELPER to prevent UI Freeze
  const importItemsInBatch = async (items: MediaItem[], onProgress: (count: number, total: number) => void) => {
      const CHUNK_SIZE = 20; // Process 20 items at a time
      let processed = 0;
      
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
          const chunk = items.slice(i, i + CHUNK_SIZE);
          
          // Save chunk in parallel
          await Promise.all(chunk.map(item => saveMediaItem(item)));
          
          processed += chunk.length;
          onProgress(Math.min(processed, items.length), items.length);
          
          // YIELD TO MAIN THREAD: Allow UI to update
          await new Promise(resolve => setTimeout(resolve, 10));
      }
  };

  const handleImportBackup = (file: File) => {
    console.log("Starting backup import for file:", file.name);
    
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
                
                // Use Batch Import
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
      console.log("Starting catalog import:", file.name);
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

              // Check if it's a full backup trying to be imported as catalog
              if (data.profile) {
                   setPendingImport({ library: data.library });
                   // The modal will handle the confirmation now
              } else {
                   // Direct import if it's just a catalog
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

       // Pre-filter duplicates to save time during batch write
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
       setPendingImport(null); // Clear modal state
       setIsSettingsOpen(false);
       
       if (itemsToImport.length > 0) {
           showToast(`Se importaron ${itemsToImport.length} obras nuevas`, "success");
       } else {
           showToast("No se encontraron obras nuevas para importar", "info");
       }
  };


  // Calculate unique genres from library, normalized
  const availableGenres = useMemo(() => {
    const genreSet = new Set<string>();
    library.forEach(item => {
        if (item.aiData.genres && Array.isArray(item.aiData.genres)) {
            // Normalize every genre found in the library to ensure unique list
            item.aiData.genres.forEach(g => genreSet.add(normalizeGenre(g)));
        }
    });
    return Array.from(genreSet).sort();
  }, [library]);


  // Filter Logic for Main Library
  const filteredLibrary = useMemo(() => {
    let result = [...library];
    
    // Text Search
    if (filters.query.trim()) {
      const q = filters.query.toLowerCase();
      result = result.filter(item => item.aiData.title.toLowerCase().includes(q));
    }
    
    // Dropdown Filters
    if (filters.type !== 'All') result = result.filter(item => item.aiData.mediaType === filters.type);
    if (filters.status !== 'All') result = result.filter(item => item.trackingData.status === filters.status);
    if (filters.rating !== 'All') result = result.filter(item => item.trackingData.rating === filters.rating);
    
    // Favorite Filter
    if (filters.onlyFavorites) {
        result = result.filter(item => item.trackingData.is_favorite);
    }

    // Genre Filter - Normalized Comparison
    if (filters.genre !== 'All') {
        result = result.filter(item => 
            // Normalize items genres before checking includes
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
          // Updated default sort to use lastInteraction primarily
          return (b.lastInteraction || b.createdAt) - (a.lastInteraction || a.createdAt); 
      }
    });
    return result;
  }, [library, filters]);

  // Filter Logic for Wishlist / Upcoming / Backlog
  const upcomingLibrary = useMemo(() => {
     const now = new Date();
     return library.filter(item => {
         // Show EVERYTHING that is Planned, regardless of date presence
         return item.trackingData.status === 'Planeado / Pendiente';
     }).sort((a, b) => {
         // Sort Strategy:
         // 1. Items with FUTURE dates come first (sorted ascending, nearest first)
         // 2. Items with PAST dates or NO dates come after
         
         // Use the specific user tracking date if available, otherwise AI date
         const dateAStr = a.trackingData.nextReleaseDate || a.aiData.releaseDate;
         const dateBStr = b.trackingData.nextReleaseDate || b.aiData.releaseDate;
         
         const dateA = dateAStr ? new Date(dateAStr) : null;
         const dateB = dateBStr ? new Date(dateBStr) : null;
         
         const isFutureA = dateA && !isNaN(dateA.getTime()) && dateA > now;
         const isFutureB = dateB && !isNaN(dateB.getTime()) && dateB > now;

         if (isFutureA && isFutureB) {
             return dateA!.getTime() - dateB!.getTime(); // Both future: Nearest first
         }
         if (isFutureA) return -1; // A is future, B is not -> A first
         if (isFutureB) return 1;  // B is future, A is not -> B first

         // If neither are future (both null, or both past), sort by creation date desc (newly added first)
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

  // --- RENDER GATES ---

  if (!userProfile) {
      return (
        <Onboarding 
            onComplete={handleOnboardingComplete} 
            onImport={handleImportBackup} // Pass import function to onboarding
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
      
      {/* GLOBAL LOADING OVERLAY (IMPORTS / BACKUPS ONLY) */}
      {isLoading && (
          <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-white font-bold text-lg animate-pulse">{loadingMessage || 'Cargando...'}</p>
          </div>
      )}

      {/* Settings Modal */}
      <SettingsModal 
         isOpen={isSettingsOpen} 
         onClose={() => setIsSettingsOpen(false)} 
         userProfile={userProfile}
         onUpdateProfile={handleUpdateUserProfile}
         onExportBackup={handleExportBackup}
         onImportBackup={handleImportBackup}
         onExportCatalog={handleExportCatalog}
         onImportCatalog={handleImportCatalog}
      />

      {/* Header */}
      <header className="bg-surface/80 backdrop-blur-md border-b border-slate-700 sticky top-0 z-40 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo / Left Section (Desktop: Logo, Mobile: Avatar/User) */}
          <div className="flex items-center gap-2">
             {/* Desktop Logo */}
             <div className="hidden md:flex items-center gap-2 cursor-pointer group" onClick={() => setView('library')}>
                <div className="w-8 h-8 bg-gradient-to-tr from-primary to-secondary rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform">
                  <Sparkles className="text-white w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                  MediaTracker AI
                </h1>
             </div>

             {/* Mobile User Profile (Left aligned) */}
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
          
          {/* Right Section */}
          <div className="flex items-center gap-4">
            
            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-2 mr-2">
              <button 
                onClick={() => {
                    setView('search');
                    setCurrentMedia(null);
                    setSearchKey(prev => prev + 1);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'search' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
                title="Nuevo"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nuevo</span>
              </button>
              <button 
                onClick={() => setView('library')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'library' || view === 'details' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
                title="Biblioteca"
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Biblioteca</span>
              </button>
              <button 
                onClick={() => setView('upcoming')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'upcoming' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
                title="Wishlist / Pendientes"
              >
                <Bookmark className="w-4 h-4" />
                <span>Wishlist</span>
              </button>
              <button 
                onClick={() => setView('discovery')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'discovery' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
                title="Descubrir"
              >
                <Compass className="w-4 h-4" />
                <span>Descubrir</span>
              </button>
              <button 
                onClick={() => setView('stats')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${view === 'stats' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-white'}`}
                title="Estadísticas"
              >
                <BarChart2 className="w-4 h-4" />
                <span>Stats</span>
              </button>
            </nav>

            {/* Desktop User Menu / Mobile Settings Button */}
            <div className="relative border-l border-slate-700 pl-4 ml-2 flex items-center">
                 {/* Desktop Dropdown */}
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
                 
                 {/* Mobile Settings Icon (Right aligned) */}
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

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-slate-700 z-50 flex justify-around px-2 py-2 shadow-2xl">
         <button 
           onClick={() => {
                setView('search');
                setCurrentMedia(null);
                setSearchKey(prev => prev + 1);
            }}
           className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${view === 'search' ? 'text-primary' : 'text-slate-500'}`}
         >
            <Search className="w-6 h-6" />
            <span className="text-[10px] font-medium">Buscar</span>
         </button>
         <button 
           onClick={() => setView('library')}
           className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${view === 'library' || view === 'details' ? 'text-primary' : 'text-slate-500'}`}
         >
            <LayoutGrid className="w-6 h-6" />
            <span className="text-[10px] font-medium">Colección</span>
         </button>
         <button 
           onClick={() => setView('upcoming')}
           className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${view === 'upcoming' ? 'text-primary' : 'text-slate-500'}`}
         >
            <Bookmark className="w-6 h-6" />
            <span className="text-[10px] font-medium">Wishlist</span>
         </button>
         <button 
           onClick={() => setView('discovery')}
           className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${view === 'discovery' ? 'text-primary' : 'text-slate-500'}`}
         >
            <Compass className="w-6 h-6" />
            <span className="text-[10px] font-medium">Descubrir</span>
         </button>
         <button 
           onClick={() => setView('stats')}
           className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${view === 'stats' ? 'text-primary' : 'text-slate-500'}`}
         >
            <BarChart2 className="w-6 h-6" />
            <span className="text-[10px] font-medium">Stats</span>
         </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow pt-6 md:pt-8 min-h-[calc(100vh-64px)]">
        
        {/* Persistent Contextual Greeting */}
        <ContextualGreeting userProfile={userProfile} library={library} view={view} />

        {/* VIEW: SEARCH (Home) */}
        {view === 'search' && (
           <div className="w-full max-w-5xl mx-auto px-2 animate-fade-in">
              
              <div className="text-center mb-8">
                 <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
                    ¿Qué historia descubriste hoy?
                 </h2>
                 <p className="text-slate-400">Agrega anime, series, películas o libros a tu colección.</p>
              </div>

              {/* SEARCH BAR receives isSearching (local state) */}
              <SearchBar key={searchKey} onSearch={handleSearch} isLoading={isSearching} />
              
              {searchError && (
                <div className="max-w-xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 animate-fade-in">
                   <AlertCircle className="w-5 h-5 flex-shrink-0" />
                   <p className="text-sm font-medium">{searchError}</p>
                </div>
              )}

              {currentMedia && !library.find(i => i.id === currentMedia.id) && (
                <div className="animate-fade-in-up pb-10">
                   <div className="flex justify-between items-center mb-4 px-2">
                      <h3 className="text-xl font-bold text-white">Resultado de Búsqueda</h3>
                      <button 
                        onClick={addToLibrary}
                        className="bg-primary hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-1 flex items-center gap-2"
                      >
                         <PlusCircle className="w-5 h-5" />
                         Agregar a Biblioteca
                      </button>
                   </div>
                   <MediaCard 
                      item={currentMedia} 
                      onUpdate={handleUpdateMedia} 
                      isNew={true}
                      username={userProfile.username}
                      apiKey={userProfile.apiKey}
                   />
                </div>
              )}
           </div>
        )}

        {/* VIEW: LIBRARY */}
        {view === 'library' && (
           <div className="w-full max-w-7xl mx-auto px-4 animate-fade-in pb-10">
              <LibraryFilters 
                 filters={filters} 
                 onChange={setFilters} 
                 availableGenres={availableGenres}
              />
              
              {filteredLibrary.length === 0 ? (
                 <div className="text-center py-20 text-slate-500">
                    <LayoutGrid className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg">No se encontraron obras con estos filtros.</p>
                    {filters.onlyFavorites && <p className="text-sm mt-1 text-yellow-500/70">Estás viendo solo favoritos.</p>}
                    <button onClick={() => setView('search')} className="text-primary hover:underline mt-2">Agregar nueva obra</button>
                 </div>
              ) : (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                    {filteredLibrary.map(item => (
                       <CompactMediaCard 
                          key={item.id} 
                          item={item} 
                          onClick={() => openDetail(item)}
                          onIncrement={handleQuickIncrement}
                          onToggleFavorite={handleToggleFavorite}
                       />
                    ))}
                 </div>
              )}
           </div>
        )}

        {/* VIEW: DETAILS */}
        {view === 'details' && currentMedia && (
           <div className="w-full px-2 py-4 animate-fade-in">
              <div className="max-w-5xl mx-auto mb-4 flex items-center gap-2">
                 <button 
                   onClick={() => setView('library')}
                   className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-800"
                 >
                    <ArrowLeft className="w-5 h-5" />
                    Volver
                 </button>
              </div>
              <MediaCard 
                 item={currentMedia} 
                 onUpdate={handleUpdateMedia} 
                 onDelete={() => handleDeleteRequest(currentMedia)}
                 username={userProfile.username}
                 apiKey={userProfile.apiKey}
              />
           </div>
        )}

        {/* VIEW: STATS */}
        {view === 'stats' && (
            <div className="w-full max-w-7xl mx-auto px-4 py-6 animate-fade-in">
                <StatsView 
                    library={library} 
                    userProfile={userProfile} 
                    onUpdateProfile={handleUpdateUserProfile}
                />
            </div>
        )}

        {/* VIEW: DISCOVERY */}
        {view === 'discovery' && (
            <div className="w-full max-w-7xl mx-auto px-4 py-6 animate-fade-in">
                <DiscoveryView 
                    library={library}
                    apiKey={userProfile.apiKey}
                    onSelectRecommendation={(title) => {
                        handleSearch(title);
                    }}
                />
            </div>
        )}

        {/* VIEW: UPCOMING / WISHLIST */}
        {view === 'upcoming' && (
            <div className="w-full max-w-7xl mx-auto px-4 py-6 animate-fade-in pb-10">
                <div className="flex items-center gap-3 mb-6">
                     <Bookmark className="w-6 h-6 text-yellow-500" />
                     <h2 className="text-2xl font-bold text-white">Lista de Deseos & Próximos Estrenos</h2>
                </div>
                
                {upcomingLibrary.length === 0 ? (
                    <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-slate-700 border-dashed">
                        <CalendarClock className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                        <p className="text-slate-400 text-lg">No tienes items marcados como "Planeado / Pendiente".</p>
                        <p className="text-slate-500 text-sm mt-2">Cambia el estado de una obra a 'Planeado' para verla aquí.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                        {upcomingLibrary.map(item => (
                            <CompactMediaCard 
                                key={item.id} 
                                item={item} 
                                onClick={() => openDetail(item)}
                                onIncrement={handleQuickIncrement}
                                onToggleFavorite={handleToggleFavorite}
                            />
                        ))}
                    </div>
                )}
            </div>
        )}

      </main>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-surface border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-fade-in-up">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                        <Trash2 className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">¿Eliminar Obra?</h3>
                    <p className="text-slate-400 mb-6 text-sm">
                        Estás a punto de eliminar <span className="text-white font-bold">"{deleteTarget.aiData.title}"</span>. 
                        Esta acción no se puede deshacer y perderás todo el progreso registrado.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={cancelDelete}
                            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-bold shadow-lg shadow-red-600/20"
                        >
                            Eliminar
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Import Merge Confirmation Modal */}
      {pendingImport && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
             <div className="bg-surface border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-md w-full animate-fade-in-up">
                 <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
                        <GitMerge className="w-6 h-6 text-yellow-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Fusión de Copia de Seguridad</h3>
                    <p className="text-slate-400 mb-6 text-sm">
                        Este archivo es un backup completo (incluye perfil). 
                        ¿Deseas <strong>ignorar el perfil</strong> e importar solo las 
                        <strong className="text-white"> {pendingImport.library.length} obras </strong> 
                        para fusionarlas con tu biblioteca actual?
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setPendingImport(null)}
                            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={() => processCatalogImport(pendingImport.library)}
                            className="flex-1 px-4 py-2 bg-primary hover:bg-indigo-600 text-white rounded-lg transition-colors font-bold shadow-lg"
                        >
                            Sí, fusionar
                        </button>
                    </div>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
}
