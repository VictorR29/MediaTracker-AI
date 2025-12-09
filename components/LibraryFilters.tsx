
import React from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import { RATING_OPTIONS } from '../types';

export interface FilterState {
  query: string;
  type: string;
  status: string;
  rating: string;
  sortBy: 'updated' | 'title' | 'progress';
}

interface LibraryFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export const LibraryFilters: React.FC<LibraryFiltersProps> = ({ filters, onChange }) => {
  const handleChange = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-surface border border-slate-700 rounded-xl p-4 mb-6 space-y-4 shadow-lg">
      {/* Top Row: Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Filtrar por título..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-slate-500"
          value={filters.query}
          onChange={(e) => handleChange('query', e.target.value)}
        />
      </div>

      {/* Bottom Row: Selects */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
             <option value="Viendo/Leyendo">Viendo/Leyendo</option>
             <option value="Completado">Completado</option>
             <option value="En Pausa">En Pausa</option>
             <option value="Descartado">Descartado</option>
             <option value="Planeado / Pendiente">Planeado / Pendiente</option>
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
  );
};