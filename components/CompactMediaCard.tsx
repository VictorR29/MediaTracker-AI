
import React, { useState, useEffect, useRef } from 'react';
import { MediaItem, RATING_TO_SCORE } from '../types';
import { Plus, Check, Trash2, Star, FastForward } from 'lucide-react';
import { extractColorFromImage, vibrify, hexToRgb } from './media-card/colorUtils';
import { useLibraryStore } from '../stores/useLibraryStore';

interface CompactMediaCardProps {
  id?: string;
  item: MediaItem;
  onClick: (item: MediaItem) => void;
  onIncrement: (item: MediaItem) => void;
  onToggleFavorite?: (item: MediaItem) => void;
  onDelete?: (item: MediaItem) => void;
}

const getPlaceholder = (title: string) =>
  `https://placehold.co/300x450/1e293b/94a3b8?text=${encodeURIComponent(title || 'Sin Imagen')}&font=roboto`;

const isValidSource = (src?: string) =>
  src && (src.startsWith('http') || src.startsWith('data:'));

// Shared IntersectionObserver — one instance for ALL cards
let sharedObserver: IntersectionObserver | null = null;
const observerCallbacks = new Map<Element, () => void>();

const getSharedObserver = () => {
  if (sharedObserver) return sharedObserver;
  sharedObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const cb = observerCallbacks.get(entry.target);
          if (cb) {
            cb();
            observerCallbacks.delete(entry.target);
            sharedObserver!.unobserve(entry.target);
          }
        }
      }
    },
    { rootMargin: '200px' }
  );
  return sharedObserver;
};

