

import React, { useMemo, useState, useEffect } from 'react';
import { MediaItem, UserProfile, RATING_TO_SCORE } from '../types';
import { BarChart2, Star, Layers, Trophy, Clock, PieChart, Timer, Crown, Zap, Settings, X, Save, Tv, BookOpen, MonitorPlay, Film, Award, Medal, Scroll, Clapperboard, Book, Layout } from 'lucide-react';

interface StatsViewProps {
  library: MediaItem[];
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
}

interface ObsessionItem {
    title: string;
    time: number;
    coverImage?: string;
}

interface StatsData {
  total: number;
  completed: number;
  onHold: number;
  watching: number;
  typeCount: Record<string, number>;
  topGenre: string;
  maxGenreCount: number;
  ratingCount: Record<string, number>;
  averageScore: string;
  highestRatedGenre: string;
  
  // New Obsession Data Structure
  maxItemsByType: Record<string, ObsessionItem>; 
  globalMaxCategory: string;

  animeEpisodes: number;
  seriesEpisodes: number;
  moviesWatched: number;
  readingChapters: number;
  bookChapters: number;
  visualTimeDisplay: string;
  readingTimeDisplay: string;
  // Consumed Items Counts
  consumedAnimes: number;
  consumedSeries: number;
  consumedMovies: number;
  consumedManhwas: number;
  consumedBooks: number;
  // Raw Minutes for calculation
  visualMinutes: number;
  readingMinutes: number;
  // New: Total consumption units for Ranking
  totalConsumptionUnits: number;
}

