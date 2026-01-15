import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MediaItem, RATING_TO_SCORE } from '../types';
import { getRecommendations, RecommendationResult } from '../services/geminiService';
import { Sparkles, Compass, Tv, BookOpen, Clapperboard, Film, Loader2, Plus, AlertCircle, ChevronDown, ChevronUp, Filter, X, Search, Wand2, ArrowLeft, Info, Quote } from 'lucide-react';

interface DiscoveryViewProps {
  library: MediaItem[];
  apiKey: string;
  onSelectRecommendation: (title: string) => void;
  onToggleImmersive?: (isImmersive: boolean) => void;
}

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({ library, apiKey, onSelectRecommendation, onToggleImmersive }) => {
  // Mode State
  const [viewMode, setViewMode] = useState<'filters' | 'immersive'>('filters');
  
  // Filter State
  const [selectedType, setSelectedType] = useState<string>('Anime');
  const [selectedSeeds, setSelectedSeeds] = useState<string[]>([]);
  const [seedSearchQuery, setSeedSearchQuery] = useState('');
  const [isRefineOpen, setIsRefineOpen] = useState(true);

  // Recommendations State
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Immersive View State
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'up' | 'down' | null>(null);

  // 3D Tilt Ref
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  
  // Touch Handling Ref
  const touchStartY = useRef<number>(0);

  // --- IMMERSIVE MODE HANDLER ---
  useEffect(() => {
      if (onToggleImmersive) {
          onToggleImmersive(viewMode === 'immersive');
      }
      return () => {
          if (onToggleImmersive) onToggleImmersive(false);
      }
  }, [viewMode, onToggleImmersive]);

  // --- LOGIC: Seed Selection ---
  const availableSeedItems = useMemo(() => {
    const targetTypes = selectedType === 'Manhwa' 
        ? ['Manhwa', 'Manga', 'Comic'] 
        : [selectedType];
    return library.filter(item => targetTypes.includes(item.aiData.mediaType));
  }, [library, selectedType]);

  const filteredSeedCandidates = useMemo(() => {
      if (!seedSearchQuery.trim()) return availableSeedItems;
      return availableSeedItems.filter(item => 
          item.aiData.title.toLowerCase().includes(seedSearchQuery.toLowerCase())
      );
  }, [availableSeedItems, seedSearchQuery]);

  const { topGenres, likedTitles, excludedTitles } = useMemo(() => {
    const genreCounts: Record<string, number> = {};
    const liked: string[] = [];
    const excluded: string[] = [];

    library.forEach(item => excluded.push(item.aiData.title));

    if (selectedSeeds.length > 0) {
        const seedItems = library.filter(item => selectedSeeds.includes(item.id));
        seedItems.forEach(item => {
            liked.push(item.aiData.title);
            item.aiData.genres.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
        });
    } else {
        const targetTypes = selectedType === 'Manhwa' ? ['Manhwa', 'Manga', 'Comic'] : [selectedType];
        library.forEach(item => {
            if (targetTypes.includes(item.aiData.mediaType)) {
                const rating = item.trackingData.rating;
                const score = RATING_TO_SCORE[rating] || 0;
                if ((score >= 7 || (score === 0 && item.trackingData.status === 'Completado'))) {
                    liked.push(item.aiData.title);
                    item.aiData.genres.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
                }
            }
        });
    }

    const sortedGenres = Object.entries(genreCounts).sort(([, a], [, b]) => b - a).map(([g]) => g).slice(0, 5);
    return { topGenres: sortedGenres, likedTitles: liked, excludedTitles: excluded };
  }, [library, selectedType, selectedSeeds]);

  // --- ACTIONS ---

  const handleDiscovery = async () => {
    if (!apiKey) {
        setError("Configura tu API Key en ajustes para usar la IA.");
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setRecommendations([]);

    try {
      const results = await getRecommendations(likedTitles, topGenres, excludedTitles, selectedType, apiKey);
      
      if (results.length === 0) {
          setError("La IA no devolvió resultados válidos. Intenta de nuevo.");
          setIsLoading(false);
      } else {
          setRecommendations(results);
          setCurrentIndex(0);
          setViewMode('immersive');
          setIsLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError("Error al conectar con Gemini.");
      setIsLoading(false);
    }
  };

  // --- INTERACTION LOGIC ---

  const handleNext = () => {
      if (currentIndex < recommendations.length - 1) {
          setSwipeDirection('up');
          setTimeout(() => {
              setCurrentIndex(prev => prev + 1);
              setSwipeDirection(null);
              setIsInfoOpen(false);
          }, 400); 
      }
  };

  const handlePrev = () => {
      if (currentIndex > 0) {
          setSwipeDirection('down');
          setTimeout(() => {
              setCurrentIndex(prev => prev - 1);
              setSwipeDirection(null);
              setIsInfoOpen(false);
          }, 400);
      }
  };

  const calculateTilt = (clientX: number, clientY: number) => {
      if (!cardRef.current) return;
      const { left, top, width, height } = cardRef.current.getBoundingClientRect();
      const x = (clientX - left) / width;
      const y = (clientY - top) / height;
      
      const tiltX = (0.5 - y) * 20; 
      const tiltY = (x - 0.5) * 20;

      setTilt({ x: tiltX, y: tiltY });
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      calculateTilt(e.clientX, e.clientY);
  };

  const handleMouseLeave = () => {
      setTilt({ x: 0, y: 0 });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length > 0) {
          const touch = e.touches[0];
          calculateTilt(touch.clientX, touch.clientY);
      }
  };

  // --- RENDER HELPERS ---
  
  // Helper to generate deterministic colors from string
  const getColorData = (title: string) => {
      const seed = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      
      const gradients = [
          { bg: 'from-pink-500 to-rose-600', shadow: '#e11d48' },
          { bg: 'from-indigo-500 to-violet-600', shadow: '#7c3aed' },
          { bg: 'from-emerald-500 to-teal-600', shadow: '#0d9488' },
          { bg: 'from-amber-500 to-orange-600', shadow: '#ea580c' },
          { bg: 'from-blue-500 to-cyan-600', shadow: '#0891b2' },
          { bg: 'from-fuchsia-500 to-purple-600', shadow: '#9333ea' },
          { bg: 'from-red-500 to-orange-600', shadow: '#dc2626' },
      ];
      
      const selected = gradients[seed % gradients.length];
      return selected;
  };

  const currentCard = recommendations[currentIndex];
  
  // Dynamic Background Gradient based on current card
  const bgStyle = useMemo(() => {
      if (!currentCard) return { background: '#0f172a' };
      const colors = getColorData(currentCard.title);
      return {
          background: `radial-gradient(circle at 50% 30%, ${colors.shadow}40 0%, #0f172a 100%)` 
      };
  }, [currentCard]);

  // --- GENERATIVE COVER RENDERER ---
  const renderGenerativeCard = (title: string, type: string) => {
      const colors = getColorData(title);
      
      return (
          <div className={`w-full h-full bg-gradient-to-br ${colors.bg} flex flex-col items-center justify-center p-8 text-center relative overflow-hidden`}>
              {/* Texture Overlay */}
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
              
              {/* Decorative Circle */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>

              {/* Content */}
              <div className="relative z-10 flex flex-col items-center h-full justify-between py-12">
                  <div className="border border-white/30 bg-white/10 p-3 rounded-full backdrop-blur-md shadow-lg">
                      <Sparkles className="w-8 h-8 text-white drop-shadow-md" />
                  </div>
                  
                  <div className="flex-grow flex items-center justify-center w-full">
                      <h1 className="text-3xl md:text-5xl font-black text-white leading-tight uppercase tracking-tighter drop-shadow-xl break-words w-full" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                          {title}
                      </h1>
                  </div>

                  <span className="px-4 py-1.5 bg-black/30 text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] backdrop-blur-md border border-white/10 shadow-lg">
                      {type}
                  </span>
              </div>
          </div>
      );
  };

  if (viewMode === 'immersive' && currentCard) {
      const cardColors = getColorData(currentCard.title);

      return (
          <div 
             className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden touch-none"
             style={bgStyle}
          >
              {/* Animated Background Overlay */}
              <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[2px]"></div>

              {/* NAVIGATION BAR (Floating Pills) */}
              <div className="absolute top-4 left-0 right-0 z-50 px-4 md:px-6 pt-safe flex justify-between items-center w-full max-w-lg mx-auto pointer-events-none">
                  {/* Left: Counter Badge */}
                  <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg animate-fade-in-up">
                      <Sparkles className="w-3 h-3 text-yellow-400" />
                      <span className="text-xs font-bold text-white font-mono">
                          {currentIndex + 1} / {recommendations.length}
                      </span>
                  </div>

                  {/* Right: Back Button */}
                  <button 
                      onClick={() => setViewMode('filters')}
                      className="pointer-events-auto bg-black/40 hover:bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold transition-all border border-white/10 flex items-center gap-2 shadow-lg animate-fade-in-up hover:scale-105"
                  >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Filtros</span>
                  </button>
              </div>

              {/* CARD CONTAINER */}
              <div className="relative w-full max-w-md h-[70vh] md:h-[600px] perspective-1000 flex items-center justify-center">
                   
                   {/* Previous Card Ghost (Animation) */}
                   {swipeDirection === 'up' && (
                       <div className="absolute inset-0 bg-slate-800 rounded-3xl opacity-0 transform -translate-y-full scale-75 transition-all duration-500 ease-out pointer-events-none"></div>
                   )}

                   {/* ACTIVE CARD */}
                   <div 
                      ref={cardRef}
                      className={`relative w-[90%] md:w-[360px] h-full rounded-3xl shadow-2xl transition-all duration-500 ease-out cursor-pointer transform-style-3d ${
                          swipeDirection === 'up' ? '-translate-y-[150%] opacity-0 rotate-12' : 
                          swipeDirection === 'down' ? 'translate-y-[150%] opacity-0 -rotate-12' : 'translate-y-0 opacity-100'
                      }`}
                      style={{
                          transform: !swipeDirection 
                            ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1)` 
                            : undefined,
                          boxShadow: `0 25px 50px -12px ${cardColors.shadow}60`
                      }}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => setIsInfoOpen(true)}
                   >
                        {/* CARD CONTENT - Pure Generative */}
                        <div className="absolute inset-0 rounded-3xl overflow-hidden bg-slate-900 border border-white/10">
                             {renderGenerativeCard(currentCard.title, currentCard.mediaType)}

                             {/* Info Hint Overlay */}
                             <div className="absolute bottom-6 left-0 right-0 text-center transition-opacity duration-300 pointer-events-none" style={{ opacity: isInfoOpen ? 0 : 1 }}>
                                 <p className="text-xs font-medium text-white/60 flex items-center justify-center gap-2 bg-black/20 backdrop-blur-md py-1 px-3 rounded-full mx-auto w-fit">
                                     <Info className="w-3 h-3" /> Toca para detalles
                                 </p>
                             </div>
                        </div>
                   </div>

                   {/* NAVIGATION ZONES (Desktop) */}
                   <div 
                      className="absolute right-[-60px] top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center cursor-pointer hover:scale-110 transition-transform p-2"
                      onClick={(e) => { e.stopPropagation(); handleNext(); }}
                   >
                       <div className="bg-white/10 p-3 rounded-full backdrop-blur-md border border-white/20">
                            <ChevronDown className="w-6 h-6 text-white" />
                       </div>
                   </div>
                   {currentIndex > 0 && (
                        <div 
                        className="absolute left-[-60px] top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center cursor-pointer hover:scale-110 transition-transform p-2"
                        onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                        >
                            <div className="bg-white/10 p-3 rounded-full backdrop-blur-md border border-white/20">
                                    <ChevronUp className="w-6 h-6 text-white" />
                            </div>
                        </div>
                   )}
              </div>

              {/* GLASSMORPHISM INFO SHEET */}
              <div 
                 className={`absolute bottom-0 left-0 right-0 bg-slate-900/85 backdrop-blur-xl border-t border-white/10 rounded-t-3xl p-6 md:p-8 transition-transform duration-500 ease-out z-50 max-w-2xl mx-auto shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${
                     isInfoOpen ? 'translate-y-0' : 'translate-y-full'
                 }`}
              >
                  {/* Handle Bar */}
                  <div 
                    className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 cursor-pointer"
                    onClick={() => setIsInfoOpen(false)}
                  ></div>

                  <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 pr-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1 block">
                            Recomendación IA
                        </span>
                        <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                            {currentCard.title}
                        </h2>
                      </div>
                      <button 
                         onClick={() => setIsInfoOpen(false)}
                         className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
                      >
                          <ChevronDown className="w-5 h-5 text-white" />
                      </button>
                  </div>

                  <div className="space-y-4 mb-8">
                       <p className="text-slate-200 text-sm leading-relaxed font-medium">
                           {currentCard.synopsis}
                       </p>
                       
                       <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 flex gap-3">
                           <Quote className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5 fill-current opacity-50" />
                           <p className="text-xs md:text-sm text-indigo-200 font-medium italic">
                               "{currentCard.reason}"
                           </p>
                       </div>
                  </div>

                  <div className="flex gap-3">
                      <button 
                        onClick={() => {
                            onSelectRecommendation(currentCard.title);
                            setIsInfoOpen(false);
                        }}
                        className="flex-1 bg-white text-slate-900 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shadow-lg"
                      >
                          <Search className="w-5 h-5" />
                          Buscar y añadir
                      </button>
                      <button 
                         onClick={handleNext}
                         className="px-6 py-3.5 bg-slate-800 text-white font-bold rounded-xl border border-white/10 hover:bg-slate-700 transition-colors"
                      >
                          Siguiente
                      </button>
                  </div>
              </div>

              {/* Mobile Swipe Trigger Zone (Invisible) */}
              <div 
                 className="absolute inset-0 z-40 md:hidden"
                 onClick={() => !isInfoOpen && setIsInfoOpen(true)}
                 onTouchStart={(e) => {
                     touchStartY.current = e.touches[0].clientY;
                 }}
                 onTouchMove={handleTouchMove}
                 onTouchEnd={(e) => {
                     const touchEndY = e.changedTouches[0].clientY;
                     const diff = touchStartY.current - touchEndY;
                     
                     setTilt({ x: 0, y: 0 }); // Reset tilt on release

                     if (diff > 50) { 
                         handleNext();
                     } else if (diff < -50) {
                         if (isInfoOpen) setIsInfoOpen(false);
                         else handlePrev();
                     }
                 }}
              />
              <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .pt-safe { padding-top: env(safe-area-inset-top, 20px); }
              `}</style>
          </div>
      );
  }

  // --- STANDARD FILTERS VIEW ---

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

             {/* SEED REFINER */}
             <div className="bg-slate-950/60 rounded-xl border border-slate-700/60 overflow-hidden mb-8 transition-all">
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
                                    ? `${selectedSeeds.length} obras seleccionadas.`
                                    : "Opcional: Selecciona obras para encontrar similares."}
                            </p>
                        </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isRefineOpen ? 'rotate-180' : ''}`} />
                </div>
                
                {isRefineOpen && (
                    <div className="p-4 space-y-4 animate-fade-in">
                        {/* Selected Seeds */}
                        {selectedSeeds.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {selectedSeeds.map(seedId => {
                                    const item = library.find(i => i.id === seedId);
                                    if (!item) return null;
                                    return (
                                        <div key={seedId} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 bg-primary/20 border border-primary/40 rounded-full text-xs font-bold text-white shadow-sm">
                                            <span className="truncate max-w-[150px]">{item.aiData.title}</span>
                                            <button onClick={() => setSelectedSeeds(prev => prev.filter(id => id !== seedId))} className="p-0.5 hover:bg-primary/40 rounded-full">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                                <button onClick={() => setSelectedSeeds([])} className="text-xs text-slate-500 hover:text-red-400 underline ml-2">Limpiar</button>
                            </div>
                        )}

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                                type="text"
                                placeholder={`Buscar ${selectedType} en tu biblioteca...`}
                                value={seedSearchQuery}
                                onChange={(e) => setSeedSearchQuery(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-primary transition-all placeholder-slate-600"
                            />
                        </div>

                        {/* Candidates */}
                        <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {filteredSeedCandidates
                                    .filter(item => !selectedSeeds.includes(item.id))
                                    .slice(0, 20)
                                    .map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            if (!selectedSeeds.includes(item.id)) setSelectedSeeds(prev => [...prev, item.id]);
                                            setSeedSearchQuery('');
                                        }}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all text-left group"
                                    >
                                        <div className="w-8 h-10 bg-slate-800 rounded flex items-center justify-center text-slate-600 text-[8px] font-bold border border-slate-700">
                                            {item.aiData.mediaType.slice(0,2)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-slate-300 group-hover:text-white truncate">{item.aiData.title}</p>
                                        </div>
                                        <Plus className="w-4 h-4 text-slate-600 group-hover:text-primary ml-auto opacity-0 group-hover:opacity-100 transition-all" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
             </div>

             <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                 <div className="text-xs text-slate-400 hidden md:block">
                     {selectedSeeds.length > 0 
                        ? <span className="text-primary font-medium">Búsqueda personalizada activa</span>
                        : <span>Analizando perfil general</span>
                     }
                 </div>
                 <button
                    onClick={handleDiscovery}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto justify-center"
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