export const CompactMediaCard: React.FC<CompactMediaCardProps> = React.memo(({ id, item, onClick, onIncrement, onToggleFavorite, onDelete }) => {
  const { aiData, trackingData } = item;
  const isFavorite = trackingData.is_favorite || false;

  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // A "real" primaryColor means Gemini assigned a unique color.
  // #c084fc is the generic fallback — treat it as "no color" and extract from image.
  const hasRealColor = aiData.primaryColor && aiData.primaryColor !== '#c084fc' && aiData.primaryColor !== '#a78bfa';
  const storedColor = hasRealColor ? aiData.primaryColor! : '#c084fc';

  // Auto-extract color from cover image when no real primaryColor exists
  const [extractedColor, setExtractedColor] = useState<string | null>(null);
  const extractionAttempted = useRef(false);

  // Pick the best available color (extracted > stored > fallback)
  const rawColor = extractedColor || storedColor;

  // VIBRIFY: boost saturation & lightness so greys become visible glows
  const dynamicColor = React.useMemo(() => vibrify(rawColor), [rawColor]);
  const dynamicRgb = React.useMemo(() => hexToRgb(dynamicColor), [dynamicColor]);

  const isMovie = aiData.mediaType === 'Pelicula';
  const isBook = aiData.mediaType === 'Libro';
  const isReadingContent = ['Manhwa', 'Manga', 'Comic', 'Libro'].includes(aiData.mediaType);

  const score = RATING_TO_SCORE[trackingData.rating] || 0;

  // Return Date Logic
  const isPaused = trackingData.status === 'En Pausa';
  const returnDate = trackingData.scheduledReturnDate;
  let isReturnDue = false;
  if (isPaused && returnDate) {
    const today = new Date().toISOString().split('T')[0];
    if (today >= returnDate) isReturnDue = true;
  }

  // Countdown Logic
  const isPlanned = trackingData.status === 'Planeado / Pendiente';
  let countdownText: string | null = null;
  if (isPlanned && trackingData.nextReleaseDate) {
    const target = new Date(trackingData.nextReleaseDate);
    const now = new Date();
    target.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) countdownText = "Estrenado";
    else if (diffDays === 0) countdownText = "¡Es Hoy!";
    else if (diffDays === 1) countdownText = "Mañana";
    else countdownText = `En ${diffDays} días`;
  }

  const hasTopBanner = isReturnDue || !!countdownText;
  const showQuickAction = !isMovie && !isPlanned && trackingData.status === 'Viendo/Leyendo';

  // Progress
  let progressPercent = 0;
  if (isMovie) {
    progressPercent = trackingData.status === 'Completado' ? 100 : 0;
  } else {
    progressPercent = trackingData.totalEpisodesInSeason > 0
      ? Math.min(100, (trackingData.watchedEpisodes / trackingData.totalEpisodesInSeason) * 100)
      : 0;
  }

  const isCompleteSeason = !isMovie && trackingData.totalEpisodesInSeason > 0 && trackingData.watchedEpisodes >= trackingData.totalEpisodesInSeason;
  const isLastSeason = trackingData.currentSeason >= trackingData.totalSeasons;

  const actualImageSource = isValidSource(aiData.coverImage)
    ? aiData.coverImage!
    : getPlaceholder(aiData.title);

  const [imgSrc, setImgSrc] = useState<string | undefined>(undefined);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [justFavorited, setJustFavorited] = useState(false);
  const [justIncremented, setJustIncremented] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-extract color from cover image when no real primaryColor exists
  const updateItem = useLibraryStore(s => s.updateItem);
  useEffect(() => {
    if (hasRealColor || extractionAttempted.current || !imgSrc) return;
    extractionAttempted.current = true;
    let cancelled = false;
    extractColorFromImage(imgSrc).then(color => {
      if (!cancelled && color && color !== '#c084fc') {
        setExtractedColor(color);
        // Persist extracted color so we don't re-extract next time
        updateItem({
          ...item,
          aiData: { ...item.aiData, primaryColor: color }
        });
      }
    }).catch(() => { /* silently fail */ });
    return () => { cancelled = true; };
  }, [imgSrc, hasRealColor]);

  // Shared IntersectionObserver — registers/unregisters per card
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = getSharedObserver();
    observerCallbacks.set(el, () => {
      setIsVisible(true);
      setImgSrc(actualImageSource);
    });
    observer.observe(el);
    return () => {
      observerCallbacks.delete(el);
      observer.unobserve(el);
    };
  }, [actualImageSource]);

  const handleImageError = () => {
    if (imgSrc !== getPlaceholder(aiData.title)) {
      setImgSrc(getPlaceholder(aiData.title));
    }
  };

  const handleQuickAction = (e: React.MouseEvent) => { e.stopPropagation(); onIncrement(item); setJustIncremented(true); setTimeout(() => setJustIncremented(false), 350); };
  const handleFavoriteClick = (e: React.MouseEvent) => { e.stopPropagation(); onToggleFavorite?.(item); setJustFavorited(true); setTimeout(() => setJustFavorited(false), 400); };
  const handleDeleteClick = (e: React.MouseEvent) => { e.stopPropagation(); onDelete?.(item); };

  const statusStyle = (() => {
    switch (trackingData.status) {
      case 'Viendo/Leyendo':
        return { bg: `bg-[rgb(var(--card-rgb))]`, text: 'text-white', label: isReadingContent ? 'LEYENDO' : 'VIENDO', glow: `0 0 16px rgba(${dynamicRgb}, 0.65)` };
      case 'Completado': return { bg: 'bg-emerald-500', text: 'text-white', label: 'COMPLETADO', glow: '0 0 14px rgba(16, 185, 129, 0.55)' };
      case 'Sin empezar': return { bg: 'bg-amber-500', text: 'text-black', label: 'SIN EMPEZAR', glow: '0 0 14px rgba(245, 158, 11, 0.50)' };
      case 'En Pausa': return { bg: 'bg-orange-500', text: 'text-white', label: 'EN PAUSA', glow: '0 0 14px rgba(249, 115, 22, 0.50)' };
      case 'Planeado / Pendiente': return { bg: 'bg-purple-500', text: 'text-white', label: 'PLANEADO', glow: '0 0 14px rgba(168, 85, 247, 0.50)' };
      case 'Descartado': return { bg: 'bg-red-600', text: 'text-white', label: 'DESCARTADO', glow: '0 0 14px rgba(239, 68, 68, 0.50)' };
      default: return { bg: 'bg-zinc-700', text: 'text-zinc-300', label: 'DESCONOCIDO', glow: '' };
    }
  })();

  const seasonLabel = isMovie ? 'Pelicula'
    : isBook ? (trackingData.isSaga ? `L.${trackingData.currentSeason}` : 'Novela')
    : isReadingContent ? `Vol. ${trackingData.currentSeason}`
    : `T.${trackingData.currentSeason}`;

  const progressLabel = isMovie
    ? (trackingData.status === 'Completado' ? '1/1' : '0/1')
    : trackingData.totalEpisodesInSeason > 0
      ? `${trackingData.watchedEpisodes} / ${trackingData.totalEpisodesInSeason}`
      : `${trackingData.watchedEpisodes} / ?`;

