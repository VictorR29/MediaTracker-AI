import React, { useState } from 'react';
import { Search, Loader2, ArrowRight } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-8 px-2 sm:px-0">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-spin" />
          ) : (
            <Search className="h-5 w-5 sm:h-6 sm:w-6 text-slate-400 group-focus-within:text-primary transition-colors" />
          )}
        </div>
        <input
          type="text"
          className="block w-full pl-10 sm:pl-12 pr-14 sm:pr-32 py-3 sm:py-4 bg-surface border border-slate-700 rounded-xl 
                     text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary 
                     focus:border-transparent transition-all shadow-lg text-base sm:text-lg truncate"
          placeholder="Busca un Anime, Serie o Manhwa..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="absolute inset-y-1.5 right-1.5 sm:inset-y-2 sm:right-2 aspect-square sm:aspect-auto px-0 sm:px-6 w-10 sm:w-auto bg-primary hover:bg-indigo-600 text-white 
                     font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md"
          title="Buscar"
        >
          <span className="hidden sm:inline">Buscar</span>
          <ArrowRight className="w-5 h-5 sm:hidden" />
        </button>
      </form>
    </div>
  );
};