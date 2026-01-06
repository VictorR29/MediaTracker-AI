
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { MediaItem, normalizeGenre } from '../types';
import { PlayCircle, Star, Tv, BookOpen, Clapperboard, ChevronRight, ChevronLeft, Info, Eye, Compass } from 'lucide-react';

interface CatalogViewProps {
  library: MediaItem[]; // Filtered items from parent
  onOpenDetail: (item: MediaItem) => void;
}

// -- Subcomponent: 3D Flip Poster --
const CatalogPoster: React.FC<{ 
    item: MediaItem; 
    onDetail: () => void;
    onHoverColor: (color: string) => void;
}> = ({ item, onDetail, onHoverColor }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    
    // Safety check: Ensure item data exists
    if (!item || !item.aiData || !item.trackingData) return null;

    const { aiData, trackingData } = item;
    
    // Fallback Image
    const imageSrc = aiData.coverImage && (aiData.coverImage.startsWith('http') || aiData.coverImage.startsWith('data:'))
        ? aiData.coverImage
        : `https://placehold.co/400x600/1e293b/94a3b8?text=${encodeURIComponent(aiData.title)}&font=roboto`;

    // Progress Calculation
    let progressPercent = 0;
    if (aiData.mediaType === 'Pelicula') {
        progressPercent = trackingData.status === 'Completado' ? 100 : 0;
    } else {
        progressPercent = trackingData.totalEpisodesInSeason > 0
            ? Math.min(100, (trackingData.watchedEpisodes / trackingData.totalEpisodesInSeason) * 100)
            : 0;
    }

    const handleClick = () => setIsFlipped(!isFlipped);
    
    return (
        <div 
            className="group relative w-44 h-64 md:w-56 md:h-80 flex-shrink-0 cursor-pointer perspective-1000"
            onMouseEnter={() => onHoverColor(aiData.primaryColor || '#6366f1')}
            onClick={handleClick}
        >
            <div className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${isFlipped ? 'rotate-y-180' : 'group-hover:scale-105'}`}>
                
                {/* FRONT FACE */}
                <div className="absolute w-full h-full backface-hidden rounded-xl overflow-hidden shadow-xl border border-white/5 bg-slate-900">
                    <img 
                        src={imageSrc} 
                        alt={aiData.title} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                    {/* Subtle Overlay for Title Visibility if needed, currently clean as requested */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>

                {/* BACK FACE (Info) */}
                <div 
                    className="absolute w-full h-full backface-hidden rotate-y-180 rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900"
                    style={{ boxShadow: `inset 0 0 20px ${aiData.primaryColor}20` }}
                >
                    {/* Background Image Layer (Blurred) */}
                    <div className="absolute inset-0 z-0">
                         <img 
                            src={imageSrc} 
                            alt="" 
                            className="w-full h-full object-cover blur-[2px] scale-105 opacity-60" 
                         />
                         {/* Dark Overlay for Text Readability - Lighter than before */}
                         <div className="absolute inset-0 bg-slate-950/60"></div>
                    </div>

                    {/* Content Layer */}
                    <div className="relative z-10 h-full p-4 flex flex-col">
                        <div className="mb-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 border border-slate-600/50 bg-slate-900/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                {aiData.mediaType}
                            </span>
                        </div>
                        
                        <h3 className="text-white font-bold text-sm md:text-base leading-tight mb-2 line-clamp-3 drop-shadow-md text-shadow-sm">
                            {aiData.title}
                        </h3>
                        
                        <p className="text-xs text-slate-200 line-clamp-4 mb-4 flex-grow drop-shadow-md font-medium text-shadow-sm">
                            {aiData.synopsis}
                        </p>

                        <div className="mt-auto space-y-3">
                            {/* Progress Bar */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-white font-bold drop-shadow-md">
                                    <span>Progreso</span>
                                    <span>{Math.round(progressPercent)}%</span>
                                </div>
                                <div className="h-1 w-full bg-slate-700/60 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                                    <div 
                                        className="h-full rounded-full transition-all shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                        style={{ width: `${progressPercent}%`, backgroundColor: aiData.primaryColor || '#6366f1' }}
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={(e) => { e.stopPropagation(); onDetail(); }}
                                className="w-full py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 border border-white/20 backdrop-blur-md shadow-lg"
                            >
                                <Info className="w-3 h-3" /> Ver Detalles
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
    // Initialize true if there are enough items to likely overflow (approx > 4-5 on desktop)
    const [showRightArrow, setShowRightArrow] = useState(items.length > 4); 

    const checkScroll = useCallback(() => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            
            // Check if scroll is possible
            const isScrollable = scrollWidth > clientWidth;
            
            setShowLeftArrow(scrollLeft > 10);
            
            // Tolerance of 10px to handle browser sub-pixel rendering differences
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

    // Recalculate on items change or resize
    useEffect(() => {
        // Immediate check
        checkScroll();
        
        // Delayed check to allow DOM layout to settle (important for correct scrollWidth)
        const timer = setTimeout(checkScroll, 100);
        
        window.addEventListener('resize', checkScroll);
        return () => {
            window.removeEventListener('resize', checkScroll);
            clearTimeout(timer);
        };
    }, [items, checkScroll]);

    if (items.length === 0) return null;

    return (
        <div className="mb-10 animate-fade-in-up w-full max-w-full">
            <div className="flex items-center gap-2 mb-4 px-4 md:px-8">
                {Icon && <Icon className="w-5 h-5 text-white/70" />}
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight drop-shadow-md">{title}</h2>
                <span className="text-sm text-slate-500 font-medium ml-2">({items.length})</span>
            </div>
            
            <div className="relative group/shelf w-full">
                {/* Desktop Navigation Arrows */}
                {showLeftArrow && (
                    <button
                        onClick={() => scroll('left')}
                        className="absolute left-0 top-0 bottom-8 z-30 w-12 bg-gradient-to-r from-black/80 via-black/40 to-transparent flex items-center justify-center opacity-0 group-hover/shelf:opacity-100 transition-opacity duration-300 hidden md:flex cursor-pointer hover:from-black/90"
                        aria-label="Scroll Left"
                    >
                        <ChevronLeft className="w-10 h-10 text-white drop-shadow-lg transition-transform hover:scale-110" />
                    </button>
                )}

                {showRightArrow && (
                    <button
                        onClick={() => scroll('right')}
                        className="absolute right-0 top-0 bottom-8 z-30 w-12 bg-gradient-to-l from-black/80 via-black/40 to-transparent flex items-center justify-center opacity-0 group-hover/shelf:opacity-100 transition-opacity duration-300 hidden md:flex cursor-pointer hover:from-black/90"
                        aria-label="Scroll Right"
                    >
                        <ChevronRight className="w-10 h-10 text-white drop-shadow-lg transition-transform hover:scale-110" />
                    </button>
                )}

                {/* Horizontal Scroll Container */}
                <div 
                    ref={scrollContainerRef}
                    onScroll={checkScroll}
                    className="flex flex-nowrap overflow-x-auto gap-4 md:gap-6 px-4 md:px-8 pb-8 snap-x snap-mandatory scrollbar-hide pt-4 items-center w-full"
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
                    {/* Padding Right */}
                    <div className="w-8 flex-shrink-0"></div> 
                </div>
            </div>
        </div>
    );
};

export const CatalogView: React.FC<CatalogViewProps> = ({ library, onOpenDetail }) => {
    const [activeColor, setActiveColor] = useState<string>('#0f172a');

    // -- Smart Shelves Logic (Anchor + Saturation Redistribution) --
    const shelves = useMemo(() => {
        // Sanitize library to remove corrupted items lacking core data
        const validLibrary = library.filter(item => item && item.aiData && item.trackingData);

        const assignedIds = new Set<string>();

        // 1. PRIORITY: Continue Watching
        const continueWatching = validLibrary
            .filter(i => i.trackingData.status === 'Viendo/Leyendo')
            .sort((a, b) => (b.lastInteraction || 0) - (a.lastInteraction || 0));

        continueWatching.forEach(i => assignedIds.add(i.id));

        // 2. PRIORITY: Favorites (Only if not already in Continue Watching)
        const favorites = validLibrary
            .filter(i => i.trackingData.is_favorite && !assignedIds.has(i.id))
            .sort((a, b) => (b.lastInteraction || 0) - (a.lastInteraction || 0));

        favorites.forEach(i => assignedIds.add(i.id));

        // 3. REMAINING ITEMS
        const remainingItems = validLibrary.filter(i => !assignedIds.has(i.id));
        
        // --- PHASE A: ANCHORING (Primary Genre) ---
        // Assign items to their FIRST genre initially.
        const genreBuckets: Record<string, MediaItem[]> = {};
        
        // Sort remaining items by recency first
        remainingItems.sort((a, b) => (b.lastInteraction || 0) - (a.lastInteraction || 0));

        remainingItems.forEach(item => {
            const genres = item.aiData.genres;
            const primaryGenre = genres.length > 0 ? normalizeGenre(genres[0]) : 'otros';
            
            if (!genreBuckets[primaryGenre]) genreBuckets[primaryGenre] = [];
            genreBuckets[primaryGenre].push(item);
        });

        // --- PHASE B: SATURATION & REDISTRIBUTION ---
        const SATURATION_LIMIT = 20;
        const TARGET_MIN_DENSITY = 4;

        // Iterate through known buckets to find saturated ones
        Object.keys(genreBuckets).forEach(genre => {
            const items = genreBuckets[genre];
            
            // Only redistribute if the shelf is saturated (> 20 items)
            if (items.length > SATURATION_LIMIT) {
                // Keep the Core (First 20 items, or 30% of total if that's larger/safer, but strictly sticking to max 20 per prompt logic)
                // The prompt says "unless that shelf exceeds... 20". So we cap at 20.
                const coreItems = items.slice(0, SATURATION_LIMIT);
                const overflowItems = items.slice(SATURATION_LIMIT);
                
                // Set the bucket to just the core for now
                genreBuckets[genre] = coreItems;
                
                // Try to move overflow items
                const unmoveableItems: MediaItem[] = [];

                overflowItems.forEach(item => {
                    let moved = false;
                    
                    // Check 2nd, 3rd, etc. genres
                    for (let i = 1; i < item.aiData.genres.length; i++) {
                        const candidateGenre = normalizeGenre(item.aiData.genres[i]);
                        const candidateBucket = genreBuckets[candidateGenre] || [];
                        
                        // LOGIC: Move if target is NOT saturated (< 20).
                        // PRIORITY: Strongly prefer if target is SPARSE (< 4) to fill it up.
                        // Since we iterate genres sequentially for a single item, we take the first valid one.
                        // Ideally we'd scan all candidate genres and pick the sparsest, but finding *any* valid non-saturated slot is good enough.
                        
                        if (candidateBucket.length < SATURATION_LIMIT) {
                            if (!genreBuckets[candidateGenre]) genreBuckets[candidateGenre] = [];
                            genreBuckets[candidateGenre].push(item);
                            moved = true;
                            break; // Item handled, stop looking
                        }
                    }

                    if (!moved) {
                        unmoveableItems.push(item);
                    }
                });

                // If items couldn't be moved, they MUST return to the original bucket
                // even if it exceeds the limit (Anchor logic takes precedence if no alternatives)
                if (unmoveableItems.length > 0) {
                     genreBuckets[genre] = [...genreBuckets[genre], ...unmoveableItems];
                }
            }
        });

        // --- PHASE C: CLEANUP & FORMATTING ---
        const finalGenreShelves: { title: string; items: MediaItem[] }[] = [];
        let exploreMoreItems: MediaItem[] = [];

        Object.entries(genreBuckets).forEach(([genre, items]) => {
            // Filter: If a shelf ended up too small (< 3), dissolve it into Explore More
            if (items.length < 3) {
                exploreMoreItems.push(...items);
            } else {
                finalGenreShelves.push({
                    title: genre.charAt(0).toUpperCase() + genre.slice(1),
                    items: items // Note: Items might be > 20 if redistribution failed, which is acceptable behavior
                });
            }
        });

        // Sort explore items by recency
        exploreMoreItems.sort((a, b) => (b.lastInteraction || 0) - (a.lastInteraction || 0));

        // ORDERING: Sort shelves by VOLUME (Largest first)
        finalGenreShelves.sort((a, b) => b.items.length - a.items.length);

        return {
            continueWatching,
            favorites,
            genreShelves: finalGenreShelves,
            exploreMore: exploreMoreItems
        };
    }, [library]);

    return (
        <div className="relative min-h-screen pb-20 w-full max-w-full overflow-x-hidden">
            {/* Dynamic Ambient Background - Solid Layer with transition */}
            <div 
                className="fixed inset-0 z-0 pointer-events-none transition-[background-color] duration-700 ease-in-out"
                style={{ 
                    backgroundColor: activeColor,
                    opacity: 0.5 
                }}
            />
            {/* Vignette Mask Layer - Fixed Gradient to blend center into dark background */}
            <div 
                className="fixed inset-0 z-0 pointer-events-none"
                style={{ 
                    background: 'radial-gradient(circle at 50% 30%, transparent 0%, #0f172a 80%)'
                }}
            />
            {/* Blur Texture Layer */}
            <div className="fixed inset-0 z-0 bg-slate-900/40 backdrop-blur-3xl pointer-events-none"></div>

            <div className="relative z-10 pt-4 w-full">
                
                {/* Shelf 1: Continue Watching */}
                <Shelf 
                    title="Continuar Viendo" 
                    icon={PlayCircle}
                    items={shelves.continueWatching} 
                    onOpenDetail={onOpenDetail}
                    onHoverColor={setActiveColor}
                />

                {/* Shelf 2: Favorites */}
                <Shelf 
                    title="Tus Joyas" 
                    icon={Star}
                    items={shelves.favorites} 
                    onOpenDetail={onOpenDetail}
                    onHoverColor={setActiveColor}
                />

                {/* Genre Shelves */}
                {shelves.genreShelves.map(shelf => (
                    <Shelf 
                        key={shelf.title}
                        title={shelf.title}
                        items={shelf.items}
                        onOpenDetail={onOpenDetail}
                        onHoverColor={setActiveColor}
                    />
                ))}

                {/* Shelf 4: Explore More (Fallback) */}
                <Shelf 
                    title="Explorar más" 
                    icon={Compass}
                    items={shelves.exploreMore} 
                    onOpenDetail={onOpenDetail}
                    onHoverColor={setActiveColor}
                />

                {/* Empty State */}
                {library.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-500">
                        <Tv className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">El catálogo está vacío.</p>
                        <p className="text-sm">Ajusta tus filtros o añade nuevas obras.</p>
                    </div>
                )}
            </div>

            {/* CSS Utilities for Flip Card and Scrollbar Hiding */}
            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
                
                /* Hide Scrollbar for Chrome, Safari and Opera */
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                /* Hide scrollbar for IE, Edge and Firefox */
                .scrollbar-hide {
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
            `}</style>
        </div>
    );
};
