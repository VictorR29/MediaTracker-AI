import React from 'react';
import { MonitorPlay, Tv, Layers, Film, BookOpen, Book } from 'lucide-react';
import { StatsData } from './StatsData';

export interface PersonalRecapProps {
  stats: StatsData;
}

export const PersonalRecap: React.FC<PersonalRecapProps> = ({ stats }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {/* Visual Time Card */}
    <div className="group relative overflow-hidden rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-4 md:p-8 shadow-2xl transition-all hover:border-indigo-500/30 flex flex-col">
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
          <span className="text-3xl sm:text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-indigo-100 to-indigo-300 drop-shadow-sm tracking-tight break-words">
            {stats.visualTimeDisplay}
          </span>
        </div>

        {/* Chips Grid */}
        <div className="grid grid-cols-2 gap-2 md:gap-3 mt-auto">
          {/* Anime Chip */}
          <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:bg-slate-800/60 transition-colors group/chip min-w-0">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Tv className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover/chip:text-indigo-300 transition-colors truncate">Animes</span>
            </div>
            <div className="min-w-0">
              <span className="block text-lg md:text-xl font-bold text-white mb-0.5 truncate">{stats.animeEpisodes} <span className="text-xs font-medium text-slate-500">caps</span></span>
              <span className="block text-[10px] text-slate-500 truncate">{stats.consumedAnimes} obras</span>
            </div>
          </div>

          {/* Series Chip */}
          <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:bg-slate-800/60 transition-colors group/chip min-w-0">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Layers className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover/chip:text-purple-300 transition-colors truncate">Series</span>
            </div>
            <div className="min-w-0">
              <span className="block text-lg md:text-xl font-bold text-white mb-0.5 truncate">{stats.seriesEpisodes} <span className="text-xs font-medium text-slate-500">caps</span></span>
              <span className="block text-[10px] text-slate-500 truncate">{stats.consumedSeries} obras</span>
            </div>
          </div>

          {/* Movies Chip - Full width on bottom */}
          <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:bg-slate-800/60 transition-colors col-span-2 group/chip min-w-0">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Film className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover/chip:text-pink-300 transition-colors truncate">Películas</span>
            </div>
            <div className="flex justify-between items-end min-w-0">
              <div className="min-w-0">
                <span className="block text-lg md:text-xl font-bold text-white mb-0.5 truncate">{stats.consumedMovies} <span className="text-xs font-medium text-slate-500">vistas</span></span>
                <span className="block text-[10px] text-slate-500 truncate">{stats.consumedMovies} obras</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Reading Time Card */}
    <div className="group relative overflow-hidden rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 p-4 md:p-8 shadow-2xl transition-all hover:border-emerald-500/30 flex flex-col">
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
          <span className="text-3xl sm:text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-emerald-100 to-emerald-300 drop-shadow-sm tracking-tight break-words">
            {stats.readingTimeDisplay}
          </span>
        </div>

        {/* Chips Grid - Stacked on Desktop to match height of Visual Card */}
        <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-3 mt-auto">
          {/* Manhwa/Manga Chip */}
          <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:bg-slate-800/60 transition-colors group/chip min-w-0">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <BookOpen className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover/chip:text-orange-300 transition-colors truncate">Manhwa/Manga</span>
            </div>
            <div className="min-w-0">
              <span className="block text-lg md:text-xl font-bold text-white mb-0.5 truncate">{stats.readingChapters} <span className="text-xs font-medium text-slate-500">caps</span></span>
              <span className="block text-[10px] text-slate-500 truncate">{stats.consumedManhwas} obras</span>
            </div>
          </div>

          {/* Libros Chip */}
          <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:bg-slate-800/60 transition-colors group/chip min-w-0">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Book className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover/chip:text-emerald-300 transition-colors truncate">Libros</span>
            </div>
            <div className="min-w-0">
              <span className="block text-lg md:text-xl font-bold text-white mb-0.5 truncate">{stats.bookChapters} <span className="text-xs font-medium text-slate-500">pág</span></span>
              <span className="block text-[10px] text-slate-500 truncate">{stats.consumedBooks} obras</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
