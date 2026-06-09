import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Clock, Tv, Clapperboard, BookOpen, Book, Layout, Trophy, Medal, Star } from 'lucide-react';
import { StatsData, ObsessionItem } from './StatsData';
import { vibrify, hexToRgb } from '../media-card/colorUtils';

export interface ObsessionTrackerProps {
  stats: StatsData;
}

// Tabs Configuration — pills
const OBSESSION_TABS = [
  { id: 'Anime', label: 'Anime', icon: Tv },
  { id: 'Series', label: 'Series', icon: Clapperboard },
  { id: 'Webtoon/Manga', label: 'Webtoon', icon: BookOpen },
  { id: 'Libros/Novelas', label: 'Libros', icon: Book },
];

// Color helper for rankings — uses dynamic accent or fallback
const getRankStyle = (index: number, accentHex: string) => {
  switch (index) {
    case 0: return {
      border: 'border-yellow-500',
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      icon: Trophy,
      label: '🥇',
      hex: '#eab308',
    };
    case 1: return {
      border: 'border-zinc-400',
      bg: 'bg-zinc-400/10',
      text: 'text-zinc-300',
      icon: Medal,
      label: '🥈',
      hex: '#a1a1aa',
    };
    case 2: return {
      border: 'border-amber-700',
      bg: 'bg-amber-700/10',
      text: 'text-amber-600',
      icon: Medal,
      label: '🥉',
      hex: '#b45309',
    };
    default: return {
      border: 'ring-zinc-600',
      bg: 'bg-zinc-700/10',
      text: 'text-zinc-500',
      icon: Star,
      label: `${index + 1}.`,
      hex: '#71717a',
    };
  }
};

