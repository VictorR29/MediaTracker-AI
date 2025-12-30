
import React, { useMemo, useState, useEffect } from 'react';
import { MediaItem, UserProfile, RATING_TO_SCORE, normalizeGenre } from '../types';
import { BarChart2, Star, Layers, Trophy, Clock, PieChart, Timer, Crown, Zap, Settings, X, Save, Tv, BookOpen, MonitorPlay, Film, Award, Medal, Scroll, Clapperboard, Book, Layout, Hash, Heart } from 'lucide-react';

interface StatsViewProps {
  library: MediaItem[];
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
}

interface ObsessionItem {
    id: string;
    title: string;
    time: number; // In minutes
    coverImage?: string;
    primaryColor?: string;
    unitCount: number; // Episodes or Chapters
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
  
  // New Obsession Data Structure: Top 3 per category
  topItemsByType: Record<string, ObsessionItem[]>; 
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

  // New: Distribution Data Maps (Minutes per Tag)
  genreConsumption: Record<string, number>;
  emotionConsumption: Record<string, number>;
}

// Helper to Capitalize Title Case nicely (e.g. "ciencia ficción" -> "Ciencia Ficción")
const toTitleCase = (str: string) => {
  return str.toLowerCase().replace(/(?:^|\s)\w/g, function(match) {
      return match.toUpperCase();
  });
};

