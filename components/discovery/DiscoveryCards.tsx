import React from 'react';
import { RecommendationResult } from '../../services/geminiService';
import { getColorData } from './constants';
import { Sparkles, Loader2, BrainCircuit, RefreshCw, ArrowLeft, Search, Info, Quote, Heart, ChevronDown } from 'lucide-react';

// --- Shared Card Sub-Components ---

export interface GenerativeCardProps {
  title: string;
  type: string;
}

export const GenerativeCard: React.FC<GenerativeCardProps> = ({ title, type }) => {
  const colors = getColorData(title);
  return (
    <div className={`w-full h-full bg-gradient-to-br ${colors.bg} flex flex-col items-center justify-center p-8 text-center relative overflow-hidden`}>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>

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

export const LoadingCard: React.FC = () => {
  return (
    <div className="relative w-full h-full flex items-center justify-center perspective-1000">
      {/* Left Card - Shuffling Animation */}
      <div
        className="absolute w-[85%] md:w-[340px] h-[95%] bg-white/[0.04] rounded-3xl ring-1 ring-white/[0.06] shadow-xl backdrop-blur-sm animate-[shuffle-left_1.5s_infinite_cubic-bezier(0.32,0.72,0,1)]"
      ></div>

      {/* Right Card - Shuffling Animation */}
      <div
        className="absolute w-[85%] md:w-[340px] h-[95%] bg-white/[0.03] rounded-3xl ring-1 ring-white/[0.06] shadow-xl backdrop-blur-sm animate-[shuffle-right_1.5s_infinite_cubic-bezier(0.32,0.72,0,1)]"
      ></div>

      {/* Main Shimmer Card (Center) */}
      <div
        className="absolute w-[90%] md:w-[360px] h-full bg-zinc-900 ring-1 ring-white/[0.06] rounded-3xl overflow-hidden shadow-2xl z-10 animate-[float_3s_infinite_cubic-bezier(0.32,0.72,0,1)]"
      >
        {/* Shimmer Effect Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-150%] animate-[shimmer_1.2s_infinite]"></div>

        {/* Decorative Content */}
        <div className="h-full flex flex-col items-center justify-center gap-8 relative z-20">
        <div className="w-24 h-24 rounded-full bg-white/[0.06] flex items-center justify-center animate-pulse ring-1 ring-white/[0.06]">
          <Loader2 className="w-10 h-10 text-zinc-300 animate-spin" />
          </div>

          <div className="space-y-3 text-center opacity-60">
            <div className="h-3 bg-white/20 rounded-full w-32 mx-auto animate-pulse"></div>
            <div className="h-3 bg-white/10 rounded-full w-24 mx-auto animate-pulse delay-75"></div>
            <div className="h-3 bg-white/10 rounded-full w-40 mx-auto animate-pulse delay-150"></div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-150%) skewX(-12deg); }
          100% { transform: translateX(150%) skewX(-12deg); }
        }
        @keyframes shuffle-left {
          0%, 100% { transform: rotate(-4deg) translateX(-10px) scale(0.95); opacity: 0.5; }
          50% { transform: rotate(-15deg) translateX(-60px) scale(0.9); opacity: 0.8; transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1); }
        }
        @keyframes shuffle-right {
          0%, 100% { transform: rotate(4deg) translateX(10px) scale(0.95); opacity: 0.5; }
          50% { transform: rotate(15deg) translateX(60px) scale(0.9); opacity: 0.8; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export interface NoResultsCardProps {
  onGoBack: () => void;
}

export const NoResultsCard: React.FC<NoResultsCardProps> = ({ onGoBack }) => {
  return (
    <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden ring-1 ring-white/[0.06] rounded-3xl shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-red-950/20 to-zinc-900"></div>

      {/* Animated rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 ring-1 ring-red-500/20 rounded-full animate-ping [animation-duration:3s]"></div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center ring-1 ring-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <BrainCircuit className="w-12 h-12 text-red-400" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Incluso para la IA esto es un reto.</h2>
          <p className="text-zinc-400 text-sm md:text-base max-w-xs mx-auto leading-relaxed">
            La combinación de filtros es muy específica o única. ¿Probamos con otro mood?
          </p>
        </div>
        <button
          onClick={onGoBack}
          className="mt-4 px-8 py-4 bg-white text-zinc-900 font-bold rounded-full hover:bg-zinc-200 transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] shadow-lg flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Ajustar Filtros
        </button>
      </div>
    </div>
  );
};

export interface EndCardProps {
  onLoadMore: () => void;
  onGoBack: () => void;
}

export const EndCard: React.FC<EndCardProps> = ({ onLoadMore, onGoBack }) => {
  return (
  <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden ring-1 ring-white/[0.06] rounded-3xl">
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-[#09090B] to-[#111113]"></div>
    <div className="relative z-10 flex flex-col items-center gap-6">
      <div className="w-20 h-20 rounded-full bg-[#111113] flex items-center justify-center ring-1 ring-white/[0.10] shadow-lg">
        <RefreshCw className="w-10 h-10 text-zinc-300" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">¡Todo visto!</h2>
          <p className="text-zinc-400 text-sm max-w-xs mx-auto">
            Has revisado las 6 recomendaciones. ¿Quieres generar otro lote basado en los mismos gustos?
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onLoadMore}
          className="w-full py-4 bg-white hover:bg-zinc-200 text-zinc-900 font-bold rounded-full transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.97]"
          style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
        >
          <Sparkles className="w-5 h-5" />
          Generar otras 6
        </button>
        <button
          onClick={onGoBack}
          className="w-full py-4 bg-[#1C1C1F] hover:bg-white/[0.08] text-zinc-300 font-bold rounded-full transition-all ring-1 ring-white/[0.06] flex items-center justify-center gap-2 active:scale-[0.97]"
          style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Filtros
        </button>
        </div>
      </div>
    </div>
  );
};

export interface InfoSheetProps {
  card: RecommendationResult;
  selectedMood: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: () => void;
  onNext: () => void;
}

export const InfoSheet: React.FC<InfoSheetProps> = ({ card, selectedMood, isOpen, onClose, onSelect, onNext }) => {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 bg-[#111113]/90 backdrop-blur-2xl ring-1 ring-white/[0.10] rounded-t-[2rem] p-6 md:p-8 transition-transform duration-500 z-50 max-w-2xl mx-auto shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
    >
      <div
        className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 cursor-pointer"
        onClick={onClose}
      ></div>

      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 pr-4">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-400 mb-1 block">
            Recomendación IA
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
            {card.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronDown className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Mood Indicator in Info Sheet */}
      {selectedMood && (
        <div className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded ring-1 ring-white/[0.08] bg-white/[0.06] text-zinc-300 animate-fade-in">
          <Heart className="w-3 h-3 fill-current" />
          <span>Inspirado en tu deseo de: {selectedMood}</span>
        </div>
      )}

      <div className="space-y-4 mb-8">
        <p className="text-zinc-200 text-sm leading-relaxed font-medium">
          {card.synopsis}
        </p>
      <div className="bg-white/[0.06] ring-1 ring-white/[0.08] rounded-xl p-3 flex gap-3">
        <Quote className="w-5 h-5 text-zinc-400 flex-shrink-0 mt-0.5 fill-current opacity-50" />
        <p className="text-xs md:text-sm text-zinc-200 font-medium italic">
            "{card.reason}"
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSelect}
          className="flex-1 bg-white text-zinc-900 font-bold py-3.5 rounded-full hover:bg-zinc-200 transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] flex items-center justify-center gap-2 shadow-lg"
        >
          <Search className="w-5 h-5" />
          Buscar obra
        </button>
        <button
          onClick={onNext}
          className="px-6 py-3.5 bg-[#1C1C1F] hover:bg-white/[0.08] text-white font-bold rounded-full ring-1 ring-white/[0.06] transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};
