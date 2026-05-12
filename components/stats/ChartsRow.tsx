import React from 'react';
import { PieChart, Star } from 'lucide-react';
import { StatsData } from './StatsData';

export interface ChartsRowProps {
  stats: StatsData;
}

export const ChartsRow: React.FC<ChartsRowProps> = ({ stats }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {/* Type Distribution */}
    <div className="bg-surface border border-slate-700 p-4 md:p-6 rounded-2xl shadow-lg overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <PieChart className="w-5 h-5 text-slate-400" />
        <h3 className="text-lg font-bold text-white">Por Tipo de Contenido</h3>
      </div>

      {Object.keys(stats.typeCount).length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-4">No hay datos aún.</p>
      ) : (
        <div className="space-y-4">
        {Object.entries(stats.typeCount).map(([type, count]) => {
          const numCount = Number(count);
          const percentage = stats.total > 0 ? (numCount / stats.total) * 100 : 0;
            return (
              <div key={type}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-300 font-medium">{type}</span>
                  <span className="text-slate-500 font-mono">{numCount}</span>
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
    <div className="bg-surface border border-slate-700 p-4 md:p-6 rounded-2xl shadow-lg flex flex-col overflow-hidden">
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
          .sort((a, b) => Number(b[1]) - Number(a[1]))
          .map(([rating, count]) => {
          const numCount = Number(count);
          const label = rating.split('(')[0].trim();
          let barColor = 'bg-secondary';
          if (rating.includes('God Tier') || rating.includes('Maestra')) barColor = 'bg-yellow-500';
          if (rating.includes('Malo') || rating.includes('Basura')) barColor = 'bg-red-500';

          const percentage = stats.total > 0 ? (numCount / stats.total) * 100 : 0;

              return (
                <div key={rating}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-300 font-medium truncate max-w-[80%]" title={rating}>{label}</span>
              <span className="text-slate-500 font-mono">{numCount}</span>
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
);