export const StatsView: React.FC<StatsViewProps> = ({ library, userProfile, onUpdateProfile }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Obsession Widget State
  const [obsessionTab, setObsessionTab] = useState<string>('Anime');

  const [animeDuration, setAnimeDuration] = useState(userProfile.preferences?.animeEpisodeDuration || 24);
  const [seriesDuration, setSeriesDuration] = useState(userProfile.preferences?.seriesEpisodeDuration || 45);
  const [movieDuration, setMovieDuration] = useState(userProfile.preferences?.movieDuration || 90);
  const [mangaDuration, setMangaDuration] = useState(userProfile.preferences?.mangaChapterDuration || 3);
  const [bookDuration, setBookDuration] = useState(userProfile.preferences?.bookChapterDuration || 15);

  const saveSettings = () => {
      onUpdateProfile({
          ...userProfile,
          preferences: {
              animeEpisodeDuration: animeDuration,
              seriesEpisodeDuration: seriesDuration,
              movieDuration: movieDuration,
              mangaChapterDuration: mangaDuration,
              bookChapterDuration: bookDuration
          }
      });
      setIsSettingsOpen(false);
  };

  const stats: StatsData = useMemo(() => {
    const total = library.length;
    const completed = library.filter(i => i.trackingData.status === 'Completado').length;
    const onHold = library.filter(i => i.trackingData.status === 'En Pausa').length;
    const watching = library.filter(i => i.trackingData.status === 'Viendo/Leyendo').length;

    // Type Distribution
    const typeCount: Record<string, number> = {};
    library.forEach(item => {
        const type = item.aiData.mediaType;
        typeCount[type] = (typeCount[type] || 0) + 1;
    });

    // Genre Distribution
    const genreCount: Record<string, number> = {};
    library.forEach(item => {
        item.aiData.genres.forEach(g => {
            genreCount[g] = (genreCount[g] || 0) + 1;
        });
    });
    // Find top genre
    let topGenre = 'N/A';
    let maxGenreCount = 0;
    Object.entries(genreCount).forEach(([g, count]) => {
        if (count > maxGenreCount) {
            maxGenreCount = count;
            topGenre = g;
        }
    });

    // Rating Distribution
    const ratingCount: Record<string, number> = {};
    let totalScore = 0;
    let ratedItemsCount = 0;
    const godTierGenres: Record<string, number> = {};

    library.forEach(item => {
        const r = item.trackingData.rating;
        if (r) {
            ratingCount[r] = (ratingCount[r] || 0) + 1;
            
            // Calculate Average Score
            if (RATING_TO_SCORE[r]) {
                totalScore += RATING_TO_SCORE[r];
                ratedItemsCount++;
            }

            // God Tier Genre Logic
            if (r.startsWith('God Tier')) {
                item.aiData.genres.forEach(g => {
                    godTierGenres[g] = (godTierGenres[g] || 0) + 1;
                });
            }
        }
    });

    const averageScore = ratedItemsCount > 0 ? (totalScore / ratedItemsCount).toFixed(1) : "N/A";

    let highestRatedGenre = "N/A";
    let maxGodTierCount = 0;
    Object.entries(godTierGenres).forEach(([g, count]) => {
        if (count > maxGodTierCount) {
            maxGodTierCount = count;
            highestRatedGenre = g;
        }
    });


    // --- Personal Recap (Granular) Logic ---
    const animeMin = userProfile.preferences?.animeEpisodeDuration || 24;
    const seriesMin = userProfile.preferences?.seriesEpisodeDuration || 45;
    const movieMin = userProfile.preferences?.movieDuration || 90;
    const mangaMin = userProfile.preferences?.mangaChapterDuration || 3;
    const bookMin = userProfile.preferences?.bookChapterDuration || 15;
    
    // Counters
    let animeEpisodes = 0;
    let seriesEpisodes = 0;
    let moviesWatched = 0; 
    let readingChapters = 0; 
    let bookChapters = 0;

    // Time
    let visualMinutes = 0;
    let readingMinutes = 0;
    
    // Obsession Tracking
    const maxItemsByType: Record<string, ObsessionItem> = {
        'Anime': { title: "N/A", time: 0, coverImage: '' },
        'Series': { title: "N/A", time: 0, coverImage: '' },
        'Webtoon/Manga': { title: "N/A", time: 0, coverImage: '' },
        'Libros/Novelas': { title: "N/A", time: 0, coverImage: '' }
    };

    library.forEach(item => {
        const type = item.aiData.mediaType;
        // Total Consumption = Historical (Archived) + Current Progress
        const history = item.trackingData.accumulated_consumption || 0;
        const current = item.trackingData.watchedEpisodes;

        // Calculate Total Units Consumed
        let totalEffectiveUnits = 0;
        
        if (type === 'Pelicula') {
           // For movies, we generally treat them as single units.
           const isDone = item.trackingData.status === 'Completado';
           if (isDone || current > 0) {
              totalEffectiveUnits = Math.max(1, current + history);
           }
        } else {
           // For episodic content, simple sum
           totalEffectiveUnits = current + history;
        }

        // Apply Time Logic if any progress exists
        if (totalEffectiveUnits > 0) {
            let itemTime = 0;
            let categoryKey = '';

            // Visual
            if (type === 'Anime') {
                animeEpisodes += totalEffectiveUnits;
                itemTime = totalEffectiveUnits * animeMin;
                visualMinutes += itemTime;
                categoryKey = 'Anime';
            } else if (type === 'Serie') {
                seriesEpisodes += totalEffectiveUnits;
                itemTime = totalEffectiveUnits * seriesMin; 
                visualMinutes += itemTime;
                categoryKey = 'Series';
            } else if (type === 'Pelicula') {
                moviesWatched += totalEffectiveUnits; 
                itemTime = totalEffectiveUnits * movieMin;
                visualMinutes += itemTime;
                // Movies excluded from Obsession Tracker by request
            } 
            // Reading
            else if (['Manhwa', 'Manga', 'Comic'].includes(type)) {
                readingChapters += totalEffectiveUnits;
                itemTime = totalEffectiveUnits * mangaMin;
                readingMinutes += itemTime;
                categoryKey = 'Webtoon/Manga';
            } else if (type === 'Libro') {
                bookChapters += totalEffectiveUnits;
                itemTime = totalEffectiveUnits * bookMin;
                readingMinutes += itemTime;
                categoryKey = 'Libros/Novelas';
            }

            // Update Max Item for Category
            if (categoryKey && itemTime > maxItemsByType[categoryKey].time) {
                maxItemsByType[categoryKey] = { 
                    title: item.aiData.title, 
                    time: itemTime,
                    coverImage: item.aiData.coverImage 
                };
            }
        }
    });

    // Calculate Global Max Category
    let globalMaxCategory = 'Anime'; // Default
    let globalMaxTime = 0;
    Object.entries(maxItemsByType).forEach(([cat, data]) => {
        if (data.time > globalMaxTime) {
            globalMaxTime = data.time;
            globalMaxCategory = cat;
        }
    });


    // Helper to count "Consumed" items
    const countConsumed = (types: string[]) => 
        library.filter(i => types.includes(i.aiData.mediaType) && (i.trackingData.watchedEpisodes > 0 || (i.trackingData.accumulated_consumption || 0) > 0 || i.trackingData.status === 'Completado')).length;

    const consumedAnimes = countConsumed(['Anime']);
    const consumedSeries = countConsumed(['Serie']);
    const consumedMovies = countConsumed(['Pelicula']);
    const consumedManhwas = countConsumed(['Manhwa', 'Manga', 'Comic']);
    const consumedBooks = countConsumed(['Libro']);


    const formatTime = (totalMins: number) => {
        const days = Math.floor(totalMins / (24 * 60));
        const hours = Math.floor((totalMins % (24 * 60)) / 60);
        const mins = totalMins % 60;
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    const totalConsumptionUnits = animeEpisodes + seriesEpisodes + moviesWatched + readingChapters + bookChapters;

    return { 
        total, completed, onHold, watching, typeCount, 
        topGenre, maxGenreCount, ratingCount,
        averageScore, highestRatedGenre,
        
        maxItemsByType,
        globalMaxCategory,

        // Granular
        animeEpisodes, seriesEpisodes, moviesWatched, readingChapters, bookChapters,
        visualTimeDisplay: formatTime(visualMinutes),
        readingTimeDisplay: formatTime(readingMinutes),
        consumedAnimes, consumedSeries, consumedMovies, consumedManhwas, consumedBooks,
        visualMinutes, readingMinutes,
        totalConsumptionUnits
    };
  }, [library, userProfile.preferences]);

  // Set default obsession tab to the one with max content
  useEffect(() => {
     if (stats.globalMaxCategory && stats.maxItemsByType[stats.globalMaxCategory].time > 0) {
        setObsessionTab(stats.globalMaxCategory);
     }
  }, [stats.globalMaxCategory]); // Only run when global max changes

  // --- Dynamic Rank & Achievement Logic ---
  const rankingSystem = useMemo(() => {
    const points = stats.totalConsumptionUnits;
    
    // Rank Definitions
    let rankTitle = "Explorador Novato";
    let rankColor = "text-slate-400";
    let RankIcon = Scroll;
    
    if (points > 1500) {
        rankTitle = "Maestro del Consumo";
        rankColor = "text-amber-400";
        RankIcon = Crown;
    } else if (points > 750) {
        rankTitle = "Historiador de Medios";
        rankColor = "text-purple-400";
        RankIcon = Trophy;
    } else if (points > 250) {
        rankTitle = "Coleccionista Dedicado";
        rankColor = "text-emerald-400";
        RankIcon = Award;
    } else if (points > 50) {
        rankTitle = "Aprendiz de Coleccionista";
        rankColor = "text-blue-400";
        RankIcon = Medal;
    }

    // --- Template Banks ---

    // Banco A: Foco en Tiempo (Visual vs Lectura)
    const BANK_A_TIME = [
        "Has pasado [Tiempo Visual Total] en pantallas, ¡pero no olvides que tu mente ha estado sumergida [Tiempo Lectura Total] en historias!",
        "Si sumamos todo, tu vida es arte: [Tiempo Visual Total] de cine/series y [Tiempo Lectura Total] de literatura.",
        "Tu reloj biológico marca [Tiempo Visual Total] en modo espectador y [Tiempo Lectura Total] en modo lector.",
        "Inversión de vida: [Tiempo Visual Total] viendo tramas épicas y [Tiempo Lectura Total] leyéndolas.",
        "Entre [Tiempo Visual Total] de maratones y [Tiempo Lectura Total] de lectura, eres un verdadero fan.",
        "El equilibrio es la clave: has dedicado [Tiempo Visual Total] al medio audiovisual y [Tiempo Lectura Total] al texto."
    ];

    // Banco B: Foco en Cantidad y Contraste
    const BANK_B_QUANTITY = [
        "¡Has conquistado [Total Animes] animes completos! ¿Y quién diría que has devorado [Total Capítulos de Manhwa] capítulos de manhwa?",
        "Tu lista de [Total Libros] leídos demuestra que valoras las historias largas tanto como las series cortas ([Total Series] series vistas).",
        "Desde [Total Peliculas] películas hasta [Total Manhwa] obras gráficas. Tu rango de gustos es envidiable.",
        "Has leído [Total Capítulos de Manhwa] capítulos. ¡Eso compite ferozmente con tus [Total Animes] animes vistos!",
        "La suma de [Total Series] series y [Total Libros] libros crea una base de datos narrativa en tu cabeza.",
        "Pocos pueden decir que han visto [Total Peliculas] películas y leído [Total Capítulos de Libros] capítulos de libros."
    ];

    // Banco C: Foco en Consumo Total y Rango Actual
    const BANK_C_RANK = [
        "Como [Rango Actual del Usuario], has acumulado [Tiempo Visual Total] invirtiendo en historias. ¡Mantén esa racha!",
        "Tu récord de [Total Capítulos de Manhwa] leídos te hace un experto. ¡Usa esa experiencia para honrar tu rango de [Rango Actual del Usuario]!",
        "Llevas con orgullo el título de [Rango Actual del Usuario]. Tus [Total Animes] animes completados lo demuestran.",
        "Un [Rango Actual del Usuario] no se hace en un día. [Tiempo Lectura Total] de dedicación te respaldan.",
        "Honor a quien honor merece: [Rango Actual del Usuario]. Más de [Total Consumption Units] unidades de historia consumidas.",
        "Tu estatus de [Rango Actual del Usuario] se forjó con [Total Series] series y [Total Libros] libros."
    ];

    // Rotation Logic: Select Bank randomly
    const banks = [BANK_A_TIME, BANK_B_QUANTITY, BANK_C_RANK];
    const selectedBank = banks[Math.floor(Math.random() * banks.length)];
    
    // Select Template randomly from chosen bank
    const rawTemplate = selectedBank[Math.floor(Math.random() * selectedBank.length)];

    // Replacer Function for all placeholders
    const processedMessage = rawTemplate
        .replace(/\[Total Animes\]/g, String(stats.consumedAnimes))
        .replace(/\[Total Series\]/g, String(stats.consumedSeries))
        .replace(/\[Total Peliculas\]/g, String(stats.consumedMovies))
        .replace(/\[Total Capítulos de Manhwa\]/g, String(stats.readingChapters))
        .replace(/\[Total Manhwa\]/g, String(stats.consumedManhwas))
        .replace(/\[Total Capítulos de Libros\]/g, String(stats.bookChapters))
        .replace(/\[Total Libros\]/g, String(stats.consumedBooks))
        .replace(/\[Tiempo Visual Total\]/g, stats.visualTimeDisplay)
        .replace(/\[Tiempo Lectura Total\]/g, stats.readingTimeDisplay)
        .replace(/\[Total Consumption Units\]/g, String(stats.totalConsumptionUnits))
        .replace(/\[Rango Actual del Usuario\]/g, rankTitle);

    return { rankTitle, rankColor, RankIcon, message: processedMessage };

  }, [stats]);

  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-surface border border-slate-700 p-6 rounded-2xl flex items-center justify-between hover:border-slate-500 transition-colors shadow-md">
       <div>
         <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
         <p className="text-3xl font-bold text-white mb-1 truncate max-w-[150px]" title={String(value)}>{value}</p>
         {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
       </div>
       <div className={`p-4 rounded-xl bg-opacity-10 ${color.bg} shadow-inner`}>
         <Icon className={`w-8 h-8 ${color.text}`} />
       </div>
    </div>
  );

  // Tabs Configuration
  const OBSESSION_TABS = [
      { id: 'Anime', label: 'Anime', icon: Tv },
      { id: 'Series', label: 'Series', icon: Clapperboard },
      { id: 'Webtoon/Manga', label: 'Webtoon', icon: BookOpen },
      { id: 'Libros/Novelas', label: 'Libros', icon: Book },
  ];

  const currentObsession = stats.maxItemsByType[obsessionTab];
  const hasObsessionData = currentObsession && currentObsession.time > 0;

  return (
    <div className="animate-fade-in space-y-6 pb-12 relative">
       
       <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg">
                    <BarChart2 className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-white">Mis Insights</h2>
           </div>
           <button 
             onClick={() => setIsSettingsOpen(true)}
             className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
           >
               <Settings className="w-4 h-4" />
               Configurar
           </button>
       </div>

       {/* Personal Recap Section */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           
           {/* Visual Time Card */}
           <div className="bg-gradient-to-br from-indigo-900/50 to-slate-900 border border-slate-700 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 relative z-10">
                    <MonitorPlay className="w-5 h-5 text-indigo-400" />
                    Tiempo Visual
                </h3>

                <div className="mb-6">
                    <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                        {stats.visualTimeDisplay}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">Invertidos en pantallas</p>
                </div>

                <div className="space-y-3 relative z-10">
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                        <span className="text-sm text-slate-300 flex items-center gap-2">
                            <Tv className="w-4 h-4 text-slate-500"/> Animes
                        </span>
                        <div className="text-right">
                           <span className="font-bold text-white block leading-none">{stats.consumedAnimes} <span className="text-[10px] text-slate-500 font-normal">obras</span></span>
                           <span className="text-[10px] text-slate-500">{stats.animeEpisodes} caps</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                        <span className="text-sm text-slate-300 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-slate-500"/> Series
                        </span>
                        <div className="text-right">
                           <span className="font-bold text-white block leading-none">{stats.consumedSeries} <span className="text-[10px] text-slate-500 font-normal">obras</span></span>
                           <span className="text-[10px] text-slate-500">{stats.seriesEpisodes} caps</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                        <span className="text-sm text-slate-300 flex items-center gap-2">
                            <Film className="w-4 h-4 text-slate-500"/> Películas
                        </span>
                        <span className="font-bold text-white">{stats.consumedMovies} <span className="text-[10px] text-slate-500 font-normal">vistas</span></span>
                    </div>
                </div>
           </div>

           {/* Reading Time Card */}
           <div className="bg-gradient-to-br from-emerald-900/50 to-slate-900 border border-slate-700 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 relative z-10">
                    <BookOpen className="w-5 h-5 text-emerald-400" />
                    Tiempo Lectura
                </h3>

                <div className="mb-6">
                    <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                        {stats.readingTimeDisplay}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">Sumergido en historias</p>
                </div>

                <div className="space-y-3 relative z-10">
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                        <span className="text-sm text-slate-300 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-slate-500"/> Manhwa/Manga
                        </span>
                        <div className="text-right">
                           <span className="font-bold text-white block leading-none">{stats.consumedManhwas} <span className="text-[10px] text-slate-500 font-normal">obras</span></span>
                           <span className="text-[10px] text-slate-500">{stats.readingChapters} caps</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                        <span className="text-sm text-slate-300 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-slate-500"/> Libros/Novelas
                        </span>
                        <div className="text-right">
                           <span className="font-bold text-white block leading-none">{stats.consumedBooks} <span className="text-[10px] text-slate-500 font-normal">obras</span></span>
                           <span className="text-[10px] text-slate-500">{stats.bookChapters} págs</span>
                        </div>
                    </div>
                     {/* Spacer to align heights if needed */}
                     <div className="h-[38px] opacity-0"></div>
                </div>
           </div>

       </div>

       {/* Dynamic Obsession Tracker Widget */}
       <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-md transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                     <span className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                         <Zap className="w-4 h-4 text-yellow-500" /> Tu Mayor Obsesión
                     </span>
                     <p className="text-sm text-slate-400 mt-1">Basado en tiempo total consumido</p>
                </div>
                
                {/* Dynamic Selector Tabs - Replaced overflow-x-auto with grid to prevent mobile scrolling */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-900 p-1 rounded-lg">
                    {OBSESSION_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = obsessionTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setObsessionTab(tab.id)}
                                className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                    isActive 
                                    ? 'bg-primary text-white shadow' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                            >
                                <Icon className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Obsession Card with Background Image */}
            <div className="relative rounded-xl border border-slate-700/50 overflow-hidden shadow-lg transition-all min-h-[120px]">
                {/* Background Image Layer */}
                <div className="absolute inset-0 z-0">
                    {hasObsessionData && currentObsession.coverImage ? (
                        <>
                            <img 
                                src={currentObsession.coverImage} 
                                alt="" 
                                className="w-full h-full object-cover" 
                            />
                            {/* Dark Overlay for text readability */}
                            <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-[2px]"></div>
                            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/90 to-transparent"></div>
                        </>
                    ) : (
                         <div className="w-full h-full bg-slate-900/50"></div>
                    )}
                </div>

                {/* Content Layer */}
                <div className="relative z-10 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                     {hasObsessionData ? (
                         <>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center border border-slate-600 shadow-inner shrink-0 backdrop-blur-sm">
                                    {obsessionTab.includes('Libro') || obsessionTab.includes('Webtoon') ? (
                                        <BookOpen className="w-6 h-6 text-emerald-400" />
                                    ) : (
                                        <Clapperboard className="w-6 h-6 text-indigo-400" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white leading-tight drop-shadow-md">{currentObsession.title}</h3>
                                    <p className="text-xs text-slate-400 mt-1 font-medium">Categoría: {obsessionTab}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-lg border border-white/10 shrink-0 backdrop-blur-md">
                                 <Clock className="w-5 h-5 text-yellow-500" />
                                 <span className="text-lg font-mono font-bold text-white">
                                     {(currentObsession.time / 60).toFixed(1)}h
                                 </span>
                            </div>
                         </>
                     ) : (
                         <div className="w-full text-center py-4 opacity-50 flex flex-col items-center">
                             <Layout className="w-8 h-8 text-slate-500 mb-2" />
                             <p className="text-sm font-medium text-slate-400">Sin suficientes datos en {obsessionTab}.</p>
                             <p className="text-xs text-slate-600">Comienza a registrar tu progreso para ver estadísticas.</p>
                         </div>
                     )}
                </div>
            </div>
       </div>

       {/* KPIs Row */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
             title="Total Obras" 
             value={stats.total} 
             icon={Layers} 
             color={{ bg: 'bg-blue-500', text: 'text-blue-500' }} 
          />
          <StatCard 
             title="Completados" 
             value={stats.completed} 
             subtext={`${Math.round((stats.completed / (stats.total || 1)) * 100)}% del total`}
             icon={Trophy} 
             color={{ bg: 'bg-green-500', text: 'text-green-500' }} 
          />
           <StatCard 
             title="Calificación Prom." 
             value={stats.averageScore === "N/A" ? "-" : stats.averageScore} 
             subtext={stats.averageScore === "N/A" ? "" : "sobre 10"}
             icon={Zap} 
             color={{ bg: 'bg-yellow-500', text: 'text-yellow-500' }} 
          />
           <StatCard 
             title="Género Top" 
             value={stats.topGenre} 
             icon={Star} 
             color={{ bg: 'bg-purple-500', text: 'text-purple-500' }} 
          />
       </div>

       {/* Charts Row */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Type Distribution */}
          <div className="bg-surface border border-slate-700 p-6 rounded-2xl shadow-lg">
             <div className="flex items-center gap-2 mb-6">
                <PieChart className="w-5 h-5 text-slate-400" />
                <h3 className="text-lg font-bold text-white">Por Tipo de Contenido</h3>
             </div>
             
             {Object.keys(stats.typeCount).length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No hay datos aún.</p>
             ) : (
                <div className="space-y-4">
                    {Object.entries(stats.typeCount).map(([type, count]) => {
                      const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                      return (
                        <div key={type}>
                            <div className="flex justify-between text-sm mb-1.5">
                                <span className="text-slate-300 font-medium">{type}</span>
                                <span className="text-slate-500 font-mono">{count}</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                <div 
                                className="bg-primary h-2.5 rounded-full transition-all duration-1000" 
                                style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </div>
                      );
                    })}
                </div>
             )}
          </div>

           {/* Rating Distribution */}
          <div className="bg-surface border border-slate-700 p-6 rounded-2xl shadow-lg flex flex-col">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-slate-400" />
                    <h3 className="text-lg font-bold text-white">Calificaciones</h3>
                </div>
                {stats.highestRatedGenre !== "N/A" && (
                    <span className="text-[10px] bg-slate-800 text-yellow-400 border border-yellow-400/30 px-2 py-1 rounded-md">
                        Top Género: {stats.highestRatedGenre}
                    </span>
                )}
             </div>

             {Object.keys(stats.ratingCount).length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No hay calificaciones registradas.</p>
             ) : (
                <div className="space-y-4 flex-grow overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                    {Object.entries(stats.ratingCount)
                        .sort((a, b) => b[1] - a[1]) // Sort by count desc
                        .map(([rating, count]) => {
                            const label = rating.split('(')[0].trim();
                            // Color logic for ratings
                            let barColor = 'bg-secondary';
                            if (rating.includes('God Tier') || rating.includes('Maestra')) barColor = 'bg-yellow-500';
                            if (rating.includes('Malo') || rating.includes('Basura')) barColor = 'bg-red-500';
                            
                            const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;

                            return (
                                <div key={rating}>
                                    <div className="flex justify-between text-sm mb-1.5">
                                        <span className="text-slate-300 font-medium truncate max-w-[80%]" title={rating}>{label}</span>
                                        <span className="text-slate-500 font-mono">{count}</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                        <div 
                                        className={`${barColor} h-2.5 rounded-full transition-all duration-1000`} 
                                        style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                </div>
             )}
          </div>
       </div>

       {/* Ranking & Achievement Banner (Dynamic) */}
       {stats.totalConsumptionUnits > 0 && (
           <div 
             className="w-full bg-slate-900 border border-slate-700 rounded-xl p-8 text-center relative overflow-hidden transition-all duration-500 hover:border-slate-500"
             style={{ borderColor: userProfile.accentColor ? '#' + userProfile.accentColor.split(' ')[0] + '40' : '#6366f140' }}
           >
               {/* Decorative Elements */}
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 opacity-50"></div>
               <div className="absolute top-4 left-4 text-slate-700 opacity-20"><rankingSystem.RankIcon className="w-16 h-16" /></div>
               <div className="absolute bottom-4 right-4 text-slate-700 opacity-20"><rankingSystem.RankIcon className="w-16 h-16" /></div>

               <div className="relative z-10 max-w-2xl mx-auto">
                   <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 shadow-xl mb-4 ${rankingSystem.rankColor}`}>
                       <rankingSystem.RankIcon className="w-4 h-4" />
                       <span className="text-xs font-bold uppercase tracking-widest">{rankingSystem.rankTitle}</span>
                   </div>
                   <h2 className="text-xl md:text-2xl font-bold text-slate-200 mb-3 leading-tight italic">
                       "{rankingSystem.message}"
                   </h2>
                   <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden max-w-xs mx-auto">
                        <div 
                           className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                           style={{ width: `${Math.min(100, (stats.totalConsumptionUnits % 250) / 2.5)}%` }} // Simple visual progress per tier
                        />
                   </div>
                   <p className="text-slate-500 text-[10px] mt-2 font-mono">
                       Unidades Consumidas: {stats.totalConsumptionUnits}
                   </p>
               </div>
           </div>
       )}

       {/* Settings Modal */}
       {isSettingsOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-surface border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                   <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
                       <h3 className="text-lg font-bold text-white flex items-center gap-2">
                           <Timer className="w-5 h-5 text-primary" />
                           Configurar Tiempos
                       </h3>
                       <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white">
                           <X className="w-5 h-5" />
                       </button>
                   </div>
                   <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                       <p className="text-sm text-slate-400 mb-2">
                           Ajusta la duración promedio (minutos) para calcular tus estadísticas de tiempo.
                       </p>
                       
                       <div className="space-y-1">
                           <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider">Visual</label>
                           <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Episodio Anime</label>
                                    <input 
                                        type="number" min="1" value={animeDuration}
                                        onChange={(e) => setAnimeDuration(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Episodio Serie</label>
                                    <input 
                                        type="number" min="1" value={seriesDuration}
                                        onChange={(e) => setSeriesDuration(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Película</label>
                                    <input 
                                        type="number" min="1" value={movieDuration}
                                        onChange={(e) => setMovieDuration(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                                    />
                                </div>
                           </div>
                       </div>

                       <div className="space-y-1 pt-2">
                           <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider">Lectura</label>
                           <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Cap. Manhwa/Manga</label>
                                    <input 
                                        type="number" min="1" value={mangaDuration}
                                        onChange={(e) => setMangaDuration(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Cap. Libro/Novela</label>
                                    <input 
                                        type="number" min="1" value={bookDuration}
                                        onChange={(e) => setBookDuration(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                                    />
                                </div>
                           </div>
                       </div>

                       <button 
                         onClick={saveSettings}
                         className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg mt-4"
                       >
                           <Save className="w-4 h-4" />
                           Guardar Cambios
                       </button>
                   </div>
               </div>
           </div>
       )}

    </div>
  );
};
