import React, { useState, useEffect } from 'react';
import { PieChart, Hash, Heart, Globe, HardDrive, Link as LinkIcon } from 'lucide-react';
import { StatsData } from './StatsData';

export interface ConsumptionDistributionProps {
  stats: StatsData;
}

// Extended Palette for more slices
const CHART_COLORS = [
  '#a78bfa', '#ec4899', '#10b981', '#f59e0b', '#3b82f6',
  '#8b5cf6', '#f43f5e', '#14b8a6', '#84cc16', '#ef4444',
  '#06b6d4', '#d946ef', '#eab308', '#22c55e', '#71717a'
];

interface ChartSlice {
  label: string;
  value: number;
  percent: number;
  color: string;
  strokeDasharray: string;
  strokeDashoffset: number;
}

function getDistributionData(
  sourceMap: Record<string, number>,
  axis: 'genre' | 'emotion'
): { chartData: ChartSlice[]; totalTime: number } {
  const MIN_PERCENTAGE_THRESHOLD = 2.5;

  const entries = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);
  const grandTotal = entries.reduce((acc, curr) => acc + curr[1], 0);
  if (grandTotal === 0) return { chartData: [], totalTime: 0 };

  const significantEntries = entries.filter(([, val]) => {
    const percent = (val / grandTotal) * 100;
    return percent >= MIN_PERCENTAGE_THRESHOLD;
  });

  const visibleTotal = significantEntries.reduce((acc, curr) => acc + curr[1], 0);

  // SVG Chart Calculation (Pie/Donut logic)
  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  const chartData = significantEntries.map((entry, idx) => {
    const percent = (entry[1] / visibleTotal) * 100;
    const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((cumulativePercent / 100) * circumference);
    cumulativePercent += percent;

    return {
      label: entry[0],
      value: entry[1],
      percent,
      color: CHART_COLORS[idx % CHART_COLORS.length],
      strokeDasharray,
      strokeDashoffset
    };
  });

  return { chartData, totalTime: visibleTotal };
}

