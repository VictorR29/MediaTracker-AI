
import React, { useMemo, useState } from 'react';
import { MediaItem, UserProfile, RATING_TO_SCORE } from '../types';
import { BarChart2, Star, Layers, Trophy, Clock, PieChart, Timer, Crown, Zap, Settings, X, Save, Tv, BookOpen, MonitorPlay, Film, Award } from 'lucide-react';

interface StatsViewProps {
  library: MediaItem[];
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
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
  maxTimeItem: { title: string; time: number };
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
}

export const StatsView: React.FC<StatsViewProps> = ({ library, userProfile, onUpdateProfile }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
    let moviesWatched = 0; // Total movie minutes / duration (or direct count)
    let readingChapters = 0; // Manhwa, Manga, Comic
    let bookChapters = 0;

    // Time
    let visualMinutes = 0;
    let readingMinutes = 0;
    
    let maxTimeItem = { title: "N/A", time: 0 };

    library.forEach(item => {
        const type = item.aiData.mediaType;
        const units = item.trackingData.watchedEpisodes; // "watchedEpisodes" stores progress
        // For movies, if status is 'Completado', units might be 0 or 1 depending on logic, but we can trust progress.
        // Or if logic changed to 1.

        // Count logic
        if (units > 0 || (type === 'Pelicula' && item.trackingData.status === 'Completado')) {
            let itemTime = 0;
            const effectiveUnits = (type === 'Pelicula' && item.trackingData.status === 'Completado') ? 1 : units;
            
            // Visual
            if (type === 'Anime') {
                animeEpisodes += effectiveUnits;
                itemTime = effectiveUnits * animeMin;
                visualMinutes += itemTime;
            } else if (type === 'Serie') {
                seriesEpisodes += effectiveUnits;
                itemTime = effectiveUnits * seriesMin; 
                visualMinutes += itemTime;
            } else if (type === 'Pelicula') {
                // effectiveUnits is usually 1 here
                moviesWatched += effectiveUnits; 
                itemTime = effectiveUnits * movieMin;
                visualMinutes += itemTime;
            } 
            // Reading
            else if (['Manhwa', 'Manga', 'Comic'].includes(type)) {
                readingChapters += effectiveUnits;
                itemTime = effectiveUnits * mangaMin;
                readingMinutes += itemTime;
            } else if (type === 'Libro') {
                bookChapters += effectiveUnits;
                itemTime = effectiveUnits * bookMin;
                readingMinutes += itemTime;
            } else {
                itemTime = effectiveUnits * 10; // Unknown
            }

            if (itemTime > maxTimeItem.time) {
                maxTimeItem = { title: item.aiData.title, time: itemTime };
            }
        }
    });

    // Helper to count "Consumed" items (at least started or completed)
    const countConsumed = (types: string[]) => 
        library.filter(i => types.includes(i.aiData.mediaType) && (i.trackingData.watchedEpisodes > 0 || i.trackingData.status === 'Completado')).length;

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


    return { 
        total, completed, onHold, watching, typeCount, 
        topGenre, maxGenreCount, ratingCount,
        averageScore, highestRatedGenre,
        maxTimeItem,
        // Granular
        animeEpisodes, seriesEpisodes, moviesWatched, readingChapters, bookChapters,
        visualTimeDisplay: formatTime(visualMinutes),
        readingTimeDisplay: formatTime(readingMinutes),
        consumedAnimes, consumedSeries, consumedMovies, consumedManhwas, consumedBooks,
        visualMinutes, readingMinutes
    };
  }, [library, userProfile.preferences]);

  // Generate Closing Message (Updated)
  const closingMessage = useMemo(() => {
    const totalMinutes = stats.visualMinutes + stats.readingMinutes;
    if (totalMinutes === 0) return null;

    const hours = Math.round(totalMinutes / 60);
    const dominant = stats.visualMinutes > stats.readingMinutes ? 'Visual' : 'Lectura';
    const topGenre = stats.topGenre !== 'N/A' ? stats.topGenre : 'Historias';
    
    // Titles
    let title = "Explorador Novato";
    if (hours > 50) title = "Viajero Experimentado";
    if (hours > 200) title = "Guardián de Historias";
    if (hours > 500) title = "Maestro del Archivo";
    
    // Diversified Templates
    const templates = [
        // T1: Standard
        `¡${hours} horas invertidas! Eres un verdadero campeón del género ${topGenre}. Tus ojos han visto mundos que otros solo sueñan.`,
        // T2: Focus on Dedication
        `Tu dedicación es legendaria. ${hours} horas consumiendo arte. El género ${topGenre} te debe un tributo.`,
        // T3: Focus on Knowledge
        `Has acumulado sabiduría por valor de ${hours} horas. Tu mente es una biblioteca viviente de ${topGenre}.`,
        // T4: Focus on Dominant Type
        dominant === 'Visual' 
           ? `Tus retinas han presenciado ${hours} horas de gloria visual en ${topGenre}.`
           : `Has devorado páginas durante ${hours} horas. ${topGenre} corre por tus venas.`,
        // T5: Simple Praise
        `Simplemente impresionante. ${hours} horas de pasión pura por ${topGenre}.`
    ];

    return { 
        title, 
        message: templates[Math.floor(Math.random() * templates.length)] 
    };
  }, [stats, userProfile.username]);

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

        {/* Most Time Dedicated Banner */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between shadow-sm">
             <div className="flex flex-col">
                 <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Tu mayor obsesión</span>
                 <span className="text-white font-bold text-lg truncate max-w-[200px] md:max-w-md">{stats.maxTimeItem.title}</span>
             </div>
             <div className="flex items-center gap-2 text-yellow-500">
                 <Clock className="w-5 h-5" />
                 <span className="font-mono font-bold">{(stats.maxTimeItem.time / 60).toFixed(1)}h</span>
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

       {/* Closing Emotional Message */}
       {closingMessage && (
           <div 
             className="w-full bg-slate-900 border border-slate-700 rounded-xl p-8 text-center relative overflow-hidden"
             style={{ borderColor: userProfile.accentColor ? '#' + userProfile.accentColor.split(' ')[0] + '40' : '#6366f140' }}
           >
               {/* Decorative Elements */}
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 opacity-50"></div>
               <div className="absolute top-4 left-4 text-slate-700 opacity-20"><Trophy className="w-16 h-16" /></div>
               <div className="absolute bottom-4 right-4 text-slate-700 opacity-20"><Crown className="w-16 h-16" /></div>

               <div className="relative z-10 max-w-2xl mx-auto">
                   <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-widest mb-4">
                       <Award className="w-4 h-4" />
                       {closingMessage.title}
                   </div>
                   <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight italic">
                       "{closingMessage.message}"
                   </h2>
                   <p className="text-slate-500 text-sm">
                       — MediaTracker AI
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
