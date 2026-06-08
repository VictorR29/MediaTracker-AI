import React from 'react';
import { MediaItem } from '../../types';
import { MOOD_OPTIONS, MEDIA_TYPES } from './constants';
import { Sparkles, Compass, Loader2, AlertCircle, ChevronDown, Filter, X, Search, Wand2, Heart, Plus } from 'lucide-react';

export interface FilterViewProps {
  library: MediaItem[];
  selectedType: string;
  onSelectType: (type: string) => void;
  selectedSeeds: string[];
  onToggleSeed: (id: string) => void;
  onClearSeeds: () => void;
  seedSearchQuery: string;
  onSeedSearchChange: (query: string) => void;
  selectedMood: string | null;
  onToggleMood: (mood: string | null) => void;
  isRefineOpen: boolean;
  onToggleRefine: () => void;
  isMoodOpen: boolean;
  onToggleMoodPanel: () => void;
  isLoading: boolean;
  error: string | null;
  onGenerate: () => void;
}

const FilterViewInner: React.FC<FilterViewProps> = ({
  library,
  selectedType,
  onSelectType,
  selectedSeeds,
  onToggleSeed,
  onClearSeeds,
  seedSearchQuery,
  onSeedSearchChange,
  selectedMood,
  onToggleMood,
  isRefineOpen,
  onToggleRefine,
  isMoodOpen,
  onToggleMoodPanel,
  isLoading,
  error,
  onGenerate,
}) => {
  const availableSeedItems = React.useMemo(() => {
    const targetTypes = selectedType === 'Manhwa'
      ? ['Manhwa', 'Manga', 'Comic']
      : [selectedType];
    return library.filter(item => targetTypes.includes(item.aiData.mediaType));
  }, [library, selectedType]);

  const filteredSeedCandidates = React.useMemo(() => {
    if (!seedSearchQuery.trim()) return availableSeedItems;
    return availableSeedItems.filter(item =>
      item.aiData.title.toLowerCase().includes(seedSearchQuery.toLowerCase())
    );
  }, [availableSeedItems, seedSearchQuery]);

  return (
    <div className="animate-fade-in pb-12">
  <div className="flex items-center gap-3 mb-6 border-l-4 border-white pl-4">
    <h2 className="text-2xl font-bold text-white">Descubrimiento IA</h2>
    <Sparkles className="w-5 h-5 text-white animate-pulse" />
      </div>

      <div className="bg-[#111113] ring-1 ring-white/[0.06] rounded-2xl p-4 md:p-8 mb-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="relative z-10 max-w-5xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-violet-400" />
                Motor de Recomendación
              </h3>
              <p className="text-zinc-400 text-sm mt-1">
                Selecciona una categoría y deja que la IA analice tus gustos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {MEDIA_TYPES.map(type => {
              const Icon = type.icon;
              const isSelected = selectedType === type.value;
              return (
                <button
                  key={type.value}
                  onClick={() => onSelectType(type.value)}
                  className={`flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${isSelected
                    ? 'text-white shadow-lg'
                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                  }`}
                  style={isSelected ? {
                    backgroundColor: `${type.activeColor}15`,
                    borderColor: `${type.activeColor}60`,
                    boxShadow: `0 0 12px ${type.activeColor}20`,
                    color: type.activeColor,
                  } : undefined}
                >
                  <Icon className={`w-3.5 h-3.5`} />
                  <span className="uppercase tracking-wide">{type.label}</span>
                </button>
              );
            })}
          </div>

          {/* Refine by Works Panel */}
<div className="bg-zinc-950/60 rounded-xl ring-1 ring-white/[0.04] overflow-hidden mb-4 transition-all">
  <div
    className="p-4 bg-zinc-900/50 border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
    onClick={onToggleRefine}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedSeeds.length > 0 ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-200">
                    Refinar por Obras Específicas
                  </h4>
                  <p className="text-xs text-zinc-500">
                    {selectedSeeds.length > 0
                      ? `${selectedSeeds.length} obras seleccionadas.`
                      : "Opcional: Selecciona obras para encontrar similares."}
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${isRefineOpen ? 'rotate-180' : ''}`} />
            </div>

            {isRefineOpen && (
              <div className="p-4 space-y-4 animate-fade-in">
                {selectedSeeds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedSeeds.map(seedId => {
                      const item = library.find(i => i.id === seedId);
                      if (!item) return null;
                      return (
  <div key={seedId} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white/20 ring-1 ring-white/[0.06] rounded-full text-xs font-bold text-white shadow-sm">
    <span className="truncate max-w-[150px]">{item.aiData.title}</span>
    <button onClick={() => onToggleSeed(seedId)} className="p-0.5 hover:bg-white/40 rounded-full">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                    <button onClick={onClearSeeds} className="text-xs text-zinc-500 hover:text-red-400 underline ml-2">Limpiar</button>
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder={`Buscar ${selectedType} en tu biblioteca...`}
                    value={seedSearchQuery}
                    onChange={(e) => onSeedSearchChange(e.target.value)}
                    className="w-full bg-zinc-900 ring-1 ring-white/[0.06] rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-white/20 transition-all placeholder-zinc-600"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {filteredSeedCandidates
                      .filter(item => !selectedSeeds.includes(item.id))
                      .slice(0, 20)
                      .map(item => (
                        <button
                          key={item.id}
                          onClick={() => onToggleSeed(item.id)}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 ring-1 ring-transparent hover:ring-white/[0.06] transition-all text-left group"
                        >
                          <div className="w-8 h-12 bg-zinc-800 rounded overflow-hidden flex-shrink-0 ring-1 ring-white/[0.06] relative">
                            {item.aiData.coverImage ? (
                              <img
                                src={item.aiData.coverImage}
                                alt={item.aiData.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-[8px] font-bold">
                                {item.aiData.mediaType.slice(0, 2)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-zinc-300 group-hover:text-white truncate">{item.aiData.title}</p>
                          </div>
                          <Plus className="w-4 h-4 text-zinc-600 group-hover:text-white ml-auto opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Refine by Mood Panel */}
<div className="bg-zinc-950/60 rounded-xl ring-1 ring-white/[0.04] overflow-hidden mb-8 transition-all">
  <div
    className="p-4 bg-zinc-900/50 border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
    onClick={onToggleMoodPanel}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedMood ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-200">
                    Refinar por Mood
                  </h4>
                  <p className="text-xs text-zinc-500">
                    {selectedMood ? selectedMood : "Dinos cómo te sientes hoy para personalizar la experiencia."}
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${isMoodOpen ? 'rotate-180' : ''}`} />
            </div>

      {isMoodOpen && (
        <div className="p-4 animate-fade-in">
          <div className="flex flex-wrap gap-2">
            {MOOD_OPTIONS.map((mood) => {
              const isSelected = selectedMood === mood.label;
              return (
                <button
                  key={mood.label}
                  onClick={() => onToggleMood(isSelected ? null : mood.label)}
                  className={`flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${isSelected
                    ? 'bg-white/10 border-white/30 text-white shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                    : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-sm">{mood.emoji}</span>
                  <span className="truncate max-w-[180px]">{mood.label}</span>
                </button>
              );
            })}
          </div>
                {selectedMood && (
                  <button onClick={() => onToggleMood(null)} className="mt-3 text-xs text-zinc-500 hover:text-red-400 underline flex items-center gap-1">
                    <X className="w-3 h-3" /> Quitar filtro de mood
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-xs text-zinc-400 hidden md:block">
              {selectedSeeds.length > 0 || selectedMood
                ? <span className="text-white font-medium">Búsqueda personalizada activa</span>
                : <span>Analizando perfil general</span>
              }
            </div>
            <button
              onClick={onGenerate}
              disabled={isLoading}
              className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-zinc-900 font-bold py-3 px-8 rounded-full shadow-lg shadow-white/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto justify-center"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Compass className="w-5 h-5" />}
              {isLoading ? 'Analizando...' : 'Generar Experiencia'}
            </button>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-900/20 px-4 py-2 rounded-lg border border-red-500/30 animate-fade-in">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
)}
      </div>
      </div>
      </div>
    );
};

export const FilterView = React.memo(FilterViewInner);