const ConsumptionDistributionInner: React.FC<ConsumptionDistributionProps> = ({ stats }) => {
  const [distributionAxis, setDistributionAxis] = useState<'genre' | 'emotion' | 'platform'>('genre');
  const [highlightedSlice, setHighlightedSlice] = useState<string | null>(null);

  // Reset highlight when axis changes
  useEffect(() => {
    setHighlightedSlice(null);
  }, [distributionAxis]);

  const sourceMap = distributionAxis === 'genre' ? stats.genreConsumption : stats.emotionConsumption;
  const { chartData } = distributionAxis !== 'platform'
    ? getDistributionData(sourceMap, distributionAxis as 'genre' | 'emotion')
    : { chartData: [] as ChartSlice[] };

  // Ecosystem Visual Calculation
  const totalItemsEcosystem = stats.itemsWithLinks + stats.itemsWithoutLinks;
  const linkPercent = totalItemsEcosystem > 0 ? (stats.itemsWithLinks / totalItemsEcosystem) * 100 : 0;
  const localPercent = totalItemsEcosystem > 0 ? (stats.itemsWithoutLinks / totalItemsEcosystem) * 100 : 0;

  return (
  <div className="bg-[#111113] ring-1 ring-white/[0.06] p-1 rounded-2xl shadow-lg transition-all overflow-hidden">
    <div className="bg-[#18181B] rounded-[calc(1rem-0.25rem)] p-4 md:p-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <span className="text-[10px] font-extrabold uppercase text-zinc-400 flex items-center gap-2" style={{ letterSpacing: '0.1em' }}>
          <PieChart className="w-4 h-4 text-emerald-500" /> Distribución de Consumo
        </span>
        <p className="text-sm text-zinc-400 mt-1">
          Impacto en tu tiempo y fuentes de contenido
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 bg-[#09090B] p-1.5 rounded-xl w-full md:w-auto ring-1 ring-white/[0.06]">
          <button
            onClick={() => setDistributionAxis('genre')}
            className={`px-2 py-1.5 rounded-md text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap w-full ${distributionAxis === 'genre' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
          >
            <Hash className="w-3 h-3 hidden sm:inline" /> Géneros
          </button>
          <button
            onClick={() => setDistributionAxis('emotion')}
            className={`px-2 py-1.5 rounded-md text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap w-full ${distributionAxis === 'emotion' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
          >
            <Heart className="w-3 h-3 hidden sm:inline" /> Emociones
          </button>
          <button
            onClick={() => setDistributionAxis('platform')}
            className={`px-2 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap w-full ${distributionAxis === 'platform' ? 'bg-white text-[#09090B] shadow-lg' : 'text-zinc-400 hover:text-white'}`}
          >
            <Globe className="w-3 h-3 hidden sm:inline" /> Plataformas
          </button>
        </div>
      </div>

      {/* CONDITIONAL CONTENT */}
      {distributionAxis === 'platform' ? (
        // --- ECOSYSTEM WIDGET ---
        <div className="animate-fade-in w-full">
          {/* 1. Bar Chart: Online vs Local */}
          <div className="mb-8">
            <div className="flex justify-between text-xs text-zinc-400 mb-2 font-medium">
      <span className="flex items-center gap-1 min-w-0 truncate mr-2"><Globe className="w-3 h-3 text-zinc-400 flex-shrink-0"/> <span className="truncate">Streaming / Web ({linkPercent.toFixed(0)}%)</span></span>
      <span className="flex items-center gap-1 min-w-0 truncate"><HardDrive className="w-3 h-3 text-zinc-500 flex-shrink-0"/> <span className="truncate">Local / Físico ({localPercent.toFixed(0)}%)</span></span>
    </div>
    <div className="h-4 w-full bg-white/10 rounded-full overflow-hidden flex">
      <div
        className="h-full bg-zinc-300 transition-all duration-1000 relative group"
        style={{ width: `${linkPercent}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20"></div>
      </div>
      <div
        className="h-full bg-zinc-700 transition-all duration-1000"
                style={{ width: `${localPercent}%` }}
              ></div>
            </div>
          </div>

          {/* 2. Top Platforms List */}
          <h4 className="text-xs font-bold uppercase text-zinc-500 tracking-wider mb-3">Top Fuentes</h4>
          {stats.topPlatforms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stats.topPlatforms.map((p) => (
    <div key={p.domain} className="flex items-center justify-between p-3 bg-[#1C1C1F] rounded-xl ring-1 ring-white/[0.06] hover:bg-white/[0.04] transition-colors">
        <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center overflow-hidden ring-1 ring-white/[0.06] flex-shrink-0">
                      <img
                        src={`https://s2.googleusercontent.com/s2/favicons?domain=${p.domain}&sz=32`}
                        alt={p.name}
                        className="w-5 h-5 opacity-80"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                      />
                      <LinkIcon className="w-4 h-4 text-zinc-500 absolute -z-10" />
                    </div>
                    <span className="text-sm font-medium text-zinc-200 truncate">{p.name}</span>
                  </div>
                  <span className="text-xs font-mono text-zinc-400 bg-black/20 px-2 py-1 rounded flex-shrink-0" style={{ letterSpacing: '0.02em' }}>{p.count} obras</span>
                </div>
              ))}
            </div>
          ) : (
    <div className="text-center py-6 ring-1 ring-dashed ring-white/[0.06] rounded-xl bg-[#111113]">
      <p className="text-xs text-zinc-500">No se detectaron enlaces externos.</p>
      <p className="text-[10px] text-zinc-600 mt-1">Añade links personalizados a tus obras para ver este ranking.</p>
            </div>
          )}
        </div>
      ) : (
        // --- PIE CHART WIDGET (Genre / Emotions) ---
        chartData.length > 0 ? (
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16 justify-center animate-fade-in">
            {/* The Chart (SVG Based) */}
            <div className="relative w-40 h-40 md:w-56 md:h-56 flex-shrink-0 flex items-center justify-center self-center">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform overflow-visible">
                {chartData.map((slice) => {
                  const isHighlighted = highlightedSlice === slice.label;
                  const isDimmed = highlightedSlice !== null && !isHighlighted;

                  return (
                    <circle
                      key={slice.label}
                      cx="50"
                      cy="50"
                      r={25}
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth="50"
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      onClick={() => setHighlightedSlice(isHighlighted ? null : slice.label)}
                      className={`transition-all duration-300 ease-out origin-center cursor-pointer ${
                        isHighlighted ? 'scale-110 drop-shadow-lg z-10 relative' : ''
                      } ${
                        isDimmed ? 'opacity-30 grayscale-[0.5]' : 'hover:opacity-90 hover:scale-105'
                      }`}
                      style={{ strokeOpacity: isHighlighted ? 1 : (isDimmed ? 0.4 : 1) }}
                    />
                  );
                })}
              </svg>
              {highlightedSlice && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-xs font-bold text-white bg-black/60 px-2 py-1 rounded backdrop-blur-md">
                    {chartData.find(d => d.label === highlightedSlice)?.percent.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {/* The Legend */}
            <div className="flex-1 w-full md:w-auto max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 gap-2">
                {chartData.map((slice, idx) => {
                  const isHighlighted = highlightedSlice === slice.label;
                  const isDimmed = highlightedSlice !== null && !isHighlighted;

                  return (
                    <div
                      key={idx}
                      onClick={() => setHighlightedSlice(isHighlighted ? null : slice.label)}
                      className={`flex items-center justify-between group cursor-pointer p-1.5 rounded-lg transition-all duration-300 ${
                        isHighlighted ? 'bg-white/10 shadow-lg ring-1 ring-white/[0.08] translate-x-1' : 'hover:bg-white/[0.04] ring-1 ring-transparent'
                      } ${
                        isDimmed ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-3 h-3 rounded-full shadow-sm flex-shrink-0 transition-transform ${isHighlighted ? 'scale-125' : ''}`}
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className={`text-sm font-medium transition-colors truncate flex-1 min-w-0 ${isHighlighted ? 'text-white font-bold' : 'text-zinc-300 group-hover:text-white'}`} title={slice.label}>
                          {slice.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className={`text-xs transition-colors ${isHighlighted ? 'text-white font-bold' : 'text-zinc-200'}`}>
                          {slice.percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full text-center py-10 opacity-50 flex flex-col items-center bg-[#111113] rounded-xl ring-1 ring-white/[0.06] ring-dashed">
            <PieChart className="w-10 h-10 text-zinc-500 mb-2" />
            <p className="text-sm font-medium text-zinc-400">Sin datos suficientes.</p>
            <p className="text-xs text-zinc-600">Añade tags a tus obras o aumenta tu consumo para ver este gráfico.</p>
          </div>
        )
)}
    </div>
    </div>
  );
};

export const ConsumptionDistribution = React.memo(ConsumptionDistributionInner);