return (
    <div
      id={id}
      ref={cardRef}
		onClick={() => onClick(item)}
		onMouseEnter={() => setIsHovered(true)}
		onMouseLeave={() => setIsHovered(false)}
		className={`group relative rounded-2xl ring-1 ring-white/[0.06] p-1 bg-[#111113] w-full cursor-pointer
		md:hover:scale-[1.02] transition-shadow duration-500 ease-spring
		${isVisible ? 'animate-stagger-in' : 'opacity-0'}`}
 style={{
  '--card-rgb': dynamicRgb,
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto 300px',
  boxShadow: isHovered
    ? `0 0 40px rgba(${dynamicRgb}, 0.70), 0 0 80px rgba(${dynamicRgb}, 0.30), 0 0 120px rgba(${dynamicRgb}, 0.10)`
    : `0 0 30px rgba(${dynamicRgb}, 0.50), 0 0 60px rgba(${dynamicRgb}, 0.25), 0 0 100px rgba(${dynamicRgb}, 0.08)`,
 } as React.CSSProperties}
    >
      {/* Inner Core — double-bezel */}
      <div className="rounded-[calc(1rem-0.25rem)] overflow-hidden relative flex flex-col bg-[#18181B]" style={{ aspectRatio: '2/3' }}>

        {/* Return Due Banner */}
        {isReturnDue && (
          <div className="absolute top-0 left-0 right-0 bg-red-600/90 text-white text-[10px] font-bold px-2 py-1 text-center z-40">
            ¡Hora de Volver!
          </div>
        )}

        {/* Planned Countdown Banner */}
        {countdownText && (
          <div className="absolute top-0 left-0 right-0 bg-purple-600/90 text-white text-[10px] font-bold px-2 py-1 text-center z-40">
            {countdownText}
          </div>
        )}

        {/* --- IMAGE BACKGROUND --- */}
        <div className="absolute inset-0 bg-zinc-900">
          {imgSrc && (
            <img
              src={imgSrc}
              alt={aiData.title}
              onError={handleImageError}
              onLoad={() => setImageLoaded(true)}
              loading="lazy"
              className={`w-full h-full object-cover ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/70 to-transparent" />
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center bottom, rgba(${dynamicRgb}, 0.40) 0%, transparent 70%)` }} />
        </div>

        {/* --- TOP BADGES & ACTIONS --- */}

        {/* Type Badge */}
        <div className={`absolute left-3 z-30 pointer-events-none ${hasTopBanner ? 'top-8' : 'top-3'}`}>
	<span
		className="px-2.5 py-1 rounded-md bg-black/70 text-[10px] font-bold text-white uppercase tracking-wider"
          style={{ border: `1px solid ${dynamicColor}80`, boxShadow: `0 0 12px rgba(${dynamicRgb}, 0.50)` }}
	>
            {aiData.mediaType}
          </span>
        </div>

        {/* Actions Stack */}
        <div className={`absolute left-3 z-30 flex flex-col gap-2 ${hasTopBanner ? 'top-16' : 'top-11'}`}>
          {onToggleFavorite && (
            <button
              onClick={handleFavoriteClick}
              className={`p-2 rounded-full bg-black/70 hover:bg-white text-white hover:text-yellow-500 border border-white/10 active:scale-95 ${isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${justFavorited ? 'animate-fav-bounce' : ''}`}
              title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-current text-yellow-400' : ''}`} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="p-2 rounded-full bg-black/70 text-white hover:bg-red-600 hover:text-white border border-white/10 active:scale-95 opacity-0 group-hover:opacity-100"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Rating Badge */}
        {score > 0 && (
          <div className={`absolute right-3 z-30 pointer-events-none ${hasTopBanner ? 'top-8' : 'top-3'}`}>
	<div className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-800/90 ring-1 ring-white/[0.08] text-white text-xs font-bold"           style={{ boxShadow: `0 0 18px rgba(${dynamicRgb}, 0.70)` }}>
              {score}
            </div>
          </div>
        )}

        {/* Quick Action Button */}
        {showQuickAction && (
          <button
            onClick={handleQuickAction}
            className={`absolute bottom-20 right-3 z-40 p-2 md:p-3 rounded-full transform active:scale-[0.97] border border-white/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-transform duration-150 ease-spring ${isCompleteSeason ? 'bg-green-500 text-white' : 'bg-white text-zinc-900'} ${justIncremented ? 'animate-increment-pulse' : ''}`}
          style={!isCompleteSeason ? { color: dynamicColor, boxShadow: `0 0 24px rgba(${dynamicRgb}, 0.60)` } : {}}
            title={isCompleteSeason ? (isLastSeason ? "Completar Obra" : "Siguiente Temporada") : "+1 Capítulo"}
          >
            {isCompleteSeason
              ? (isLastSeason ? <Check className="w-4 h-4 md:w-5 md:h-5" /> : <FastForward className="w-4 h-4 md:w-5 md:h-5" />)
              : <Plus className="w-4 h-4 md:w-5 md:h-5" />}
          </button>
        )}

        {/* --- CONTENT OVERLAY (BOTTOM) --- */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-30 flex flex-col gap-2.5">
                <h3 className="text-white font-black text-base md:text-lg leading-tight line-clamp-2 tracking-[-0.02em] mb-1" style={{ textShadow: `0 0 20px rgba(${dynamicRgb}, 0.25)` }}>
                  {aiData.title}
                </h3>

          <div className="flex items-center gap-2 md:gap-3 w-full">
            <div
              className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${statusStyle.bg} ${statusStyle.text}`}
              style={statusStyle.glow ? { boxShadow: statusStyle.glow } : {}}
            >
              {statusStyle.label}
            </div>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progressPercent}%`,
backgroundColor: dynamicColor,
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-0.5 pl-0.5">
            <div className="flex items-center gap-1.5">
<div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dynamicColor, boxShadow: `0 0 10px rgba(${dynamicRgb}, 0.80)` }} />
              <span className="text-[10px] md:text-xs font-bold text-zinc-300 tracking-wide truncate max-w-[100px]">
                {seasonLabel}
              </span>
            </div>
            <div className="px-1.5 py-0.5 rounded bg-white/[0.08] ring-1 ring-white/[0.05]">
              <span className="text-[10px] md:text-xs font-mono font-medium text-zinc-200">
                {progressLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
