
import React, { useState, useMemo, useEffect } from 'react';
import { Lock, ArrowRight, User, Sparkles, Unlock } from 'lucide-react';
import { MediaItem, RATING_TO_SCORE } from '../types';

interface LoginScreenProps {
  onUnlock: (password: string) => boolean;
  username?: string;
  avatarUrl?: string;
  library?: MediaItem[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onUnlock, username, avatarUrl, library = [] }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Analyze library for "Emotional Context"
  const context = useMemo(() => {
    if (!library || library.length === 0) return null;

    // 1. Find Dominant Genre (based on weighted ratings)
    const genreCounts: Record<string, number> = {};
    library.forEach(item => {
        const rating = item.trackingData.rating;
        const score = RATING_TO_SCORE[rating] || 5; // Default weight 5
        item.aiData.genres.forEach(g => {
            genreCounts[g] = (genreCounts[g] || 0) + score;
        });
    });
    
    let dominantGenre = 'Anime';
    let maxScore = 0;
    Object.entries(genreCounts).forEach(([g, s]) => {
        if (s > maxScore) {
            maxScore = s;
            dominantGenre = g;
        }
    });

    // 2. Find "Suggested Work" (Active item, sorted by recent activity/creation)
    // Priorities: Status 'Viendo/Leyendo' > Most Recently Added
    const activeItems = library.filter(i => i.trackingData.status === 'Viendo/Leyendo');
    const sortedActive = activeItems.sort((a, b) => b.createdAt - a.createdAt);
    
    const suggestedItem = sortedActive.length > 0 ? sortedActive[0] : library[0];

    return { dominantGenre, suggestedItem };
  }, [library]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onUnlock(password);
    if (!success) {
      setError(true);
      setPassword('');
    }
  };

  // Generate "Emotional Message"
  const emotionalMessage = useMemo(() => {
    const hour = new Date().getHours();
    let greeting = "Hola de nuevo";
    if (hour < 12) greeting = "Buenos días";
    else if (hour < 20) greeting = "Buenas tardes";
    else greeting = "Buenas noches";

    if (!context) {
        return {
            title: `${greeting}, ${username || 'Viajero'}.`,
            subtitle: "Tu colección privada está a salvo.",
            cta: "Ingresa tu llave para continuar."
        };
    }

    const { dominantGenre, suggestedItem } = context;
    const itemTitle = suggestedItem?.aiData.title;

    return {
        title: `${greeting}, ${username}.`,
        subtitle: `Tu obsesión actual por el género ${dominantGenre} sigue creciendo.`,
        cta: itemTitle 
            ? `¿Es hora de actualizar "${itemTitle}"?` 
            : "Tus historias te están esperando."
    };

  }, [username, context]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden">
      
      {/* Dynamic Atmospheric Background */}
      {context?.suggestedItem?.aiData.coverImage && (
          <div className="absolute inset-0 z-0">
             <div className="absolute inset-0 bg-black/60 z-10"></div>
             <img 
                src={context.suggestedItem.aiData.coverImage} 
                className="w-full h-full object-cover blur-3xl opacity-40 scale-110 animate-pulse-slow"
                alt="Atmosphere"
             />
          </div>
      )}

      <div className={`w-full max-w-md z-10 p-6 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        
        {/* Profile Section */}
        <div className="text-center mb-10 flex flex-col items-center">
           <div className="relative mb-6 group">
                <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_30px_rgba(99,102,241,0.5)]">
                    <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden relative">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                <User className="w-12 h-12 text-slate-500" />
                            </div>
                        )}
                    </div>
                </div>
                <div className="absolute -bottom-2 -right-2 bg-slate-900 rounded-full p-2 border border-slate-700 shadow-lg">
                    <Lock className="w-5 h-5 text-white" />
                </div>
           </div>
           
           <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg tracking-tight">
               {emotionalMessage.title}
           </h1>
           <p className="text-indigo-200 text-lg font-medium drop-shadow-md mb-2">
               {emotionalMessage.subtitle}
           </p>
           
           <div className="mt-2 flex items-center gap-2 text-sm text-slate-400 bg-slate-900/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
              <Sparkles className="w-4 h-4 text-yellow-400 animate-spin-slow" />
              <span>{emotionalMessage.cta}</span>
           </div>
        </div>

        {/* Login Input */}
        <form onSubmit={handleSubmit} className="relative group perspective-1000">
          <div 
             className={`bg-white/10 backdrop-blur-xl border p-2 rounded-2xl shadow-2xl flex items-center transition-all duration-300 ${
                 error ? 'border-red-500/50 bg-red-900/10' : 'border-white/20 hover:bg-white/15 focus-within:bg-white/20 focus-within:border-indigo-400/50'
             }`}
          >
            <input 
                type="password" 
                autoFocus
                className="bg-transparent border-none text-white px-4 py-3 flex-grow outline-none placeholder-slate-400 text-lg tracking-widest text-center"
                placeholder="Ingresa tu llave..."
                value={password}
                onChange={(e) => {
                    setPassword(e.target.value);
                    setError(false);
                }}
            />
            <button 
                type="submit"
                className={`p-3 rounded-xl transition-all duration-300 transform ${
                    password ? 'bg-indigo-500 text-white shadow-lg scale-100' : 'bg-white/5 text-slate-500 scale-90 cursor-default'
                }`}
                disabled={!password}
            >
                {password ? <Unlock className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
          
          {/* Error Shake Animation Wrapper */}
          {error && (
            <div className="absolute inset-0 pointer-events-none border-2 border-red-500 rounded-2xl animate-[shake_0.4s_ease-in-out]"></div>
          )}
        </form>
        
        {error && (
            <p className="text-red-400 text-sm text-center mt-4 animate-fade-in font-medium drop-shadow-md">
                Contraseña incorrecta
            </p>
        )}
      </div>
    </div>
  );
};
