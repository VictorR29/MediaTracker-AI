import React, { useMemo } from 'react';
import { MediaItem } from '../types';
import { BarChart2, Star, Layers, Trophy, Clock, PieChart } from 'lucide-react';

interface StatsViewProps {
  library: MediaItem[];
}

export const StatsView: React.FC<StatsViewProps> = ({ library }) => {
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

    // Rating Distribution (Approx)
    const ratingCount: Record<string, number> = {};
    library.forEach(item => {
        const r = item.trackingData.rating || 'Sin calificar';
        ratingCount[r] = (ratingCount[r] || 0) + 1;
    });

    return { total, completed, onHold, watching, typeCount, topGenre, maxGenreCount, ratingCount };
  }, [library]);

  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-surface border border-slate-700 p-6 rounded-2xl flex items-center justify-between hover:border-slate-500 transition-colors shadow-md">
       <div>
         <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
         <p className="text-3xl font-bold text-white mb-1">{value}</p>
         {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
       </div>
       <div className={`p-4 rounded-xl bg-opacity-10 ${color.bg} shadow-inner`}>
         <Icon className={`w-8 h-8 ${color.text}`} />
       </div>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6 pb-12">
       <div className="flex items-center gap-3 mb-6">
         <div className="p-2 bg-slate-800 rounded-lg">
            <BarChart2 className="w-6 h-6 text-primary" />
         </div>
         <h2 className="text-2xl font-bold text-white">Mis Insights</h2>
       </div>

       {/* KPIs */}
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
             title="En Curso" 
             value={stats.watching} 
             icon={Clock} 
             color={{ bg: 'bg-orange-500', text: 'text-orange-500' }} 
          />
           <StatCard 
             title="Género Top" 
             value={stats.topGenre} 
             icon={Star} 
             color={{ bg: 'bg-purple-500', text: 'text-purple-500' }} 
          />
       </div>

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
                    {Object.entries(stats.typeCount).map(([type, count]: [string, number]) => (
                    <div key={type}>
                        <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-slate-300 font-medium">{type}</span>
                            <span className="text-slate-500 font-mono">{count}</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                            <div 
                            className="bg-primary h-2.5 rounded-full transition-all duration-1000" 
                            style={{ width: `${(count / (stats.total || 1)) * 100}%` }}
                            />
                        </div>
                    </div>
                    ))}
                </div>
             )}
          </div>

           {/* Rating Distribution */}
          <div className="bg-surface border border-slate-700 p-6 rounded-2xl shadow-lg">
             <div className="flex items-center gap-2 mb-6">
                <Star className="w-5 h-5 text-slate-400" />
                <h3 className="text-lg font-bold text-white">Calificaciones</h3>
             </div>

             {Object.keys(stats.ratingCount).length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No hay calificaciones registradas.</p>
             ) : (
                <div className="space-y-4">
                    {Object.entries(stats.ratingCount)
                        .sort((a: [string, number], b: [string, number]) => b[1] - a[1]) // Sort by count desc
                        .slice(0, 6) // Top 6
                        .map(([rating, count]: [string, number]) => {
                            // Extract just the main part of the rating label (before parens) for cleaner UI
                            const label = rating.split('(')[0].trim();
                            return (
                                <div key={rating}>
                                    <div className="flex justify-between text-sm mb-1.5">
                                        <span className="text-slate-300 font-medium truncate max-w-[80%]" title={rating}>{label}</span>
                                        <span className="text-slate-500 font-mono">{count}</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                        <div 
                                        className="bg-secondary h-2.5 rounded-full transition-all duration-1000" 
                                        style={{ width: `${(count / (stats.total || 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                </div>
             )}
          </div>
       </div>
    </div>
  );
};