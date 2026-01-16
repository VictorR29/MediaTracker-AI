
import React, { useState } from 'react';
import { Search, Loader2, ArrowRight } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading, placeholder }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto relative group z-20">
      {/* Glow Effect behind search bar */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-secondary opacity-30 blur-xl group-hover:opacity-50 transition-opacity duration-500 rounded-2xl"></div>
      
      <form onSubmit={handleSubmit} className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 md:pl-5 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-slate-500 group-focus-within:text-slate-300 transition-colors" />
          )}
        </div>
        <input
          type="text"
          className="block w-full pl-12 md:pl-14 pr-28 md:pr-32 py-4 md:py-5 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl 
                     text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
                     transition-all shadow-2xl text-base md:text-lg truncate"
          placeholder={placeholder || "Busca un Anime, Serie o Película..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
        />
        
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="absolute inset-y-2 right-2 px-6 bg-primary hover:bg-indigo-600 text-white 
                     font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed 
                     flex items-center justify-center shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95"
          title="Buscar"
        >
          <span className="hidden md:inline">Buscar</span>
          <ArrowRight className="w-5 h-5 md:hidden" />
        </button>
      </form>
    </div>
  );
};
