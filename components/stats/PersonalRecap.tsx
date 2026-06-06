import React from 'react';
import { MonitorPlay, Tv, Layers, Film, BookOpen, Book } from 'lucide-react';
import { StatsData } from './StatsData';

export interface PersonalRecapProps {
  stats: StatsData;
}

export const PersonalRecap: React.FC<PersonalRecapProps> = ({ stats }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {/* Visual Time Card */}
    <div className="group relative overflow-hidden rounded-3xl bg-[#111113] ring-1 ring-white/[0.06] p-1 shadow-2xl transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col">
      {/* Decorative background glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-blue-500/15 transition-colors duration-700"></div>

      <div
        className="relative z-10 flex flex-col flex-1 w-full bg-[#18181B] rounded-[calc(1.5rem-0.25rem)] p-4 md:p-8"
        style={{ borderTop: '1px solid rgba(59, 130, 246, 0.25)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="p-2.5 bg-[#1C1C1F] rounded-xl text-blue-400 ring-1 ring-white/[0.06]"
            style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.35)' }}
          >
            <MonitorPlay className="w-6 h-6" style={{ filter: 'drop-shadow(0 0 6px #3b82f6)' }} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-none">Tiempo Visual</h3>
            <p className="text-xs text-zinc-400 mt-1">Invertidos en pantallas</p>
          </div>
        </div>

        {/* Main Metric */}
        <div className="mb-8">
          <span
            className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-white tracking-[-0.03em] break-words"
            style={{ textShadow: '0 0 30px rgba(59, 130, 246, 0.3)' }}
          >
            {stats.visualTimeDisplay}
          </span>
        </div>

        {/* Chips Grid */}
        <div className="grid grid-cols-2 gap-2 md:gap-3 mt-auto">
          {/* Anime Chip */}
          <div
            className="bg-[#1C1C1F] ring-1 ring-white/[0.06] rounded-2xl p-3 flex flex-col justify-between hover:bg-white/[0.04] transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] group/chip min-w-0"
            style={{ borderTop: '1px solid rgba(59, 130, 246, 0.2)' }}
          >
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Tv className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-zinc-400 group-hover/chip:text-blue-300 transition-colors truncate">Animes</span>
            </div>
            <div className="min-w-0">
              <span className="block text-lg md:text-xl font-bold font-mono text-white mb-0.5 truncate">{stats.animeEpisodes} <span className="text-xs font-medium text-zinc-500">caps</span></span>
              <span className="block text-[10px] text-zinc-500 font-mono truncate">{stats.consumedAnimes} obras</span>
            </div>
          </div>

          {/* Series Chip */}
          <div
            className="bg-[#1C1C1F] ring-1 ring-white/[0.06] rounded-2xl p-3 flex flex-col justify-between hover:bg-white/[0.04] transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] group/chip min-w-0"
            style={{ borderTop: '1px solid rgba(167, 139, 250, 0.2)' }}
          >
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Layers className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-zinc-400 group-hover/chip:text-purple-300 transition-colors truncate">Series</span>
            </div>
            <div className="min-w-0">
              <span className="block text-lg md:text-xl font-bold font-mono text-white mb-0.5 truncate">{stats.seriesEpisodes} <span className="text-xs font-medium text-zinc-500">caps</span></span>
              <span className="block text-[10px] text-zinc-500 font-mono truncate">{stats.consumedSeries} obras</span>
            </div>
          </div>

          {/* Movies Chip - Full width on bottom */}
          <div
            className="bg-[#1C1C1F] ring-1 ring-white/[0.06] rounded-2xl p-3 flex flex-col justify-between hover:bg-white/[0.04] transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] col-span-2 group/chip min-w-0"
            style={{ borderTop: '1px solid rgba(236, 72, 153, 0.2)' }}
          >
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Film className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-zinc-400 group-hover/chip:text-pink-300 transition-colors truncate">Películas</span>
            </div>
            <div className="flex justify-between items-end min-w-0">
              <div className="min-w-0">
                <span className="block text-lg md:text-xl font-bold font-mono text-white mb-0.5 truncate">{stats.consumedMovies} <span className="text-xs font-medium text-zinc-500">vistas</span></span>
                <span className="block text-[10px] text-zinc-500 font-mono truncate">{stats.consumedMovies} obras</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Reading Time Card */}
    <div className="group relative overflow-hidden rounded-3xl bg-[#111113] ring-1 ring-white/[0.06] p-1 shadow-2xl transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col">
      {/* Decorative background glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-emerald-500/30 transition-colors duration-700"></div>

      <div
        className="relative z-10 flex flex-col flex-1 w-full bg-[#18181B] rounded-[calc(1.5rem-0.25rem)] p-4 md:p-8"
        style={{ borderTop: '1px solid rgba(16, 185, 129, 0.25)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="p-2.5 bg-[#1C1C1F] rounded-xl text-emerald-400 ring-1 ring-white/[0.06]"
            style={{ boxShadow: '0 0 20px rgba(16, 185, 129, 0.35)' }}
          >
            <BookOpen className="w-6 h-6" style={{ filter: 'drop-shadow(0 0 6px #10b981)' }} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-none">Tiempo Lectura</h3>
            <p className="text-xs text-zinc-400 mt-1">Sumergido en historias</p>
          </div>
        </div>

        {/* Main Metric */}
        <div className="mb-8">
          <span
            className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-white tracking-[-0.03em] break-words"
            style={{ textShadow: '0 0 30px rgba(16, 185, 129, 0.3)' }}
          >
            {stats.readingTimeDisplay}
          </span>
        </div>

        {/* Chips Grid - Stacked on Desktop to match height of Visual Card */}
        <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-3 mt-auto">
          {/* Manhwa/Manga Chip */}
          <div
            className="bg-[#1C1C1F] ring-1 ring-white/[0.06] rounded-2xl p-3 flex flex-col justify-between hover:bg-white/[0.04] transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] group/chip min-w-0"
            style={{ borderTop: '1px solid rgba(249, 115, 22, 0.2)' }}
          >
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <BookOpen className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-zinc-400 group-hover/chip:text-orange-300 transition-colors truncate">Manhwa/Manga</span>
            </div>
            <div className="min-w-0">
              <span className="block text-lg md:text-xl font-bold font-mono text-white mb-0.5 truncate">{stats.readingChapters} <span className="text-xs font-medium text-zinc-500">caps</span></span>
              <span className="block text-[10px] text-zinc-500 font-mono truncate">{stats.consumedManhwas} obras</span>
            </div>
          </div>

          {/* Libros Chip */}
          <div
            className="bg-[#1C1C1F] ring-1 ring-white/[0.06] rounded-2xl p-3 flex flex-col justify-between hover:bg-white/[0.04] transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] group/chip min-w-0"
            style={{ borderTop: '1px solid rgba(16, 185, 129, 0.2)' }}
          >
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Book className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-zinc-400 group-hover/chip:text-emerald-300 transition-colors truncate">Libros</span>
            </div>
            <div className="min-w-0">
              <span className="block text-lg md:text-xl font-bold font-mono text-white mb-0.5 truncate">{stats.bookChapters} <span className="text-xs font-medium text-zinc-500">pág</span></span>
              <span className="block text-[10px] text-zinc-500 font-mono truncate">{stats.consumedBooks} obras</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
