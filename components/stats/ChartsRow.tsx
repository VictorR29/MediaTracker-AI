import React from 'react';
import { PieChart, Star } from 'lucide-react';
import { StatsData } from './StatsData';

export interface ChartsRowProps {
  stats: StatsData;
}

// Semantic colors for media types
const getTypeColor = (type: string): string => {
  const normalized = type.toLowerCase();
  if (normalized.includes('anime')) return '#a78bfa'; // violet
  if (normalized.includes('serie') || normalized.includes('tv')) return '#3b82f6'; // blue
  if (normalized.includes('pelicula') || normalized.includes('película') || normalized.includes('movie')) return '#ec4899'; // pink
  if (normalized.includes('libro') || normalized.includes('book')) return '#10b981'; // emerald
  if (normalized.includes('manhwa') || normalized.includes('manga') || normalized.includes('comic')) return '#f97316'; // orange
  if (normalized.includes('otro') || normalized.includes('other')) return '#71717a'; // zinc
  return '#a78bfa'; // default violet
};

// Semantic colors for ratings (quality gradient)
const getRatingColor = (rating: string): string => {
  const normalized = rating.toLowerCase();
  if (normalized.includes('obra maestra') || normalized.includes('god tier') || normalized.includes('maestra')) return '#fbbf24'; // amber-400
  if (normalized.includes('excelente') || normalized.includes('great')) return '#22c55e'; // green-500
  if (normalized.includes('muy bueno') || normalized.includes('very good')) return '#84cc16'; // lime-500
  if (normalized.includes('bueno') || normalized.includes('good') || normalized.includes('decente') || normalized.includes('solid')) return '#10b981'; // emerald-500
  if (normalized.includes('promedio') || normalized.includes('average') || normalized.includes('mediocre') || normalized.includes('meh')) return '#71717a'; // zinc-500
  if (normalized.includes('malo') || normalized.includes('bad') || normalized.includes('basura') || normalized.includes('trash') || normalized.includes('horrible')) return '#ef4444'; // red-500
  return '#a78bfa'; // default violet-400
};

// Determine the Tailwind text class and matching hex for a media type
const getTypeIconStyle = (type: string): { textClass: string; hex: string } => {
  const normalized = type.toLowerCase();
  if (normalized.includes('serie') || normalized.includes('tv')) return { textClass: 'text-blue-400', hex: '#3b82f6' };
  if (normalized.includes('pelicula') || normalized.includes('película') || normalized.includes('movie')) return { textClass: 'text-pink-400', hex: '#ec4899' };
  if (normalized.includes('libro') || normalized.includes('book')) return { textClass: 'text-emerald-400', hex: '#10b981' };
  if (normalized.includes('manhwa') || normalized.includes('manga') || normalized.includes('comic')) return { textClass: 'text-orange-400', hex: '#f97316' };
  if (normalized.includes('otro') || normalized.includes('other')) return { textClass: 'text-zinc-400', hex: '#71717a' };
  return { textClass: 'text-violet-400', hex: '#a78bfa' };
};

export const ChartsRow: React.FC<ChartsRowProps> = ({ stats }) => {
  // Determine the first/most common type for the icon color
  const typeEntries = Object.entries(stats.typeCount).sort((a, b) => Number(b[1]) - Number(a[1]));
  const firstType = typeEntries[0]?.[0] ?? '';
  const { textClass: typeIconTextClass, hex: typeIconColor } = getTypeIconStyle(firstType);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Type Distribution */}
      <div className="bg-[#111113] ring-1 ring-white/[0.06] p-1 rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-[#18181B] rounded-[calc(1rem-0.25rem)] p-4 md:p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className={`w-5 h-5 ${typeIconTextClass}`} style={{ filter: `drop-shadow(0 0 8px ${typeIconColor})` }} />
            <h3 className="text-lg font-bold text-white">Por Tipo de Contenido</h3>
          </div>

          {Object.keys(stats.typeCount).length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-4">No hay datos aún.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(stats.typeCount).map(([type, count]) => {
                const numCount = Number(count);
                const percentage = stats.total > 0 ? (numCount / stats.total) * 100 : 0;
                const typeColor = getTypeColor(type);
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-zinc-300 font-medium">{type}</span>
                      <span className="text-zinc-500 font-mono" style={{ letterSpacing: '0.02em' }}>{numCount}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 rounded-full transition-all duration-1000"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: typeColor,
                          boxShadow: `0 0 12px ${typeColor}80, 0 0 4px ${typeColor}`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Rating Distribution */}
      <div className="bg-[#111113] ring-1 ring-white/[0.06] p-1 rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-[#18181B] rounded-[calc(1rem-0.25rem)] p-4 md:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" style={{ filter: 'drop-shadow(0 0 8px #fbbf24)' }} />
              <h3 className="text-lg font-bold text-white">Calificaciones</h3>
            </div>
            {stats.highestRatedGenre !== "N/A" && (
              <span
                className="text-[10px] bg-[#1C1C1F] text-yellow-400 ring-1 ring-yellow-400/30 px-2 py-1 rounded-md font-extrabold uppercase"
                style={{ letterSpacing: '0.1em', textShadow: '0 0 8px rgba(251, 191, 36, 0.4)' }}
              >
                Top: {stats.highestRatedGenre}
              </span>
            )}
          </div>

          {Object.keys(stats.ratingCount).length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-4">No hay calificaciones registradas.</p>
          ) : (
            <div className="space-y-4 flex-grow overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
              {Object.entries(stats.ratingCount)
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .map(([rating, count]) => {
                  const numCount = Number(count);
                  const label = rating.split('(')[0].trim();
                  const ratingColor = getRatingColor(rating);
                  const percentage = stats.total > 0 ? (numCount / stats.total) * 100 : 0;

                  return (
                    <div key={rating}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-zinc-300 font-medium truncate max-w-[80%]" title={rating}>{label}</span>
                        <span className="text-zinc-500 font-mono" style={{ letterSpacing: '0.02em' }}>{numCount}</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-2.5 rounded-full transition-all duration-1000"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: ratingColor,
                            boxShadow: `0 0 10px ${ratingColor}80`
                          }}
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