export const ObsessionTracker: React.FC<ObsessionTrackerProps> = ({ stats }) => {
  const [obsessionTab, setObsessionTab] = useState<string>('Anime');

  // Set default obsession tab based on global max
  useEffect(() => {
    if (stats.globalMaxCategory && stats.topItemsByType[stats.globalMaxCategory]?.length > 0) {
      setObsessionTab(stats.globalMaxCategory);
    }
  }, [stats.globalMaxCategory]);

  const currentTopList: ObsessionItem[] = stats.topItemsByType[obsessionTab] || [];

  // Vibrify the #1 item's color for the ambient wash
  const topAccent = useMemo(() => {
    const topItem = currentTopList[0];
    if (!topItem) return null;
    const raw = topItem.primaryColor || '#c084fc';
    const boosted = vibrify(raw);
    return {
      hex: boosted,
      rgb: hexToRgb(boosted),
    };
  }, [currentTopList]);

  const unitLabel = obsessionTab.includes('Libro') || obsessionTab.includes('Webtoon') ? 'caps' : 'eps';

  return (
    <div
      className="bg-[#111113] ring-1 ring-white/[0.06] p-1 rounded-2xl shadow-lg transition-all overflow-hidden relative"
    >
      {/* Ambient wash from #1 item color */}
      {topAccent && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: `radial-gradient(ellipse 60% 40% at 30% 20%, rgba(${topAccent.rgb}, 0.08) 0%, transparent 70%)`,
          }}
        />
      )}

      <div
        className="bg-[#18181B] rounded-[calc(1rem-0.25rem)] p-4 md:p-6 relative z-10"
        style={topAccent ? { borderTop: `1px solid rgba(${topAccent.rgb}, 0.25)` } : undefined}
      >
        {/* Header + Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <span
              className="text-xs font-extrabold uppercase text-zinc-400 flex items-center gap-2"
              style={{ letterSpacing: '0.1em' }}
            >
              <Zap
                className="w-4 h-4"
                style={{
                  color: topAccent?.hex ?? '#eab308',
                  filter: `drop-shadow(0 0 6px ${topAccent?.hex ?? '#eab308'})`,
                }}
              />
              Top 3 Mayores Obsesiones
            </span>
            <p className="text-xs text-zinc-500 mt-1">Las obras que más tiempo han consumido de tu vida</p>
          </div>

          {/* Tabs as pills — flex-wrap, 44px touch targets */}
          <div className="flex flex-wrap gap-2">
            {OBSESSION_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = obsessionTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setObsessionTab(tab.id)}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap min-h-[44px] ${
                    isActive
                      ? 'bg-white text-[#09090B]'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.06] ring-1 ring-white/[0.06]'
                  }`}
                  style={isActive ? { boxShadow: `0 0 14px rgba(255, 255, 255, 0.2)` } : undefined}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TOP 3 LIST */}
        {currentTopList.length > 0 ? (
          <>
            {/* Mobile: horizontal scroll carousel — full-bleed cover, taller cards */}
            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 md:hidden scrollbar-none">
              {currentTopList.map((item, index) => {
                const style = getRankStyle(index, topAccent?.hex ?? '#eab308');
                const isTop1 = index === 0;

                return (
                  <div
                    key={item.id}
                    className={`relative rounded-2xl ring-1 overflow-hidden shadow-lg transition-all flex flex-col justify-end snap-center group shrink-0 min-w-[260px] w-[75vw] max-w-[320px] h-56 ${
                      isTop1 ? 'ring-2 ring-yellow-500' : 'ring-white/[0.06]'
                    }`}
                    style={isTop1 ? { boxShadow: `0 0 24px rgba(${topAccent?.rgb ?? '234,179,8'}, 0.3)` } : undefined}
                  >
                    {/* Cover — full bleed background */}
                    {item.coverImage ? (
                      <div className="absolute inset-0 z-0">
                        <img
                          src={item.coverImage}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-45"
                          alt=""
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-900/60 to-zinc-900/20" />
                      </div>
                    ) : (
                      <div
                        className="absolute inset-0 z-0"
                        style={{
                          background: `radial-gradient(ellipse at 50% 90%, rgba(${topAccent?.rgb ?? '161,161,170'}, 0.20) 0%, #09090B 70%)`,
                        }}
                      />
                    )}

                    {/* Rank watermark — large, semi-transparent */}
                    <div className="absolute top-3 right-4 z-10 pointer-events-none">
                      <span
                        className="text-6xl font-black leading-none"
                        style={{
                          color: `rgba(${topAccent?.rgb ?? '234,179,8'}, 0.12)`,
                        }}
                      >
                        {index + 1}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 w-full p-4">
                      <h4
                        className={`font-bold text-white leading-snug line-clamp-2 ${isTop1 ? 'text-base' : 'text-sm'}`}
                        title={item.title}
                      >
                        {item.title}
                      </h4>
                      <div className="flex items-center justify-between text-xs text-zinc-300 mt-2">
                        <span className="text-zinc-400">
                          {item.unitCount} {unitLabel}
                        </span>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 ring-1 ring-white/[0.06] backdrop-blur-sm">
                          <Clock className={`w-3 h-3 ${style.text}`} />
                          <span
                            className="font-mono font-bold text-white text-xs tracking-[0.02em]"
                            style={isTop1 ? { textShadow: `0 0 8px ${style.hex}80` } : undefined}
                          >
                            {(item.time / 60).toFixed(1)}h
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: 3-column grid */}
            <div className="hidden md:grid md:grid-cols-3 gap-4">
              {currentTopList.map((item, index) => {
                const style = getRankStyle(index, topAccent?.hex ?? '#eab308');
                const isTop1 = index === 0;

                return (
                  <div
                    key={item.id}
                    className={`relative rounded-2xl ring-1 overflow-hidden shadow-lg transition-all flex flex-col justify-end h-52 group ${
                      isTop1 ? 'ring-2 ring-yellow-500' : 'ring-white/[0.06]'
                    }`}
                    style={isTop1 ? { boxShadow: `0 0 24px rgba(${topAccent?.rgb ?? '234,179,8'}, 0.3)` } : undefined}
                  >
                    {/* Cover background */}
                    {item.coverImage ? (
                      <div className="absolute inset-0 z-0">
                        <img
                          src={item.coverImage}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-50 group-hover:opacity-35"
                          alt=""
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-900/50 to-transparent" />
                      </div>
                    ) : (
                      <div
                        className="absolute inset-0 z-0 opacity-30"
                        style={{
                          background: `radial-gradient(ellipse at 70% 80%, rgba(${topAccent?.rgb ?? '161,161,170'}, 0.3) 0%, #18181B 70%)`,
                        }}
                      />
                    )}

                    {/* Rank watermark */}
                    <div className="absolute top-3 right-4 z-10 pointer-events-none">
                      <span
                        className="text-7xl font-black leading-none"
                        style={{
                          color: `rgba(${topAccent?.rgb ?? '234,179,8'}, 0.10)`,
                        }}
                      >
                        {index + 1}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 w-full p-4">
                      <h4
                        className={`font-bold text-white leading-tight line-clamp-2 ${isTop1 ? 'text-lg' : 'text-base'}`}
                        title={item.title}
                      >
                        {item.title}
                      </h4>
                      <div className="flex items-center justify-between text-xs text-zinc-300 mt-2">
                        <span className="text-zinc-400">
                          {item.unitCount} {unitLabel}
                        </span>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 ring-1 ring-white/[0.06] backdrop-blur-sm">
                          <Clock className={`w-3 h-3 ${style.text}`} />
                          <span
                            className="font-mono font-bold text-white text-xs tracking-[0.02em]"
                            style={isTop1 ? { textShadow: `0 0 10px ${style.hex}80` } : undefined}
                          >
                            {(item.time / 60).toFixed(1)}h
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="w-full text-center py-10 flex flex-col items-center bg-[#111113] rounded-2xl ring-1 ring-white/[0.06]">
            <Layout className="w-8 h-8 text-zinc-600 mb-2" />
            <p className="text-xs font-medium text-zinc-400">Sin datos en {obsessionTab}.</p>
            <p className="text-xs text-zinc-600 mt-1">Registra progreso para ver tu ranking.</p>
          </div>
        )}
      </div>
    </div>
  );
};
