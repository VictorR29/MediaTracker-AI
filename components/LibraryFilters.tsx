
import React, { useState } from 'react';
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
        <div className="bg-surface border border-slate-700 rounded-xl p-3 mb-4 space-y-3 shadow-lg relative z-20">
            <div className="flex gap-2">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                    type="text"
                    placeholder="Filtrar por título..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-slate-500"
                    value={filters.query}
                    onChange={(e) => handleChange('query', e.target.value)}
                    />
                </div>
                
                {/* Favorites Toggle Button (Desktop & Mobile) */}
                <button
                    onClick={() => handleChange('onlyFavorites', !filters.onlyFavorites)}
                    className={`flex items-center justify-center w-10 h-10 md:w-auto md:px-4 border rounded-lg transition-all ${
                        filters.onlyFavorites 
                        ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' 
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                    title="Ver solo Favoritos"
                >
                    <Star className={`w-5 h-5 ${filters.onlyFavorites ? 'fill-current' : ''}`} />
                    <span className="hidden md:inline-block ml-2 text-sm font-medium">Favoritos</span>
                </button>

                {/* View Mode Toggle (Catalog vs Grid) */}
                <button
                    onClick={onToggleViewMode}
                    className={`flex items-center justify-center w-10 h-10 border rounded-lg transition-all ${
                        viewMode === 'catalog'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' 
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                    title={viewMode === 'catalog' ? "Volver a Lista" : "Modo Catálogo"}
                >
                    {viewMode === 'catalog' ? <LayoutGrid className="w-5 h-5" /> : <GalleryVerticalEnd className="w-5 h-5" />}
                </button>

                {/* Mobile Filter Trigger Button */}
                <button 
                    onClick={() => setIsMobileModalOpen(true)}
                    className="md:hidden flex items-center justify-center w-10 h-10 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 relative"
                >
                    <Filter className="w-5 h-5" />
                    {activeFiltersCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {activeFiltersCount}
                        </div>
                    )}
                </button>
            </div>

            {/* Desktop Grid Layout (Hidden on Mobile) */}
            <div className="hidden md:grid grid-cols-5 gap-3">
                {/* Type */}
                <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-1">Tipo</label>
                <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-primary transition-colors cursor-pointer"
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
                <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-1">Estado</label>
                <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-primary transition-colors cursor-pointer"
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
                <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-1 flex items-center gap-1">
                    <Tags className="w-3 h-3"/> Género
                </label>
                <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-primary transition-colors cursor-pointer"
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
                <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-1">Calificación</label>
                <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-primary transition-colors cursor-pointer"
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
                <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-1 flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3"/> Ordenar
                </label>
                <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-primary transition-colors cursor-pointer"
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

        {/* Mobile Filter Modal (Full Screen Drawer) */}
        {isMobileModalOpen && (
            <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col md:hidden animate-fade-in">
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-surface">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Filter className="w-5 h-5 text-primary" /> Filtros
                    </h3>
                    <button onClick={() => setIsMobileModalOpen(false)} className="p-2 text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 space-y-6">
                     {/* Mobile Inputs Stack */}
                     <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tipo de Medio</label>
                        <div className="grid grid-cols-2 gap-2">
                             {['All', 'Anime', 'Serie', 'Pelicula', 'Manhwa', 'Manga', 'Libro', 'Comic'].map(opt => (
                                 <button
                                    key={opt}
                                    onClick={() => handleChange('type', opt)}
                                    className={`px-3 py-3 rounded-lg text-sm font-medium border transition-colors ${
                                        filters.type === opt 
                                        ? 'bg-primary/20 border-primary text-white' 
                                        : 'bg-slate-800 border-slate-700 text-slate-400'
                                    }`}
                                 >
                                     {opt === 'All' ? 'Todos' : (opt === 'Pelicula' ? 'Película' : opt)}
                                 </button>
                             ))}
                        </div>
                     </div>

                     <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Estado</label>
                        <select
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-primary"
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

                     <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Género</label>
                        <select
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-primary"
                            value={filters.genre}
                            onChange={(e) => handleChange('genre', e.target.value)}
                        >
                            <option value="All">Todos</option>
                            {availableGenres.map(genre => (
                            <option key={genre} value={genre}>{capitalize(genre)}</option>
                            ))}
                        </select>
                     </div>

                     <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Ordenar por</label>
                         <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
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
                                        ? 'bg-slate-600 text-white shadow' 
                                        : 'text-slate-400'
                                    }`}
                                 >
                                     {opt.label}
                                 </button>
                             ))}
                         </div>
                     </div>
                </div>

                <div className="p-4 bg-surface border-t border-slate-700">
                    <button 
                        onClick={() => setIsMobileModalOpen(false)}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3.5 rounded-xl shadow-lg"
                    >
                        <Check className="w-5 h-5" />
                        Ver Resultados
                    </button>
                </div>
            </div>
        )}
    </>
  );
};
