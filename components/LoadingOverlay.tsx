
import React from 'react';
import { Loader2, Sparkles, Database, FileJson } from 'lucide-react';

interface LoadingOverlayProps {
  isVisible: boolean;
  type: 'search' | 'restore' | 'generic';
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, type, message }) => {
  if (!isVisible) return null;

  const getConfig = () => {
    switch (type) {
      case 'search':
        return {
          icon: Sparkles,
          color: 'text-indigo-400',
          bgColor: 'bg-indigo-500/10',
          borderColor: 'border-indigo-500/20',
          title: 'Consultando a Gemini AI',
          desc: 'Analizando bases de datos globales...'
        };
      case 'restore':
        return {
          icon: Database,
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/20',
          title: 'Restaurando Biblioteca',
          desc: 'Procesando archivo de respaldo...'
        };
      default:
        return {
          icon: Loader2,
          color: 'text-slate-400',
          bgColor: 'bg-slate-800',
          borderColor: 'border-slate-700',
          title: 'Cargando',
          desc: 'Por favor espera...'
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className={`relative p-8 rounded-3xl border ${config.borderColor} ${config.bgColor} shadow-2xl max-w-sm w-full mx-4 flex flex-col items-center text-center`}>
        
        {/* Animated Background Glow */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 ${config.color.replace('text', 'bg')}/20 blur-[50px] rounded-full pointer-events-none`}></div>

        <div className="relative z-10 mb-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${config.borderColor} bg-slate-900 shadow-xl`}>
                <Icon className={`w-8 h-8 ${config.color} ${type === 'restore' ? 'animate-bounce' : 'animate-pulse'}`} />
            </div>
            {/* Spinning ring for all */}
            <div className="absolute inset-0 -m-1 border-2 border-transparent border-t-white/20 border-r-white/20 rounded-2xl animate-spin"></div>
        </div>

        <h3 className="text-xl font-bold text-white mb-2 relative z-10">
            {message || config.title}
        </h3>
        <p className="text-slate-400 text-sm font-medium relative z-10">
            {config.desc}
        </p>

        {type === 'restore' && (
             <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 bg-black/20 px-3 py-1.5 rounded-full">
                <FileJson className="w-3 h-3" />
                <span>Parseando JSON e IndexedDB</span>
             </div>
        )}
      </div>
    </div>
  );
};
