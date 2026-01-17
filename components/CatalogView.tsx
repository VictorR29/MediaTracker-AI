
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { MediaItem, normalizeGenre } from '../types';
import { PlayCircle, Star, Tv, BookOpen, Clapperboard, ChevronRight, ChevronLeft, Info, Eye, Compass, Clock, FileText, Film, Book } from 'lucide-react';

interface CatalogViewProps {
  library: MediaItem[]; // Filtered items from parent
  onOpenDetail: (item: MediaItem) => void;
}

// -- Subcomponent: 3D Flip Poster (Updated Style: Clean Front) --
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

    const dynamicColor = aiData.primaryColor || '#6366f1';

    const handleClick = () => setIsFlipped(!isFlipped);

    const handleDetailClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Critical: Stop the card from flipping back
        onDetail();
    };
    
    return (
        <div 
            className="group relative w-48 h-72 md:w-56 md:h-80 flex-shrink-0 cursor-pointer perspective-1000"
            onMouseEnter={() => onHoverColor(dynamicColor)}
            onClick={handleClick}
        >
            <div className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${isFlipped ? 'rotate-y-180' : 'group-hover:scale-[1.03]'}`}>
                
                {/* FRONT FACE (Clean Cover Only) */}
                <div 
                    className="absolute w-full h-full backface-hidden rounded-xl overflow-hidden shadow-2xl border border-white/5 bg-[#1A1D26]"
                    style={{ boxShadow: isFlipped ? 'none' : `0 10px 30px -10px ${dynamicColor}40` }}
                >
                    <img 
                        src={imageSrc} 
                        alt={aiData.title} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                    {/* Subtle inner border for depth */}
                    <div className="absolute inset-0 border border-white/10 rounded-xl pointer-events-none"></div>
                </div>

                {/* BACK FACE (Info & Actions) */}
                <div 
                    className="absolute w-full h-full backface-hidden rotate-y-180 rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900"
                    style={{ boxShadow: `inset 0 0 0 1px ${dynamicColor}40` }}
                >
                    {/* Blurred Background */}
                    <div className="absolute inset-0 z-0">
                         <img src={imageSrc} className="w-full h-full object-cover blur-md scale-125 opacity-20" alt="" />
                         <div className="absolute inset-0 bg-slate-950/80"></div>
                    </div>

                    <div className="relative z-10 h-full p-5 flex flex-col justify-center items-center text-center">
                        <h3 className="text-white font-bold text-lg leading-tight mb-3 line-clamp-3 drop-shadow-md">
                            {aiData.title}
                        </h3>
                        
                        <div className="w-10 h-1 bg-white/20 rounded-full mb-4"></div>

                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-5 font-medium mb-6">
                            {aiData.synopsis}
                        </p>

                        <button 
                            onClick={handleDetailClick}
                            className="w-full py-3 bg-white hover:bg-slate-200 text-slate-900 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg transform hover:scale-105 active:scale-95"
                        >
                            <Info className="w-4 h-4" /> Ver Detalles
                        </button>
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
            const genres = item.aiData?.genres || []; // Safe access with optional chaining
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
                    const genres = item.aiData?.genres || []; // Safe access
                    for (let i = 1; i < genres.length; i++) {
                        const candidateGenre = normalizeGenre(genres[i]);
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