export const StatsView: React.FC<StatsViewProps> = ({ library, userProfile, onUpdateProfile }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Obsession Widget State
  const [obsessionTab, setObsessionTab] = useState<string>('Anime');

  // Consumption Distribution Widget State
  const [distributionAxis, setDistributionAxis] = useState<'genre' | 'emotion'>('genre');

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

  const formatTime = (totalMins: number) => {
        const days = Math.floor(totalMins / (24 * 60));
        const hours = Math.floor((totalMins % (24 * 60)) / 60);
        const mins = totalMins % 60;
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
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

    // Genre Distribution (Count based) - Normalized
    const genreCount: Record<string, number> = {};
    library.forEach(item => {
        const genres = item.aiData.genres || [];
        genres.forEach(g => {
            const normalizedKey = normalizeGenre(g); // Use helper from types to ensure 'Acción' == 'acción'
            genreCount[normalizedKey] = (genreCount[normalizedKey] || 0) + 1;
        });
    });
    // Find top genre
    let topGenre = 'N/A';
    let maxGenreCount = 0;
    Object.entries(genreCount).forEach(([g, count]) => {
        if (count > maxGenreCount) {
            maxGenreCount = count;
            topGenre = toTitleCase(g);
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
                const genres = item.aiData.genres || [];
                genres.forEach(g => {
                    const normalizedKey = normalizeGenre(g);
                    godTierGenres[normalizedKey] = (godTierGenres[normalizedKey] || 0) + 1;
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
            highestRatedGenre = toTitleCase(g);
        }
    });


    // --- Personal Recap (Granular) Logic ---
    const animeMin = animeDuration;
    const seriesMin = seriesDuration;
    const movieMin = movieDuration;
    const mangaMin = mangaDuration;
    const bookMin = bookDuration;
    
    // Counters
    let animeEpisodes = 0;
    let seriesEpisodes = 0;
    let moviesWatched = 0; 
    let readingChapters = 0; 
    let bookChapters = 0;

    // Time
    let visualMinutes = 0;
    let readingMinutes = 0;
    
    // Maps for Distribution Widget
    const genreConsumption: Record<string, number> = {};
    const emotionConsumption: Record<string, number> = {};

    // Raw Collection for Sorting Top 3
    const rawItemsByType: Record<string, ObsessionItem[]> = {
        'Anime': [],
        'Series': [],
        'Webtoon/Manga': [],
        'Libros/Novelas': []
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
                // Movies excluded from Obsession Tracker by request/logic usually
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

            // --- Distribution Logic (New with Strict Normalization) ---
            if (itemTime > 0) {
                // Axis 1: Genres
                const genres = item.aiData.genres || [];
                genres.forEach(g => {
                    const normalized = normalizeGenre(g);
                    const label = toTitleCase(normalized); // Enforce consistent casing
                    genreConsumption[label] = (genreConsumption[label] || 0) + itemTime;
                });
                
                // Axis 2: Emotions
                const emotions = item.trackingData.emotionalTags || [];
                emotions.forEach(t => {
                    // Normalize emotions too just in case (trim + title case)
                    const label = toTitleCase(t.trim());
                    emotionConsumption[label] = (emotionConsumption[label] || 0) + itemTime;
                });
            }

            // Push to raw collection for sorting
            if (categoryKey) {
                rawItemsByType[categoryKey].push({
                    id: item.id,
                    title: item.aiData.title,
                    time: itemTime,
                    coverImage: item.aiData.coverImage,
                    primaryColor: item.aiData.primaryColor,
                    unitCount: totalEffectiveUnits
                });
            }
        }
    });

    // Sort and Extract Top 3 per category
    const topItemsByType: Record<string, ObsessionItem[]> = {};
    let globalMaxCategory = 'Anime';
    let highestSingleItemTime = 0;

    Object.keys(rawItemsByType).forEach(key => {
        // Sort descending by time
        const sorted = rawItemsByType[key].sort((a, b) => b.time - a.time);
        
        // Take Top 3
        topItemsByType[key] = sorted.slice(0, 3);

        // Check for global max category (based on the single biggest obsession)
        if (sorted.length > 0 && sorted[0].time > highestSingleItemTime) {
            highestSingleItemTime = sorted[0].time;
            globalMaxCategory = key;
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


    const totalConsumptionUnits = animeEpisodes + seriesEpisodes + moviesWatched + readingChapters + bookChapters;

    return { 
        total, completed, onHold, watching, typeCount, 
        topGenre, maxGenreCount, ratingCount,
        averageScore, highestRatedGenre,
        
        topItemsByType,
        globalMaxCategory,

        // Granular
        animeEpisodes, seriesEpisodes, moviesWatched, readingChapters, bookChapters,
        visualTimeDisplay: formatTime(visualMinutes),
        readingTimeDisplay: formatTime(readingMinutes),
        consumedAnimes, consumedSeries, consumedMovies, consumedManhwas, consumedBooks,
        visualMinutes, readingMinutes,
        totalConsumptionUnits,

        // New Distribution
        genreConsumption,
        emotionConsumption
    };
  }, [library, animeDuration, seriesDuration, movieDuration, mangaDuration, bookDuration]);

  // Set default obsession tab
  useEffect(() => {
     if (stats.globalMaxCategory && stats.topItemsByType[stats.globalMaxCategory]?.length > 0) {
        setObsessionTab(stats.globalMaxCategory);
     }
  }, [stats.globalMaxCategory]);

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

  const currentTopList = stats.topItemsByType[obsessionTab] || [];
  
  // Color helper for rankings
  const getRankStyle = (index: number) => {
    switch (index) {
        case 0: return { 
            border: 'border-yellow-500', 
            bg: 'bg-yellow-500/10', 
            text: 'text-yellow-400', 
            icon: Trophy, 
            label: '🥇'
        };
        case 1: return { 
            border: 'border-slate-400', 
            bg: 'bg-slate-400/10', 
            text: 'text-slate-300', 
            icon: Medal, 
            label: '🥈'
        };
        case 2: return { 
            border: 'border-amber-700', 
            bg: 'bg-amber-700/10', 
            text: 'text-amber-600', 
            icon: Medal, 
            label: '🥉'
        };
        default: return { 
            border: 'border-slate-700', 
            bg: 'bg-slate-800', 
            text: 'text-slate-500', 
            icon: Star, 
            label: `${index + 1}.`
        };
    }
  };

  // --- Distribution Chart Helpers ---
  // Extended Palette for more slices
  const CHART_COLORS = [
      '#6366f1', // Indigo
      '#ec4899', // Pink
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#3b82f6', // Blue
      '#8b5cf6', // Violet
      '#f43f5e', // Rose
      '#14b8a6', // Teal
      '#84cc16', // Lime
      '#ef4444', // Red
      '#06b6d4', // Cyan
      '#d946ef', // Fuchsia
      '#eab308', // Yellow
      '#22c55e', // Green
      '#64748b'  // Slate (Fallback)
  ];
  
  const getDistributionData = () => {
      const sourceMap = distributionAxis === 'genre' ? stats.genreConsumption : stats.emotionConsumption;
      
      const MIN_PERCENTAGE_THRESHOLD = 2.5; // Only show items with >= 2.5% contribution

      // 1. Calculate Grand Total of ALL items (for real percentage calc logic, though we might normalize visual)
      // Actually, standard is to ignore small items.
      const entries = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);
      
      const grandTotal = entries.reduce((acc, curr) => acc + curr[1], 0);
      if (grandTotal === 0) return { chartData: [], totalTime: 0 };

      // 2. Filter out insignificant items
      const significantEntries = entries.filter(([, val]) => {
          const percent = (val / grandTotal) * 100;
          return percent >= MIN_PERCENTAGE_THRESHOLD;
      });

      // 3. Recalculate Total for the Chart Geometry (So the pie is full 360 deg for the visible items)
      // This "Normalizes" the chart to only show the significant items as 100% of the visual space.
      const visibleTotal = significantEntries.reduce((acc, curr) => acc + curr[1], 0);

      const chartData = significantEntries.map((entry, idx) => ({
          label: entry[0],
          value: entry[1],
          percent: (entry[1] / visibleTotal) * 100, // Visual percent (adds up to 100% of visible slices)
          color: CHART_COLORS[idx % CHART_COLORS.length]
      }));

      return { chartData, totalTime: visibleTotal };
  };

  const { chartData, totalTime } = getDistributionData();

  // SVG Chart Calculation (Pie/Donut logic)
  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  const svgSlices = chartData.map((slice) => {
      const strokeDasharray = `${(slice.percent / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((cumulativePercent / 100) * circumference);
      cumulativePercent += slice.percent; // Increment for next slice start
      return { ...slice, strokeDasharray, strokeDashoffset };
  });

  return (
    <div className="animate-fade-in space-y-6 pb-12 relative">
       
       <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg shadow shadow-primary/20">
                    <BarChart2 className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">Mis Insights</h2>
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
           <div className="group relative overflow-hidden rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 md:p-8 shadow-2xl transition-all hover:border-indigo-500/30 flex flex-col">
                {/* Decorative background glow */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-indigo-500/30 transition-colors duration-700"></div>
                
                <div className="relative z-10 flex flex-col flex-1 w-full">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-400 ring-1 ring-inset ring-indigo-500/30">
                            <MonitorPlay className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white leading-none">Tiempo Visual</h3>
                            <p className="text-xs text-slate-400 mt-1">Invertidos en pantallas</p>
                        </div>
                    </div>

                    {/* Main Metric */}
                    <div className="mb-8">
                        <span className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-indigo-100 to-indigo-300 drop-shadow-sm tracking-tight">
                            {stats.visualTimeDisplay}
                        </span>
                    </div>

                    {/* Chips Grid */}
                    <div className="grid grid-cols-2 gap-3 mt-auto">
                        {/* Anime Chip */}
                        <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:bg-slate-800/60 transition-colors group/chip">
                            <div className="flex items-center gap-2 mb-2">
                                <Tv className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover/chip:text-indigo-300 transition-colors">Animes</span>
                            </div>
                            <div>
                                <span className="block text-xl font-bold text-white mb-0.5">{stats.animeEpisodes} <span className="text-xs font-medium text-slate-500">caps</span></span>
                                <span className="block text-[10px] text-slate-500">{stats.consumedAnimes} obras</span>
                            </div>
                        </div>

                        {/* Series Chip */}
                        <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:bg-slate-800/60 transition-colors group/chip">
                            <div className="flex items-center gap-2 mb-2">
                                <Layers className="w-3.5 h-3.5 text-purple-400" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover/chip:text-purple-300 transition-colors">Series</span>
                            </div>
                            <div>
                                <span className="block text-xl font-bold text-white mb-0.5">{stats.seriesEpisodes} <span className="text-xs font-medium text-slate-500">caps</span></span>
                                <span className="block text-[10px] text-slate-500">{stats.consumedSeries} obras</span>
                            </div>
                        </div>

                        {/* Movies Chip - Full width on bottom */}
                        <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:bg-slate-800/60 transition-colors col-span-2 group/chip">
                            <div className="flex items-center gap-2 mb-2">
                                <Film className="w-3.5 h-3.5 text-pink-400" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover/chip:text-pink-300 transition-colors">Películas</span>
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <span className="block text-xl font-bold text-white mb-0.5">{stats.consumedMovies} <span className="text-xs font-medium text-slate-500">vistas</span></span>
                                    <span className="block text-[10px] text-slate-500">{stats.consumedMovies} obras</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
           </div>

           {/* Reading Time Card */}
           <div className="group relative overflow-hidden rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 md:p-8 shadow-2xl transition-all hover:border-emerald-500/30 flex flex-col">
                {/* Decorative background glow */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-emerald-500/30 transition-colors duration-700"></div>
                
                <div className="relative z-10 flex flex-col flex-1 w-full">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white leading-none">Tiempo Lectura</h3>
                            <p className="text-xs text-slate-400 mt-1">Sumergido en historias</p>
                        </div>
                    </div>

                    {/* Main Metric */}
                    <div className="mb-8">
                        <span className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-emerald-100 to-emerald-300 drop-shadow-sm tracking-tight">
                            {stats.readingTimeDisplay}
                        </span>
                    </div>

                    {/* Chips Grid - Stacked on Desktop to match height of Visual Card */}
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-3 mt-auto">
                        {/* Manhwa/Manga Chip */}
                        <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:bg-slate-800/60 transition-colors group/chip">
                            <div className="flex items-center gap-2 mb-2">
                                <BookOpen className="w-3.5 h-3.5 text-orange-400" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover/chip:text-orange-300 transition-colors truncate">Manhwa/Manga</span>
                            </div>
                            <div>
                                <span className="block text-xl font-bold text-white mb-0.5">{stats.readingChapters} <span className="text-xs font-medium text-slate-500">caps</span></span>
                                <span className="block text-[10px] text-slate-500">{stats.consumedManhwas} obras</span>
                            </div>
                        </div>

                        {/* Libros Chip */}
                        <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:bg-slate-800/60 transition-colors group/chip">
                            <div className="flex items-center gap-2 mb-2">
                                <Book className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover/chip:text-emerald-300 transition-colors">Libros</span>
                            </div>
                            <div>
                                <span className="block text-xl font-bold text-white mb-0.5">{stats.bookChapters} <span className="text-xs font-medium text-slate-500">pág</span></span>
                                <span className="block text-[10px] text-slate-500">{stats.consumedBooks} obras</span>
                            </div>
                        </div>
                    </div>
                </div>
           </div>

       </div>

       {/* Dynamic Obsession Tracker Widget (TOP 3) */}
       <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-md transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                     <span className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                         <Zap className="w-4 h-4 text-yellow-500" /> Top 3 Mayores Obsesiones
                     </span>
                     <p className="text-sm text-slate-400 mt-1">Las obras que más tiempo han consumido de tu vida</p>
                </div>
                
                {/* Dynamic Selector Tabs */}
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

            {/* TOP 3 LIST */}
            {currentTopList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {currentTopList.map((item, index) => {
                        const style = getRankStyle(index);
                        const isTop1 = index === 0;

                        return (
                            <div 
                                key={item.id}
                                className={`relative rounded-xl border ${isTop1 ? 'border-2 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'border'} overflow-hidden shadow-lg transition-all flex flex-col justify-end h-48 md:h-60 group ${style.border}`}
                            >
                                {/* Background Image for ALL ITEMS (1, 2, 3) */}
                                {item.coverImage ? (
                                    <div className="absolute inset-0 z-0">
                                         <img src={item.coverImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-40" alt="" />
                                         {/* Gradient for text readability */}
                                         <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent"></div>
                                    </div>
                                ) : (
                                     <div className={`absolute inset-0 z-0 bg-gradient-to-br from-slate-800 to-slate-900 opacity-50`}></div>
                                )}

                                {/* Content */}
                                <div className="relative z-10 w-full p-4">
                                     
                                     {/* Rank Badge - Floating Top Right */}
                                     <div className="absolute top-0 right-0 p-3">
                                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border font-bold text-xl backdrop-blur-md shadow-lg ${style.bg} ${style.border} ${style.text}`}>
                                              {style.label}
                                          </div>
                                     </div>

                                     {/* Title & Info */}
                                     <div className="flex flex-col gap-1">
                                           <h4 className={`font-bold text-white leading-tight line-clamp-2 ${isTop1 ? 'text-lg' : 'text-base'}`} title={item.title}>
                                               {item.title}
                                           </h4>
                                           
                                           <div className="flex items-center justify-between text-xs text-slate-300 mt-2">
                                                <span>
                                                    {item.unitCount} {obsessionTab.includes('Libro') || obsessionTab.includes('Webtoon') ? 'caps' : 'eps'}
                                                </span>
                                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/40 border border-white/10 backdrop-blur-sm`}>
                                                     <Clock className={`w-3 h-3 ${style.text}`} />
                                                     <span className="font-mono font-bold text-white">
                                                         {(item.time / 60).toFixed(1)}h
                                                     </span>
                                                </div>
                                           </div>
                                     </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="w-full text-center py-10 opacity-50 flex flex-col items-center bg-slate-900 rounded-xl border border-slate-700 border-dashed">
                     <Layout className="w-10 h-10 text-slate-500 mb-2" />
                     <p className="text-sm font-medium text-slate-400">Sin datos en {obsessionTab}.</p>
                     <p className="text-xs text-slate-600">Registra progreso para ver tu ranking.</p>
                </div>
            )}
       </div>

       {/* DISTRIBUTION BY TAG WIDGET (SVG Pie Chart) */}
       <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-md transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                     <span className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                         <PieChart className="w-4 h-4 text-emerald-500" /> Distribución de Consumo
                     </span>
                     <p className="text-sm text-slate-400 mt-1">
                         Impacto en tu tiempo (ponderado por duración)
                     </p>
                </div>
                
                {/* Axis Selector */}
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 self-start sm:self-auto">
                    <button 
                        onClick={() => setDistributionAxis('genre')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${distributionAxis === 'genre' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Hash className="w-3 h-3" /> Géneros
                    </button>
                    <button 
                        onClick={() => setDistributionAxis('emotion')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${distributionAxis === 'emotion' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Heart className="w-3 h-3" /> Emociones
                    </button>
                </div>
            </div>

            {chartData.length > 0 ? (
                <div className="flex flex-col md:flex-row items-start gap-8 md:gap-16 justify-center">
                    
                    {/* The Chart (SVG Based) */}
                    <div className="relative w-48 h-48 md:w-56 md:h-56 flex-shrink-0 flex items-center justify-center self-center">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform overflow-visible">
                           {svgSlices.map((slice, i) => (
                               <circle
                                   key={slice.label} // Key ensures React tracks transition
                                   cx="50"
                                   cy="50"
                                   r={radius}
                                   fill="transparent"
                                   stroke={slice.color}
                                   strokeWidth="50" // width=2*radius makes it a solid pie. Use smaller for donut.
                                   strokeDasharray={slice.strokeDasharray}
                                   strokeDashoffset={slice.strokeDashoffset}
                                   className="transition-all duration-1000 ease-out hover:opacity-90 cursor-pointer hover:scale-105 origin-center"
                               />
                           ))}
                        </svg>
                        {/* Center Hole (Optional, if you want a Donut instead of Pie, reduce strokeWidth above and add a circle here) 
                            Currently implemented as SOLID PIE as per user request context.
                        */}
                    </div>

                    {/* The Legend - SCROLLABLE & COMPLETE */}
                    <div className="flex-1 w-full md:w-auto h-64 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="grid grid-cols-1 gap-2">
                            {chartData.map((slice, idx) => (
                                <div key={idx} className="flex items-center justify-between group cursor-default hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div 
                                            className="w-3 h-3 rounded-full shadow-sm flex-shrink-0"
                                            style={{ backgroundColor: slice.color }}
                                        />
                                        <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors truncate max-w-[150px] md:max-w-[200px]" title={slice.label}>
                                            {slice.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-200">
                                            {slice.percent.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-full text-center py-10 opacity-50 flex flex-col items-center bg-slate-800/50 rounded-xl border border-slate-700/50 border-dashed">
                     <PieChart className="w-10 h-10 text-slate-500 mb-2" />
                     <p className="text-sm font-medium text-slate-400">Sin datos suficientes.</p>
                     <p className="text-xs text-slate-600">Añade tags a tus obras o aumenta tu consumo para ver este gráfico.</p>
                </div>
            )}
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

       {/* Settings Modal (Unchanged) */}
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
