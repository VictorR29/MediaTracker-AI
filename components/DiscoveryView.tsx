
import React, { useState, useMemo, useEffect } from 'react';
import { MediaItem, RATING_TO_SCORE } from '../types';
import { getRecommendations, RecommendationResult } from '../services/geminiService';
import { Sparkles, Compass, Tv, BookOpen, Clapperboard, Film, Loader2, Plus, AlertCircle, ChevronDown, ChevronUp, Filter, Check, X, Search, Wand2, Lightbulb } from 'lucide-react';

interface DiscoveryViewProps {
  library: MediaItem[];
  apiKey: string;
  onSelectRecommendation: (title: string) => void;
}

// Subcomponent to handle individual card state (expand/collapse)
const RecommendationCard: React.FC<{ 
    rec: RecommendationResult; 
    onSelect: (title: string) => void 
}> = ({ rec, onSelect }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div 
            className="bg-surface border border-slate-700 rounded-xl p-6 hover:border-slate-500 transition-all shadow-lg flex flex-col group h-full relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -translate-y-10 translate-x-10 pointer-events-none group-hover:bg-primary/10 transition-colors"></div>

            <div className="flex justify-between items-start mb-3 relative z-10">
                <h4 className="text-lg font-bold text-white group-hover:text-primary transition-colors leading-tight">{rec.title}</h4>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700 shrink-0 ml-2">
                    {rec.mediaType}
                </span>
            </div>
            
            <div className="mb-4 flex-grow relative z-10">
                <p className={`text-slate-400 text-sm transition-all duration-300 ${isExpanded ? '' : 'line-clamp-3'}`}>
                    {rec.synopsis}
                </p>
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-primary mt-1 hover:underline focus:outline-none flex items-center gap-1 font-medium"
                >
                    {isExpanded ? (
                        <><ChevronUp className="w-3 h-3" /> Leer menos</>
                    ) : (
                        <><ChevronDown className="w-3 h-3" /> Leer más</>
                    )}
                </button>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 mb-4 relative z-10">
                <p className="text-xs text-indigo-300 italic flex gap-2">
                    <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className={isExpanded ? '' : 'line-clamp-2'}>"{rec.reason}"</span>
                </p>
            </div>

            <button 
                onClick={() => onSelect(rec.title)}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-lg transition-colors border border-slate-700 hover:border-primary/50 group/btn mt-auto relative z-10"
            >
                <Plus className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                Agregar a Biblioteca
            </button>
        </div>
    );
};

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({ library, apiKey, onSelectRecommendation }) => {
  const [selectedType, setSelectedType] = useState<string>('Anime');
  const [selectedSeeds, setSelectedSeeds] = useState<string[]>([]); // Array of MediaItem IDs
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search state for seeds
  const [seedSearchQuery, setSeedSearchQuery] = useState('');
  const [isRefineOpen, setIsRefineOpen] = useState(true); // Default open to show functionality

  // Clear seeds when type changes
  useEffect(() => {
    setSelectedSeeds([]);
    setSeedSearchQuery('');
  }, [selectedType]);

  // Determine items available for selection as seeds based on current type
  const availableSeedItems = useMemo(() => {
    const targetTypes = selectedType === 'Manhwa' 
        ? ['Manhwa', 'Manga', 'Comic'] 
        : [selectedType];
    
    return library.filter(item => targetTypes.includes(item.aiData.mediaType));
  }, [library, selectedType]);

  // Filter available items based on search
  const filteredSeedCandidates = useMemo(() => {
      if (!seedSearchQuery.trim()) return availableSeedItems;
      return availableSeedItems.filter(item => 
          item.aiData.title.toLowerCase().includes(seedSearchQuery.toLowerCase())
      );
  }, [availableSeedItems, seedSearchQuery]);

  // Logic to Prepare Data for AI
  const { topGenres, likedTitles, excludedTitles } = useMemo(() => {
    const genreCounts: Record<string, number> = {};
    const liked: string[] = [];
    const excluded: string[] = [];

    // Always exclude everything in the library to prevent duplicates
    library.forEach(item => excluded.push(item.aiData.title));

    if (selectedSeeds.length > 0) {
        // --- REFINED MODE: Use ONLY selected items as base ---
        const seedItems = library.filter(item => selectedSeeds.includes(item.id));
        
        seedItems.forEach(item => {
            liked.push(item.aiData.title);
            item.aiData.genres.forEach(g => {
                genreCounts[g] = (genreCounts[g] || 0) + 1;
            });
        });

    } else {
        // --- DEFAULT MODE: Use "Taste Profile" of entire category ---
        const targetTypes = selectedType === 'Manhwa' 
            ? ['Manhwa', 'Manga', 'Comic'] 
            : [selectedType];

        library.forEach(item => {
            if (targetTypes.includes(item.aiData.mediaType)) {
                const rating = item.trackingData.rating;
                const score = RATING_TO_SCORE[rating] || 0;
                
                // Consider "liked" if high score (>=7) OR completed (and not rated bad)
                const isBad = score > 0 && score < 6; 
                if (!isBad && (score >= 7 || (score === 0 && item.trackingData.status === 'Completado'))) {
                    liked.push(item.aiData.title);
                    item.aiData.genres.forEach(g => {
                        genreCounts[g] = (genreCounts[g] || 0) + 1;
                    });
                }
            }
        });
    }

    const sortedGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([g]) => g)
      .slice(0, 5); // Take top 5 genres

    return { 
        topGenres: sortedGenres, 
        likedTitles: liked, 
        excludedTitles: excluded
    };
  }, [library, selectedType, selectedSeeds]);

  const handleAddSeed = (id: string) => {
      if (!selectedSeeds.includes(id)) {
          setSelectedSeeds(prev => [...prev, id]);
      }
      setSeedSearchQuery(''); // Optional: clear search after adding
  };

  const handleRemoveSeed = (id: string) => {
      setSelectedSeeds(prev => prev.filter(seedId => seedId !== id));
  };

  const handleDiscovery = async () => {
    if (!apiKey) {
        setError("Configura tu API Key en ajustes para usar la IA.");
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setRecommendations([]);

    try {
      const results = await getRecommendations(
        likedTitles,
        topGenres,
        excludedTitles,
        selectedType,
        apiKey
      );
      
      if (results.length === 0) {
          setError("La IA no devolvió resultados válidos. Intenta de nuevo con diferentes filtros.");
      } else {
          setRecommendations(results);
      }
    } catch (err) {
      console.error(err);
      setError("Error al conectar con Gemini. Verifica tu conexión.");
    } finally {
      setIsLoading(false);
    }
  };

  const MEDIA_TYPES = [
    { label: 'Anime', value: 'Anime', icon: Tv, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/50' },
    { label: 'Series', value: 'Serie', icon: Clapperboard, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/50' },
    { label: 'Películas', value: 'Pelicula', icon: Film, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/50' },
    { label: 'Libros', value: 'Libro', icon: BookOpen, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/50' },
    { label: 'Manhwa/Manga', value: 'Manhwa', icon: BookOpen, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/50' },
  ];

  return (
    <div className="animate-fade-in pb-12">
      <div className="flex items-center gap-3 mb-6 border-l-4 border-primary pl-4">
         <h2 className="text-2xl font-bold text-white">Descubrimiento IA</h2>
         <Sparkles className="w-5 h-5 text-primary animate-pulse" />
      </div>

      <div className="bg-gradient-to-br from-surface to-slate-900 border border-slate-700 rounded-2xl p-4 md:p-8 mb-8 shadow-xl relative overflow-hidden">
         {/* Background Decoration */}
         <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

         <div className="relative z-10 max-w-5xl">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                 <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-indigo-400" />
                        Motor de Recomendación
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">
                        Selecciona una categoría y deja que la IA analice tus gustos.
                    </p>
                 </div>
             </div>

             {/* Type Selector */}
             <div className="flex flex-wrap gap-2 md:gap-3 mb-8">
                {MEDIA_TYPES.map(type => {
                    const Icon = type.icon;
                    const isSelected = selectedType === type.value;
                    return (
                        <button
                          key={type.value}
                          onClick={() => setSelectedType(type.value)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all duration-300 ${
                              isSelected 
                              ? `${type.bg} shadow-lg shadow-${type.color.split('-')[1]}-500/10 ring-1 ring-${type.color.split('-')[1]}-500` 
                              : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-400 hover:bg-slate-750'
                          }`}
                        >
                            <Icon className={`w-4 h-4 ${isSelected ? type.color : ''}`} />
                            <span className={`text-sm font-medium ${isSelected ? 'text-white' : ''}`}>{type.label}</span>
                        </button>
                    );
                })}
             </div>

             {/* SEED REFINER SECTION - IMPROVED DESIGN */}
             <div className="bg-slate-950/60 rounded-xl border border-slate-700/60 overflow-hidden mb-8 transition-all">
                {/* Header */}
                <div 
                    className="p-4 bg-slate-900/50 border-b border-slate-700/50 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
                    onClick={() => setIsRefineOpen(!isRefineOpen)}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${selectedSeeds.length > 0 ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-slate-500'}`}>
                            <Filter className="w-4 h-4" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-200">
                                Refinar por Obras Específicas
                            </h4>
                            <p className="text-xs text-slate-500">
                                {selectedSeeds.length > 0 
                                    ? `${selectedSeeds.length} obras seleccionadas como referencia.`
                                    : "Opcional: Selecciona obras específicas para encontrar similares."}
                            </p>
                        </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isRefineOpen ? 'rotate-180' : ''}`} />
                </div>
                
                {/* Body */}
                {isRefineOpen && (
                    <div className="p-4 space-y-4 animate-fade-in">
                        {/* 1. Selected Seeds Display */}
                        {selectedSeeds.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {selectedSeeds.map(seedId => {
                                    const item = library.find(i => i.id === seedId);
                                    if (!item) return null;
                                    return (
                                        <div 
                                            key={seedId} 
                                            className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 bg-primary/20 border border-primary/40 rounded-full text-xs font-bold text-white shadow-sm animate-fade-in"
                                        >
                                            <span className="truncate max-w-[150px]">{item.aiData.title}</span>
                                            <button 
                                                onClick={() => handleRemoveSeed(seedId)}
                                                className="p-0.5 hover:bg-primary/40 rounded-full transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                                <button 
                                    onClick={() => setSelectedSeeds([])}
                                    className="text-xs text-slate-500 hover:text-red-400 underline decoration-dotted underline-offset-2 ml-2 transition-colors"
                                >
                                    Limpiar todo
                                </button>
                            </div>
                        )}

                        {/* 2. Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                                type="text"
                                placeholder={`Buscar ${selectedType} en tu biblioteca...`}
                                value={seedSearchQuery}
                                onChange={(e) => setSeedSearchQuery(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder-slate-600"
                            />
                        </div>

                        {/* 3. Candidates List */}
                        <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {filteredSeedCandidates.length === 0 ? (
                                <div className="text-center py-6 text-slate-500">
                                    {seedSearchQuery ? (
                                        <p className="text-xs">No se encontraron obras con ese nombre.</p>
                                    ) : (
                                        <div className="flex flex-col items-center">
                                            <Lightbulb className="w-6 h-6 text-slate-600 mb-2 opacity-50" />
                                            <p className="text-xs">No hay obras de este tipo disponibles para seleccionar.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {filteredSeedCandidates
                                        .filter(item => !selectedSeeds.includes(item.id)) // Hide already selected
                                        .slice(0, 20) // Limit displayed items for perf if query is empty
                                        .map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleAddSeed(item.id)}
                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all text-left group"
                                        >
                                            {item.aiData.coverImage && !item.aiData.coverImage.includes('placehold.co') ? (
                                                <img 
                                                    src={item.aiData.coverImage} 
                                                    alt="" 
                                                    className="w-8 h-10 object-cover rounded shadow-sm opacity-80 group-hover:opacity-100 transition-opacity" 
                                                />
                                            ) : (
                                                <div className="w-8 h-10 bg-slate-800 rounded flex items-center justify-center text-slate-600 text-[8px] font-bold border border-slate-700">
                                                    {item.aiData.mediaType.slice(0,2)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-slate-300 group-hover:text-white truncate">
                                                    {item.aiData.title}
                                                </p>
                                                <p className="text-[10px] text-slate-500 truncate">
                                                    {item.aiData.genres.slice(0,2).join(', ')}
                                                </p>
                                            </div>
                                            <Plus className="w-4 h-4 text-slate-600 group-hover:text-primary ml-auto opacity-0 group-hover:opacity-100 transition-all" />
                                        </button>
                                    ))}
                                    {filteredSeedCandidates.length > 20 && !seedSearchQuery && (
                                        <p className="text-[10px] text-slate-500 text-center col-span-full py-2">
                                            Escribe para buscar más obras...
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
             </div>

             <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                 <div className="text-xs text-slate-400 hidden md:block">
                     {selectedSeeds.length > 0 
                        ? <span className="text-primary font-medium">Búsqueda personalizada activa</span>
                        : <span>Analizando tu perfil general</span>
                     }
                 </div>
                 <button
                    onClick={handleDiscovery}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto justify-center"
                    >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Compass className="w-5 h-5" />}
                    {isLoading ? 'Analizando...' : (selectedSeeds.length > 0 ? 'Buscar Similares' : 'Generar Recomendaciones')}
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

      {recommendations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
              {recommendations.map((rec, idx) => (
                  <RecommendationCard 
                      key={idx} 
                      rec={rec} 
                      onSelect={onSelectRecommendation} 
                  />
              ))}
          </div>
      )}
    </div>
  );
};
