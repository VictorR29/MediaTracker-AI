
import React, { useState, useMemo } from 'react';
import { MediaItem, RATING_TO_SCORE } from '../types';
import { getRecommendations, RecommendationResult } from '../services/geminiService';
import { Sparkles, Compass, Tv, BookOpen, Clapperboard, Film, Loader2, Plus, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

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
            className="bg-surface border border-slate-700 rounded-xl p-6 hover:border-slate-500 transition-all shadow-lg flex flex-col group h-full"
        >
            <div className="flex justify-between items-start mb-2">
                <h4 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{rec.title}</h4>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700 shrink-0 ml-2">
                    {rec.mediaType}
                </span>
            </div>
            
            <div className="mb-4 flex-grow">
                <p className={`text-slate-400 text-sm transition-all duration-300 ${isExpanded ? '' : 'line-clamp-3'}`}>
                    {rec.synopsis}
                </p>
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-primary mt-1 hover:underline focus:outline-none flex items-center gap-1"
                >
                    {isExpanded ? (
                        <><ChevronUp className="w-3 h-3" /> Leer menos</>
                    ) : (
                        <><ChevronDown className="w-3 h-3" /> Leer más</>
                    )}
                </button>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 mb-4">
                <p className="text-xs text-indigo-300 italic flex gap-2">
                    <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className={isExpanded ? '' : 'line-clamp-2'}>"{rec.reason}"</span>
                </p>
            </div>

            <button 
                onClick={() => onSelect(rec.title)}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-lg transition-colors border border-slate-700 hover:border-primary/50 group/btn mt-auto"
            >
                <Plus className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                Agregar a Biblioteca
            </button>
        </div>
    );
};

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({ library, apiKey, onSelectRecommendation }) => {
  const [selectedType, setSelectedType] = useState<string>('Anime');
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analyze Library for Preferences based on Selected Type
  const { topGenres, likedTitles, excludedTitles, relevantCount } = useMemo(() => {
    const genreCounts: Record<string, number> = {};
    const liked: string[] = [];
    const excluded: string[] = [];
    let count = 0;

    // Mapping for grouping similar types
    // If user selects Manhwa, we look for Manhwa, Manga, and Comics for context
    const targetTypes = selectedType === 'Manhwa' 
        ? ['Manhwa', 'Manga', 'Comic'] 
        : [selectedType];

    library.forEach(item => {
      // Exclude everything in library from results to avoid duplicates
      excluded.push(item.aiData.title);
      
      // Only use items matching the selected type for the "Taste Profile"
      if (targetTypes.includes(item.aiData.mediaType)) {
          count++;
          const rating = item.trackingData.rating;
          const score = RATING_TO_SCORE[rating] || 0;
          
          // Filter out items explicitly rated as bad (Score 1-5)
          const isBad = score > 0 && score < 6; 
          
          // Consider "liked" if high score (>=7) OR completed (and not rated bad)
          // If unrated but completed, we assume it was at least engaging enough to finish
          if (!isBad && (score >= 7 || (score === 0 && item.trackingData.status === 'Completado'))) {
            liked.push(item.aiData.title);
            item.aiData.genres.forEach(g => {
              genreCounts[g] = (genreCounts[g] || 0) + 1;
            });
          }
      }
    });

    const sortedGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([g]) => g)
      .slice(0, 3);

    return { 
        topGenres: sortedGenres, 
        likedTitles: liked, 
        excludedTitles: excluded,
        relevantCount: count 
    };
  }, [library, selectedType]);

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
          setError("La IA no devolvió resultados válidos. Intenta de nuevo.");
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

      <div className="bg-gradient-to-br from-surface to-slate-900 border border-slate-700 rounded-2xl p-6 md:p-8 mb-8 shadow-xl relative overflow-hidden">
         {/* Background Decoration */}
         <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

         <div className="relative z-10 max-w-3xl">
             <h3 className="text-xl font-bold text-white mb-2">¿Qué quieres descubrir hoy?</h3>
             <p className="text-slate-400 mb-6 text-sm leading-relaxed">
                Analizando tus <strong>{relevantCount} obras de {selectedType === 'Manhwa' ? 'Manga/Manhwa' : selectedType}</strong> guardadas 
                {likedTitles.length > 0 ? (
                    <span>, basándonos en tus favoritos como <em>{likedTitles.slice(0,2).join(", ")}</em></span>
                ) : (
                   <span> (aún no tienes favoritos en esta categoría)</span>
                )}
                {topGenres.length > 0 && <span> y tu afinidad por <strong>{topGenres[0]}</strong></span>}.
             </p>

             <div className="flex flex-wrap gap-3 mb-8">
                {MEDIA_TYPES.map(type => {
                    const Icon = type.icon;
                    const isSelected = selectedType === type.value;
                    return (
                        <button
                          key={type.value}
                          onClick={() => setSelectedType(type.value)}
                          className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-300 ${
                              isSelected 
                              ? `${type.bg} shadow-lg shadow-${type.color.split('-')[1]}-500/10 ring-1 ring-${type.color.split('-')[1]}-500` 
                              : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-400'
                          }`}
                        >
                            <Icon className={`w-5 h-5 ${isSelected ? type.color : ''}`} />
                            <span className={`font-medium ${isSelected ? 'text-white' : ''}`}>{type.label}</span>
                        </button>
                    );
                })}
             </div>

             <button
               onClick={handleDiscovery}
               disabled={isLoading}
               className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Compass className="w-5 h-5" />}
                {isLoading ? 'Analizando tus gustos...' : 'Generar Recomendaciones'}
             </button>
             
             {error && (
                <div className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-900/20 px-4 py-2 rounded-lg border border-red-500/30">
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
