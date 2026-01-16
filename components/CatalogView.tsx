
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { MediaItem, normalizeGenre } from '../types';
import { PlayCircle, Star, Tv, BookOpen, Clapperboard, ChevronRight, ChevronLeft, Info, Eye, Compass, Clock, FileText, Film, Book } from 'lucide-react';

interface CatalogViewProps {
  library: MediaItem[]; // Filtered items from parent
  onOpenDetail: (item: MediaItem) => void;
}

// -- Subcomponent: 3D Flip Poster (Updated Style) --
const CatalogPoster: React.FC<{ 
    item: MediaItem; 
    onDetail: () => void;
    onHoverColor: (color: string) => void;
}> = ({ item, onDetail, onHoverColor }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    
    if (!item || !item.aiData || !item.trackingData) return null;

    const { aiData, trackingData } = item;
    
    const imageSrc = aiData.coverImage && (aiData.coverImage.startsWith('http') || aiData.coverImage.startsWith('data:'))
        ? aiData.coverImage
        : `https://placehold.co/400x600/1e293b/94a3b8?text=${encodeURIComponent(aiData.title)}&font=roboto`;

    let progressPercent = 0;
    if (aiData.mediaType === 'Pelicula') {
        progressPercent = trackingData.status === 'Completado' ? 100 : 0;
    } else {
        progressPercent = trackingData.totalEpisodesInSeason > 0
            ? Math.min(100, (trackingData.watchedEpisodes / trackingData.totalEpisodesInSeason) * 100)
            : 0;
    }

    const dynamicColor = aiData.primaryColor || '#6366f1';
    const isReadingContent = ['Manhwa', 'Manga', 'Comic', 'Libro'].includes(aiData.mediaType);

    const getStatusColorDot = () => {
        switch (trackingData.status) {
            case 'Viendo/Leyendo': return isReadingContent ? 'bg-blue-500' : 'bg-green-500';
            case 'Completado': return 'bg-slate-500';
            case 'Sin empezar': return 'bg-yellow-500';
            case 'En Pausa': return 'bg-orange-500';
            case 'Planeado / Pendiente': return 'bg-purple-500';
            case 'Descartado': return 'bg-red-500';
            default: return 'bg-slate-500';
        }
    };

    const getTypeIcon = () => {
        switch (aiData.mediaType) {
          case 'Anime': return <Tv className="w-3 h-3" />;
          case 'Manhwa': case 'Manga': return <BookOpen className="w-3 h-3" />;
          case 'Comic': return <FileText className="w-3 h-3" />;
          case 'Libro': return <Book className="w-3 h-3" />;
          default: return <Clapperboard className="w-3 h-3" />;
        }
    };

    const handleClick = () => setIsFlipped(!isFlipped);
    
    return (
        <div 
            className="group relative w-48 h-72 md:w-56 md:h-80 flex-shrink-0 cursor-pointer perspective-1000"
            onMouseEnter={() => onHoverColor(dynamicColor)}
            onClick={handleClick}
        >
            <div className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${isFlipped ? 'rotate-y-180' : 'group-hover:scale-105'}`}>
                
                {/* FRONT FACE (Visual Style Matching CompactMediaCard) */}
                <div className="absolute w-full h-full backface-hidden rounded-2xl overflow-hidden shadow-xl border border-white/5 bg-[#1A1D26] flex flex-col">
                    
                    {/* Image Area */}
                    <div className="relative w-full flex-grow overflow-hidden">
                        <img 
                            src={imageSrc} 
                            alt={aiData.title} 
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        {/* Improved Gradient: Pure black for better legibility, avoiding blue/gray tint */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                        
                        {/* Badge */}
                        <div className="absolute top-3 left-3">
                            <span 
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-white text-[10px] font-bold uppercase tracking-wider shadow-lg"
                                style={{ backgroundColor: dynamicColor }}
                            >
                                {getTypeIcon()}
                                {aiData.mediaType.toUpperCase()}
                            </span>
                        </div>

                        {/* Title & Status */}
                        <div className="absolute bottom-2 left-0 right-0 p-3 z-10">
                            <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow-md mb-1.5">
                                {aiData.title}
                            </h3>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${getStatusColorDot()} shadow-[0_0_8px_currentColor]`} />
                                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wide">
                                    {trackingData.status === 'Viendo/Leyendo' ? (isReadingContent ? 'Leyendo' : 'Viendo') : trackingData.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-[#1A1D26] px-3 py-2.5 flex items-center justify-between border-t border-white/5 relative z-20 flex-shrink-0 h-10">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {isReadingContent ? 'CPS.' : 'TEMP.'} {trackingData.currentSeason}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span className="font-mono">{trackingData.watchedEpisodes}/{trackingData.totalEpisodesInSeason || '?'}</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1 w-full bg-slate-800 flex-shrink-0">
                        <div 
                            className="h-full transition-all duration-700" 
                            style={{ 
                                width: `${progressPercent}%`,
                                backgroundColor: dynamicColor
                            }}
                        />
                    </div>
                </div>

                {/* BACK FACE (Info & Actions) */}
                <div 
                    className="absolute w-full h-full backface-hidden rotate-y-180 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900"
                    style={{ boxShadow: `inset 0 0 20px ${dynamicColor}20` }}
                >
                    <div className="absolute inset-0 z-0">
                         <img src={imageSrc} className="w-full h-full object-cover blur-sm scale-110 opacity-30" alt="" />
                         <div className="absolute inset-0 bg-slate-950/80"></div>
                    </div>

                    <div className="relative z-10 h-full p-5 flex flex-col">
                        <h3 className="text-white font-bold text-base leading-tight mb-3 text-center">{aiData.title}</h3>
                        
                        <div className="flex-grow overflow-hidden relative">
                            <p className="text-xs text-slate-300 leading-relaxed line-clamp-[8] font-medium text-justify">
                                {aiData.synopsis}
                            </p>
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-900 to-transparent"></div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDetail(); }}
                                className="w-full py-3 bg-white text-slate-900 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shadow-lg"
                            >
                                <Info className="w-4 h-4" /> Ver Detalles Completos
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// -- Subcomponent: Shelf --
const Shelf: React.FC<{ 
    title: string; 
    icon?: React.ElementType;
    items: MediaItem[]; 
    onOpenDetail: (item: MediaItem) => void;
    onHoverColor: (color: string) => void;
}> = ({ title, icon: Icon, items, onOpenDetail, onHoverColor }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(items.length > 4); 

    const checkScroll = useCallback(() => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            const isScrollable = scrollWidth > clientWidth;
            setShowLeftArrow(scrollLeft > 10);
            const isAtEnd = Math.ceil(scrollLeft + clientWidth) >= scrollWidth - 10;
            setShowRightArrow(isScrollable && !isAtEnd);
        }
    }, []);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollAmount = container.clientWidth * 0.75; 
            container.scrollBy({
                left: direction === 'right' ? scrollAmount : -scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    useEffect(() => {
        checkScroll();
        const timer = setTimeout(checkScroll, 100);
        window.addEventListener('resize', checkScroll);
        return () => {
            window.removeEventListener('resize', checkScroll);
            clearTimeout(timer);
        };
    }, [items, checkScroll]);

    if (items.length === 0) return null;

    return (
        <div className="mb-12 animate-fade-in-up w-full max-w-full">
            <div className="flex items-center gap-3 mb-5 px-4 md:px-8 border-l-4 border-slate-700 ml-4 md:ml-8 pl-3">
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight drop-shadow-md">{title}</h2>
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">{items.length}</span>
            </div>
            
            <div className="relative group/shelf w-full">
                {showLeftArrow && (
                    <button
                        onClick={() => scroll('left')}
                        className="absolute left-0 top-0 bottom-0 z-30 w-16 bg-gradient-to-r from-[#0f172a] to-transparent flex items-center justify-start pl-4 opacity-0 group-hover/shelf:opacity-100 transition-opacity duration-300 hidden md:flex cursor-pointer"
                    >
                        <ChevronLeft className="w-10 h-10 text-white drop-shadow-lg transition-transform hover:scale-110" />
                    </button>
                )}

                {showRightArrow && (
                    <button
                        onClick={() => scroll('right')}
                        className="absolute right-0 top-0 bottom-0 z-30 w-16 bg-gradient-to-l from-[#0f172a] to-transparent flex items-center justify-end pr-4 opacity-0 group-hover/shelf:opacity-100 transition-opacity duration-300 hidden md:flex cursor-pointer"
                    >
                        <ChevronRight className="w-10 h-10 text-white drop-shadow-lg transition-transform hover:scale-110" />
                    </button>
                )}

                <div 
                    ref={scrollContainerRef}
                    onScroll={checkScroll}
                    className="flex flex-nowrap overflow-x-auto gap-4 md:gap-6 px-4 md:px-8 pb-4 snap-x snap-mandatory scrollbar-hide pt-2 items-center w-full"
                >
                    {items.map(item => (
                        <div key={item.id} className="snap-center flex-shrink-0">
                            <CatalogPoster 
                                item={item} 
                                onDetail={() => onOpenDetail(item)}
                                onHoverColor={onHoverColor}
                            />
                        </div>
                    ))}
                    <div className="w-4 flex-shrink-0"></div> 
                </div>
            </div>
        </div>
    );
};

export const CatalogView: React.FC<CatalogViewProps> = ({ library, onOpenDetail }) => {
    const [activeColor, setActiveColor] = useState<string>('#0f172a');

    const shelves = useMemo(() => {
        const validLibrary = library.filter(item => item && item.aiData && item.trackingData);
        const assignedIds = new Set<string>();

        const continueWatching = validLibrary
            .filter(i => i.trackingData.status === 'Viendo/Leyendo')
            .sort((a, b) => (b.lastInteraction || 0) - (a.lastInteraction || 0));
        continueWatching.forEach(i => assignedIds.add(i.id));

        const favorites = validLibrary
            .filter(i => i.trackingData.is_favorite && !assignedIds.has(i.id))
            .sort((a, b) => (b.lastInteraction || 0) - (a.lastInteraction || 0));
        favorites.forEach(i => assignedIds.add(i.id));

        const remainingItems = validLibrary.filter(i => !assignedIds.has(i.id));
        const genreBuckets: Record<string, MediaItem[]> = {};
        
        remainingItems.sort((a, b) => (b.lastInteraction || 0) - (a.lastInteraction || 0));

        remainingItems.forEach(item => {
            const genres = item.aiData.genres;
            const primaryGenre = genres.length > 0 ? normalizeGenre(genres[0]) : 'otros';
            if (!genreBuckets[primaryGenre]) genreBuckets[primaryGenre] = [];
            genreBuckets[primaryGenre].push(item);
        });

        const SATURATION_LIMIT = 20;
        Object.keys(genreBuckets).forEach(genre => {
            const items = genreBuckets[genre];
            if (items.length > SATURATION_LIMIT) {
                const coreItems = items.slice(0, SATURATION_LIMIT);
                const overflowItems = items.slice(SATURATION_LIMIT);
                genreBuckets[genre] = coreItems;
                
                const unmoveableItems: MediaItem[] = [];
                overflowItems.forEach(item => {
                    let moved = false;
                    for (let i = 1; i < item.aiData.genres.length; i++) {
                        const candidateGenre = normalizeGenre(item.aiData.genres[i]);
                        const candidateBucket = genreBuckets[candidateGenre] || [];
                        if (candidateBucket.length < SATURATION_LIMIT) {
                            if (!genreBuckets[candidateGenre]) genreBuckets[candidateGenre] = [];
                            genreBuckets[candidateGenre].push(item);
                            moved = true;
                            break;
                        }
                    }
                    if (!moved) unmoveableItems.push(item);
                });
                if (unmoveableItems.length > 0) {
                     genreBuckets[genre] = [...genreBuckets[genre], ...unmoveableItems];
                }
            }
        });

        const finalGenreShelves: { title: string; items: MediaItem[] }[] = [];
        let exploreMoreItems: MediaItem[] = [];

        Object.entries(genreBuckets).forEach(([genre, items]) => {
            if (items.length < 3) {
                exploreMoreItems.push(...items);
            } else {
                finalGenreShelves.push({
                    title: genre.charAt(0).toUpperCase() + genre.slice(1),
                    items: items
                });
            }
        });

        exploreMoreItems.sort((a, b) => (b.lastInteraction || 0) - (a.lastInteraction || 0));
        finalGenreShelves.sort((a, b) => b.items.length - a.items.length);

        return { continueWatching, favorites, genreShelves: finalGenreShelves, exploreMore: exploreMoreItems };
    }, [library]);

    return (
        <div className="relative min-h-screen pb-20 w-full max-w-full overflow-x-hidden">
            <div 
                className="fixed inset-0 z-0 pointer-events-none transition-[background-color] duration-1000 ease-in-out"
                style={{ backgroundColor: activeColor, opacity: 0.15 }}
            />
            <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#0f172a] via-[#0f172a]/90 to-[#0f172a]" />

            <div className="relative z-10 pt-6 w-full">
                <Shelf title="Continuar Viendo" icon={PlayCircle} items={shelves.continueWatching} onOpenDetail={onOpenDetail} onHoverColor={setActiveColor} />
                <Shelf title="Tus Joyas" icon={Star} items={shelves.favorites} onOpenDetail={onOpenDetail} onHoverColor={setActiveColor} />
                {shelves.genreShelves.map(shelf => (
                    <Shelf key={shelf.title} title={shelf.title} items={shelf.items} onOpenDetail={onOpenDetail} onHoverColor={setActiveColor} />
                ))}
                <Shelf title="Explorar más" icon={Compass} items={shelves.exploreMore} onOpenDetail={onOpenDetail} onHoverColor={setActiveColor} />

                {library.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-500">
                        <Tv className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">El catálogo está vacío.</p>
                    </div>
                )}
            </div>
            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};
