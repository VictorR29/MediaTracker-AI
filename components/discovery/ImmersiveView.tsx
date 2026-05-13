import React, { useRef, useMemo, useEffect } from 'react';
import { RecommendationResult } from '../../services/geminiService';
import { getColorData } from './constants';
import { GenerativeCard, LoadingCard, NoResultsCard, EndCard, InfoSheet } from './DiscoveryCards';
import { Sparkles, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';

export interface ImmersiveViewProps {
  recommendations: RecommendationResult[];
  currentIndex: number;
  onSetCurrentIndex: (index: number | ((prev: number) => number)) => void;
  isLoading: boolean;
  selectedMood: string | null;
  onSelectRecommendation: (title: string, type: string) => void;
  onLoadMore: () => void;
  onGoBack: () => void;
}

const ImmersiveViewInner: React.FC<ImmersiveViewProps> = ({
  recommendations,
  currentIndex,
  onSetCurrentIndex,
  isLoading,
  selectedMood,
  onSelectRecommendation,
  onLoadMore,
  onGoBack,
}) => {
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);
  const [swipeDirection, setSwipeDirection] = React.useState<'up' | 'down' | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);

  const isEndCard = recommendations.length > 0 && currentIndex === recommendations.length;
  const currentCard = recommendations[currentIndex];
  const cardColors = currentCard ? getColorData(currentCard.title) : { bg: 'from-slate-700 to-slate-800', shadow: '#000000' };

  // 3D Tilt — Direct DOM manipulation for 60fps
  const applyTilt = (clientX: number, clientY: number, isActive: boolean) => {
    if (!cardRef.current) return;

    if (!isActive) {
      cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
      return;
    }

    const { left, top, width, height } = cardRef.current.getBoundingClientRect();
    const x = (clientX - left) / width;
    const y = (clientY - top) / height;

    const tiltX = (0.5 - y) * 20;
    const tiltY = (x - 0.5) * 20;

    cardRef.current.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
  };

  const handleNext = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = '';
      cardRef.current.style.transition = '';
    }

    if (currentIndex < recommendations.length) {
      setSwipeDirection('up');
      setTimeout(() => {
        onSetCurrentIndex(prev => prev + 1);
        setSwipeDirection(null);
        setIsInfoOpen(false);
      }, 400);
    }
  };

  const handlePrev = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = '';
      cardRef.current.style.transition = '';
    }

    if (currentIndex > 0) {
      setSwipeDirection('down');
      setTimeout(() => {
        onSetCurrentIndex(prev => prev - 1);
        setSwipeDirection(null);
        setIsInfoOpen(false);
      }, 400);
    }
  };

  // Event Handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!swipeDirection) {
      if (cardRef.current) cardRef.current.style.transition = 'transform 0.1s ease-out';
      applyTilt(e.clientX, e.clientY, true);
    }
  };

  const handleMouseLeave = () => {
    if (cardRef.current) cardRef.current.style.transition = 'transform 0.5s ease-out';
    applyTilt(0, 0, false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY;
    if (cardRef.current) cardRef.current.style.transition = 'none';
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0 && !swipeDirection) {
      applyTilt(e.touches[0].clientX, e.touches[0].clientY, true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (cardRef.current) cardRef.current.style.transition = 'transform 0.5s ease-out';

    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;

    applyTilt(0, 0, false);

    if (diff > 50) {
      if (!isEndCard) handleNext();
    } else if (diff < -50) {
      if (isInfoOpen) setIsInfoOpen(false);
      else handlePrev();
    }
  };

  // Clean up styles when swipe direction changes
  useEffect(() => {
    if (swipeDirection && cardRef.current) {
      cardRef.current.style.transform = '';
      cardRef.current.style.transition = '';
    }
  }, [swipeDirection]);

  // Background style
  const bgStyle = useMemo(() => {
    if (isLoading || recommendations.length === 0) return { background: '#0f172a' };
    if (isEndCard) return { background: '#0f172a' };
    if (!currentCard) return { background: '#0f172a' };

    const colors = getColorData(currentCard.title);
    return {
      background: `radial-gradient(circle at 50% 30%, ${colors.shadow}40 0%, #0f172a 100%)`
    };
  }, [currentCard, isEndCard, isLoading, recommendations.length]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden touch-none"
      style={bgStyle}
    >
      <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[2px]"></div>

      {/* CARD CONTAINER */}
      <div className="relative w-full max-w-md h-[70vh] md:h-[600px] perspective-1000 flex items-center justify-center z-50">

        {/* LOADING STATE */}
        {isLoading && <LoadingCard />}

        {/* EMPTY/ERROR STATE (Challenge Card) */}
        {!isLoading && recommendations.length === 0 && <NoResultsCard onGoBack={onGoBack} />}

        {/* RESULTS STATE */}
        {!isLoading && recommendations.length > 0 && (
          <>
            {/* Previous Card Ghost (Animation) */}
            {swipeDirection === 'up' && (
              <div className="absolute inset-0 bg-slate-800 rounded-3xl opacity-0 transform -translate-y-full scale-75 transition-all duration-500 ease-out pointer-events-none"></div>
            )}

            {/* ACTIVE CARD */}
            <div
              ref={cardRef}
              className={`relative w-[90%] md:w-[360px] h-full rounded-3xl shadow-2xl transform-style-3d cursor-pointer ${swipeDirection === 'up' ? 'transition-all duration-500 -translate-y-[150%] opacity-0 rotate-12' :
                swipeDirection === 'down' ? 'transition-all duration-500 translate-y-[150%] opacity-0 -rotate-12' :
                  'opacity-100'
                }`}
              style={{
                willChange: 'transform',
                boxShadow: isEndCard ? 'none' : `0 25px 50px -12px ${cardColors.shadow}60`
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={() => !isEndCard && setIsInfoOpen(true)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {isEndCard ? (
                <EndCard onLoadMore={onLoadMore} onGoBack={onGoBack} />
              ) : (
                <div className="absolute inset-0 rounded-3xl overflow-hidden bg-slate-900 border border-white/10">
                  <GenerativeCard title={currentCard.title} type={currentCard.mediaType} />
                  <div className="absolute bottom-6 left-0 right-0 text-center transition-opacity duration-300 pointer-events-none" style={{ opacity: isInfoOpen ? 0 : 1 }}>
                    <p className="text-xs font-medium text-white/60 flex items-center justify-center gap-2 bg-black/20 backdrop-blur-md py-1 px-3 rounded-full mx-auto w-fit">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                      Toca para detalles
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Navigation Arrows */}
            {!isEndCard && (
              <div
                className="absolute right-[-60px] top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center cursor-pointer hover:scale-110 transition-transform p-2"
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
              >
                <div className="bg-white/10 p-3 rounded-full backdrop-blur-md border border-white/20">
                  <ChevronDown className="w-6 h-6 text-white" />
                </div>
              </div>
            )}
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
          </>
        )}
      </div>

      {/* NAVIGATION BAR */}
      {!isLoading && recommendations.length > 0 && (
        <div className="absolute top-4 left-0 right-0 z-50 px-4 md:px-6 pt-safe flex justify-between items-center w-full max-w-lg mx-auto pointer-events-none">
          {!isEndCard ? (
            <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg animate-fade-in-up">
              <Sparkles className="w-3 h-3 text-yellow-400" />
              <span className="text-xs font-bold text-white font-mono">
                {currentIndex + 1} / {recommendations.length}
              </span>
            </div>
          ) : <div></div>}

          <button
            onClick={onGoBack}
            className="pointer-events-auto bg-black/40 hover:bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold transition-all border border-white/10 flex items-center gap-2 shadow-lg animate-fade-in-up hover:scale-105"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Filtros</span>
          </button>
        </div>
      )}

      {/* INFO SHEET */}
      {!isLoading && !isEndCard && currentCard && (
        <InfoSheet
          card={currentCard}
          selectedMood={selectedMood}
          isOpen={isInfoOpen}
          onClose={() => setIsInfoOpen(false)}
          onSelect={() => {
            onSelectRecommendation(currentCard.title, currentCard.mediaType);
            setIsInfoOpen(false);
          }}
          onNext={handleNext}
        />
      )}

      {/* Mobile Swipe Trigger Zone (Invisible Overlay) */}
      <div
        className="absolute inset-0 z-40 md:hidden"
        style={{ touchAction: 'none' }}
        onClick={() => !isLoading && recommendations.length > 0 && !isEndCard && !isInfoOpen && setIsInfoOpen(true)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
.pt-safe { padding-top: env(safe-area-inset-top, 20px); }
        `}</style>
      </div>
    );
};

export const ImmersiveView = React.memo(ImmersiveViewInner);
