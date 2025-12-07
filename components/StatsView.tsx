import React, { useMemo, useState } from 'react';
import { MediaItem, UserProfile, RATING_TO_SCORE } from '../types';
import { BarChart2, Star, Layers, Trophy, Clock, PieChart, Timer, Crown, Zap, Settings, X, Save } from 'lucide-react';

interface StatsViewProps {
  library: MediaItem[];
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({ library, userProfile, onUpdateProfile }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [animeDuration, setAnimeDuration] = useState(userProfile.preferences?.animeEpisodeDuration || 24);
  const [mangaDuration, setMangaDuration] = useState(userProfile.preferences?.mangaChapterDuration || 3);

  const saveSettings = () => {
      onUpdateProfile({
          ...userProfile,
          preferences: {
              animeEpisodeDuration: animeDuration,
              mangaChapterDuration: mangaDuration
          }
      });
      setIsSettingsOpen(false);
  };

  const stats = useMemo(() => {
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


    // --- Personal Recap (Time) Logic ---
    const animeMin = userProfile.preferences?.animeEpisodeDuration || 24;
    const mangaMin = userProfile.preferences?.mangaChapterDuration || 3;
    
    let totalMinutesConsumed = 0;
    let totalUnitsConsumed = 0;
    let maxTimeItem = { title: "N/A", time: 0 };

    library.forEach(item => {
        const isReading = ['Manhwa', 'Manga', 'Comic', 'Libro'].includes(item.aiData.mediaType);
        const durationPerUnit = isReading ? mangaMin : animeMin;
        const units = item.trackingData.watchedEpisodes; // "watchedEpisodes" stores chapters too

        if (units > 0) {
            const itemTime = units * durationPerUnit;
            totalMinutesConsumed += itemTime;
            totalUnitsConsumed += units;

            if (itemTime > maxTimeItem.time) {
                maxTimeItem = { title: item.aiData.title, time: itemTime };
            }
        }
    });

    // Format Time
    const timeDays = Math.floor(totalMinutesConsumed / (24 * 60));
    const timeHours = Math.floor((totalMinutesConsumed % (24 * 60)) / 60);
    const timeDisplay = timeDays > 0 
        ? `${timeDays}d ${timeHours}h` 
        : `${Math.floor(totalMinutesConsumed / 60)}h ${totalMinutesConsumed % 60}m`;


    return { 
        total, completed, onHold, watching, typeCount, 
        topGenre, maxGenreCount, ratingCount,
        averageScore, highestRatedGenre,
        totalUnitsConsumed, timeDisplay, maxTimeItem
    };
  }, [library, userProfile.preferences]);

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
       <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 relative z-10">
                <Crown className="w-6 h-6 text-yellow-400" />
                Recap Personal
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                <div className="flex flex-col">
                    <span className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">Tiempo Total Invertido</span>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                            {stats.timeDisplay}
                        </span>
                    </div>
                    <span className="text-xs text-slate-500 mt-1">Calculado con tus preferencias</span>
                </div>
                
                <div className="flex flex-col">
                    <span className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">Total Episodios/Caps</span>
                    <div className="flex items-end gap-2">
                         <span className="text-4xl font-extrabold text-white">{stats.totalUnitsConsumed}</span>
                         <span className="text-sm text-slate-400 mb-1.5">vistos/leídos</span>
                    </div>
                </div>

                <div className="flex flex-col">
                    <span className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">Más Tiempo Dedicado</span>
                    <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                        <span className="text-lg font-bold text-white truncate" title={stats.maxTimeItem.title}>
                             {stats.maxTimeItem.title}
                        </span>
                    </div>
                    <span className="text-xs text-slate-500 mt-1">
                        {(stats.maxTimeItem.time / 60).toFixed(1)} horas estimadas
                    </span>
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
             subtext={`${Math.round(((stats.completed as number) / ((stats.total as number) || 1)) * 100)}% del total`}
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
                    {Object.entries(stats.typeCount).map(([type, count]) => (
                    <div key={type}>
                        <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-slate-300 font-medium">{type}</span>
                            <span className="text-slate-500 font-mono">{count}</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                            <div 
                            className="bg-primary h-2.5 rounded-full transition-all duration-1000" 
                            style={{ width: `${((count as number) / ((stats.total as number) || 1)) * 100}%` }}
                            />
                        </div>
                    </div>
                    ))}
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

                            return (
                                <div key={rating}>
                                    <div className="flex justify-between text-sm mb-1.5">
                                        <span className="text-slate-300 font-medium truncate max-w-[80%]" title={rating}>{label}</span>
                                        <span className="text-slate-500 font-mono">{count}</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                        <div 
                                        className={`${barColor} h-2.5 rounded-full transition-all duration-1000`} 
                                        style={{ width: `${((count as number) / ((stats.total as number) || 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                </div>
             )}
          </div>
       </div>

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
                   <div className="p-6 space-y-6">
                       <p className="text-sm text-slate-400">
                           Ajusta la duración promedio para calcular con mayor precisión tu "Recap Personal".
                       </p>
                       
                       <div>
                           <label className="block text-sm font-medium text-slate-300 mb-2">Duración Episodio Anime/Serie (min)</label>
                           <input 
                               type="number" 
                               min="1" 
                               value={animeDuration}
                               onChange={(e) => setAnimeDuration(Number(e.target.value))}
                               className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary outline-none"
                           />
                       </div>

                       <div>
                           <label className="block text-sm font-medium text-slate-300 mb-2">Duración Capítulo Manhwa/Manga (min)</label>
                           <input 
                               type="number" 
                               min="1" 
                               value={mangaDuration}
                               onChange={(e) => setMangaDuration(Number(e.target.value))}
                               className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary outline-none"
                           />
                       </div>

                       <button 
                         onClick={saveSettings}
                         className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
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