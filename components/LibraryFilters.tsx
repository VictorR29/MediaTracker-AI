
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ArrowUpDown, Tags, Filter, X, Check, Star, LayoutGrid, GalleryVerticalEnd } from 'lucide-react';
import { RATING_OPTIONS } from '../types';

export interface FilterState {
  query: string;
  type: string;
  status: string;
  rating: string;
  genre: string;
  sortBy: 'updated' | 'title' | 'progress';
  onlyFavorites: boolean;
}

interface LibraryFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  availableGenres: string[];
  viewMode: 'grid' | 'catalog'; // New Prop
  onToggleViewMode: () => void; // New Prop
}

export const LibraryFilters: React.FC<LibraryFiltersProps> = ({ filters, onChange, availableGenres, viewMode, onToggleViewMode }) => {
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  const handleChange = (key: keyof FilterState, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Count active filters for notification badge
  const activeFiltersCount = [
      filters.type !== 'All',
      filters.status !== 'All',
      filters.rating !== 'All',
      filters.genre !== 'All',
      filters.onlyFavorites
  ].filter(Boolean).length;

  return (
    <>
        {/* Search Bar - Always Visible */}
        <div className="mb-6 space-y-4 relative z-20">
            <div className="flex gap-2">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                    type="text"
                    placeholder="Filtrar por título..."
                    className="w-full bg-zinc-800/50 backdrop-blur-md ring-1 ring-white/[0.06] rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-white/20 focus:ring-white/20 outline-none transition-all placeholder-zinc-500 shadow-sm hover:bg-zinc-800"
                    value={filters.query}
                    onChange={(e) => handleChange('query', e.target.value)}
                    />
                </div>
                
                {/* Favorites Toggle Button (Desktop & Mobile) */}
                <button
                    onClick={() => handleChange('onlyFavorites', !filters.onlyFavorites)}
                    className={`flex items-center justify-center w-12 h-12 md:w-auto md:px-5 border rounded-xl transition-all shadow-sm ${
                        filters.onlyFavorites 
? 'bg-yellow-500/20 ring-1 ring-yellow-500 text-yellow-500'
    : 'bg-zinc-800/50 ring-1 ring-white/[0.06] text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                    title="Ver solo Favoritos"
                >
                    <Star className={`w-5 h-5 ${filters.onlyFavorites ? 'fill-current' : ''}`} />
                    <span className="hidden md:inline-block ml-2 text-sm font-bold">Favoritos</span>
                </button>

                {/* View Mode Toggle (Catalog vs Grid) */}
                <button
                    onClick={onToggleViewMode}
                    className={`flex items-center justify-center w-12 h-12 border rounded-xl transition-all shadow-sm ${
                        viewMode === 'catalog'
? 'bg-violet-500/20 ring-1 ring-violet-500 text-violet-400'
    : 'bg-zinc-800/50 ring-1 ring-white/[0.06] text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                    title={viewMode === 'catalog' ? "Volver a Lista" : "Modo Catálogo"}
                >
                    {viewMode === 'catalog' ? <LayoutGrid className="w-5 h-5" /> : <GalleryVerticalEnd className="w-5 h-5" />}
                </button>

                {/* Mobile Filter Trigger Button */}
                <button 
                    onClick={() => setIsMobileModalOpen(true)}
                    className="md:hidden flex items-center justify-center w-12 h-12 bg-zinc-800/50 ring-1 ring-white/[0.06] rounded-xl text-zinc-300 relative shadow-sm"
                >
                    <Filter className="w-5 h-5" />
                    {activeFiltersCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-white text-zinc-900 text-[10px] font-bold rounded-full flex items-center justify-center">
                            {activeFiltersCount}
                        </div>
                    )}
                </button>
            </div>

            {/* Desktop Grid Layout (Hidden on Mobile) */}
            <div className="hidden md:grid grid-cols-5 gap-3">
                {/* Type */}
                <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1">Tipo</label>
                <select
                    className="w-full bg-zinc-800/50 ring-1 ring-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none focus:ring-white/20 transition-colors cursor-pointer appearance-none shadow-sm hover:bg-zinc-800"
                    value={filters.type}
                    onChange={(e) => handleChange('type', e.target.value)}
                >
                    <option value="All">Todos</option>
                    <option value="Anime">Anime</option>
                    <option value="Serie">Serie</option>
                    <option value="Pelicula">Película</option>
                    <option value="Manhwa">Manhwa</option>
                    <option value="Manga">Manga</option>
                    <option value="Comic">Comic</option>
                    <option value="Libro">Libro</option>
                </select>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1">Estado</label>
                <select
                    className="w-full bg-zinc-800/50 ring-1 ring-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none focus:ring-white/20 transition-colors cursor-pointer appearance-none shadow-sm hover:bg-zinc-800"
                    value={filters.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                >
                    <option value="All">Todos</option>
                    <option value="Sin empezar">Sin empezar</option>
                    <option value="Viendo/Leyendo">Viendo/Leyendo</option>
                    <option value="Completado">Completado</option>
                    <option value="En Pausa">En Pausa</option>
                    <option value="Descartado">Descartado</option>
                    <option value="Planeado / Pendiente">Planeado / Pendiente</option>
                </select>
                </div>

                {/* Genre */}
                <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1 flex items-center gap-1">
                    <Tags className="w-3 h-3"/> Género
                </label>
                <select
                    className="w-full bg-zinc-800/50 ring-1 ring-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none focus:ring-white/20 transition-colors cursor-pointer appearance-none shadow-sm hover:bg-zinc-800"
                    value={filters.genre}
                    onChange={(e) => handleChange('genre', e.target.value)}
                >
                    <option value="All">Todos</option>
                    {availableGenres.map(genre => (
                    <option key={genre} value={genre}>{capitalize(genre)}</option>
                    ))}
                </select>
                </div>

                {/* Rating */}
                <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1">Calificación</label>
                <select
                    className="w-full bg-zinc-800/50 ring-1 ring-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none focus:ring-white/20 transition-colors cursor-pointer appearance-none shadow-sm hover:bg-zinc-800"
                    value={filters.rating}
                    onChange={(e) => handleChange('rating', e.target.value)}
                >
                    <option value="All">Todas</option>
                    {RATING_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
                </div>

                {/* Sort */}
                <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1 flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3"/> Ordenar
                </label>
                <select
                    className="w-full bg-zinc-800/50 ring-1 ring-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none focus:ring-white/20 transition-colors cursor-pointer appearance-none shadow-sm hover:bg-zinc-800"
                    value={filters.sortBy}
                    onChange={(e) => handleChange('sortBy', e.target.value as any)}
                >
                    <option value="updated">Recientes</option>
                    <option value="title">A-Z</option>
                    <option value="progress">Progreso %</option>
                </select>
                </div>
            </div>
        </div>

    {/* Mobile Filter Modal — rendered via Portal to body to escape any stacking context */}
    {isMobileModalOpen && createPortal(
      <div
        className="md:hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(9,9,11,0.95)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      >
        {/* Header */}
        <div style={{ flexShrink: 0, padding: '1rem', backgroundColor: '#111113', borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Filter className="w-5 h-5 text-white" /> Filtros
          </h3>
          <button onClick={() => setIsMobileModalOpen(false)} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', padding: '1rem' }} className="space-y-6">
          {/* Tipo */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Tipo de Medio</label>
            <div className="grid grid-cols-2 gap-2">
              {['All', 'Anime', 'Serie', 'Pelicula', 'Manhwa', 'Manga', 'Libro', 'Comic'].map(opt => (
                <button
                  key={opt}
                  onClick={() => handleChange('type', opt)}
                  className={`px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    filters.type === opt
                      ? 'bg-white/20 ring-1 ring-white/20 text-white'
                      : 'bg-zinc-800 ring-1 ring-white/[0.06] text-zinc-400'
                  }`}
                >
                  {opt === 'All' ? 'Todos' : (opt === 'Pelicula' ? 'Película' : opt)}
                </button>
              ))}
            </div>
          </div>

          {/* Estado */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Estado</label>
            <select
              className="w-full bg-zinc-800 ring-1 ring-white/[0.06] rounded-xl px-4 py-3 text-white outline-none focus:ring-white/20"
              value={filters.status}
              onChange={(e) => handleChange('status', e.target.value)}
            >
              <option value="All">Todos</option>
              <option value="Sin empezar">Sin empezar</option>
              <option value="Viendo/Leyendo">Viendo/Leyendo</option>
              <option value="Completado">Completado</option>
              <option value="En Pausa">En Pausa</option>
              <option value="Descartado">Descartado</option>
              <option value="Planeado / Pendiente">Planeado / Pendiente</option>
            </select>
          </div>

          {/* Género */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Género</label>
            <select
              className="w-full bg-zinc-800 ring-1 ring-white/[0.06] rounded-xl px-4 py-3 text-white outline-none focus:ring-white/20"
              value={filters.genre}
              onChange={(e) => handleChange('genre', e.target.value)}
            >
              <option value="All">Todos</option>
              {availableGenres.map(genre => (
                <option key={genre} value={genre}>{capitalize(genre)}</option>
              ))}
            </select>
          </div>

          {/* Calificación */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Calificación</label>
            <select
              className="w-full bg-zinc-800 ring-1 ring-white/[0.06] rounded-xl px-4 py-3 text-white outline-none focus:ring-white/20"
              value={filters.rating}
              onChange={(e) => handleChange('rating', e.target.value)}
            >
              <option value="All">Todas</option>
              {RATING_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Ordenar */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Ordenar por</label>
            <div className="flex bg-zinc-800 rounded-lg p-1 ring-1 ring-white/[0.06]">
              {[
                { label: 'Recientes', value: 'updated' },
                { label: 'A-Z', value: 'title' },
                { label: 'Progreso', value: 'progress' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleChange('sortBy', opt.value as any)}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                    filters.sortBy === opt.value
                      ? 'bg-zinc-600 text-white shadow'
                      : 'text-zinc-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer — GUARANTEED visible, no Tailwind, inline styles only */}
        <div style={{ flexShrink: 0, padding: '1rem', backgroundColor: '#111113', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setIsMobileModalOpen(false)}
            className="w-full flex items-center justify-center gap-2 bg-white text-zinc-900 font-bold py-3.5 rounded-full shadow-lg active:scale-[0.98]"
          >
            <Check className="w-5 h-5" />
            Ver Resultados
          </button>
        </div>
      </div>,
      document.body
    )}
    </>
  );
};
