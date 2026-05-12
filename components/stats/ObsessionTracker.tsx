import React, { useState, useEffect } from 'react';
import { Zap, Clock, Tv, Clapperboard, BookOpen, Book, Layout, Trophy, Medal, Star } from 'lucide-react';
import { StatsData, ObsessionItem } from './StatsData';

export interface ObsessionTrackerProps {
  stats: StatsData;
}

// Tabs Configuration
const OBSESSION_TABS = [
  { id: 'Anime', label: 'Anime', icon: Tv },
  { id: 'Series', label: 'Series', icon: Clapperboard },
  { id: 'Webtoon/Manga', label: 'Webtoon', icon: BookOpen },
  { id: 'Libros/Novelas', label: 'Libros', icon: Book },
];

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

export const ObsessionTracker: React.FC<ObsessionTrackerProps> = ({ stats }) => {
  const [obsessionTab, setObsessionTab] = useState<string>('Anime');

  // Set default obsession tab based on global max
  useEffect(() => {
    if (stats.globalMaxCategory && stats.topItemsByType[stats.globalMaxCategory]?.length > 0) {
      setObsessionTab(stats.globalMaxCategory);
    }
  }, [stats.globalMaxCategory]);

  const currentTopList: ObsessionItem[] = stats.topItemsByType[obsessionTab] || [];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 md:p-6 shadow-md transition-all overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" /> Top 3 Mayores Obsesiones
          </span>
          <p className="text-sm text-slate-400 mt-1">Las obras que más tiempo han consumido de tu vida</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900 p-2 rounded-lg w-full md:w-auto">
          {OBSESSION_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = obsessionTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setObsessionTab(tab.id)}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap w-full ${
                  isActive
                    ? 'bg-primary text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3 h-3 flex-shrink-0" />
                <span>{tab.label}</span>
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
                {/* Background Image for ALL ITEMS */}
                {item.coverImage ? (
                  <div className="absolute inset-0 z-0">
                    <img src={item.coverImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-40" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent"></div>
                  </div>
                ) : (
                  <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-800 to-slate-900 opacity-50"></div>
                )}

                {/* Content */}
                <div className="relative z-10 w-full p-4">
                  {/* Rank Badge */}
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
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/40 border border-white/10 backdrop-blur-sm">
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
  );
};
