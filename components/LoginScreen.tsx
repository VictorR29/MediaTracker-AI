
import React, { useState, useMemo, useEffect } from 'react';
import { Lock, ArrowRight, User, Sparkles, Unlock } from 'lucide-react';
import { MediaItem } from '../types';

interface LoginScreenProps {
  onUnlock: (password: string) => boolean;
  username?: string;
  avatarUrl?: string;
  library?: MediaItem[];
}

// Helper para selección aleatoria
const pickRandom = (arr: string[] | string | undefined): string | null => {
  if (!arr) return null;
  if (typeof arr === 'string') return arr; 
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onUnlock, username, avatarUrl, library = [] }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // --- LOGICA DE MENSAJERIA CONTEXTUAL PROFUNDA ---
  const emotionalContext = useMemo(() => {
    if (!library || library.length === 0) return null;

    const user = username || 'Viajero';
    
    // 1. SELECCIÓN DE OBRA DE ENFOQUE POR ÚLTIMA INTERACCIÓN (TIMESTAMP UNIFICADO)
    // Ordenar estrictamente por lastInteraction descendente
    const sortedByInteraction = [...library].sort((a, b) => {
        const timeA = a.lastInteraction || a.createdAt || 0;
        const timeB = b.lastInteraction || b.createdAt || 0;
        return timeB - timeA;
    });

    const focusWork = sortedByInteraction[0];
    if (!focusWork) return null;

    // 2. Extraer Datos Profundos de la Obra Ganadora (Selección Aleatoria)
    const title = focusWork.aiData.title;
    
    // Random Genre
    const genres = focusWork.aiData.genres || [];
    const genre = pickRandom(genres) || 'esta historia';
    
    // Random Character
    const charsRaw = focusWork.trackingData.favoriteCharacters;
    const charList = Array.isArray(charsRaw) ? charsRaw : (typeof charsRaw === 'string' ? (charsRaw as string).split(',') : []);
    const cleanChars = charList.filter(c => c && c.trim() !== '');
    const character = pickRandom(cleanChars) || 'el protagonista';

    // Random Emotion
    const emotionsRaw = focusWork.trackingData.emotionalTags;
    const emotionList = Array.isArray(emotionsRaw) ? emotionsRaw : [];
    const emotion = pickRandom(emotionList) || 'una emoción intensa';

    // 3. Plantillas de Mensajes
    const templates = [
        // Template 1: Enfocado en Personaje y Trama
        {
            condition: () => cleanChars.length > 0,
            title: `Bienvenido, ${user}.`,
            subtitle: `El mundo de "${title}" sigue girando. ¿Estás listo para volver a ver a ${character}?`,
            cta: `Continuar con ${title}`
        },
        // Template 2: Enfocado en Emoción
        {
            condition: () => emotionList.length > 0,
            title: `Hola de nuevo, ${user}.`,
            subtitle: `Esa sensación de ${emotion.toLowerCase()} en "${title}" aún perdura.`,
            cta: `Revivir ${title}`
        },
        // Template 3: Enfocado en el Género (Obsesión)
        {
            condition: () => true,
            title: `${user}, tu viaje continúa.`,
            subtitle: `Tu afinidad por el género ${genre} es notable. "${title}" requiere tu atención.`,
            cta: `Ingresar a la Colección`
        },
        // Template 4: Desafío / Venganza (Si aplica)
        {
            condition: () => genre.toLowerCase().includes('acción') || genre.toLowerCase().includes('drama'),
            title: `La batalla no ha terminado.`,
            subtitle: `Recuerda todo lo que ha pasado en "${title}". ${character} te necesita.`,
            cta: `Reanudar Misión`
        }
    ];

    // Filtrar templates válidos y seleccionar uno aleatorio
    const validTemplates = templates.filter(t => t.condition());
    const selectedTemplate = validTemplates.length > 0 
        ? validTemplates[Math.floor(Math.random() * validTemplates.length)]
        : templates[2]; // Fallback seguro

    return {
        message: selectedTemplate,
        bgImage: focusWork.aiData.coverImage
    };

  }, [library, username]);

  // Fallback si no hay libreria
  const displayMessage = emotionalContext?.message || {
      title: `Bienvenido, ${username || 'Usuario'}.`,
      subtitle: "Tu colección privada está protegida y lista.",
      cta: "Ingresa tu llave"
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onUnlock(password);
    if (!success) {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden">
      
      {/* Dynamic Atmospheric Background */}
      {emotionalContext?.bgImage && (
          <div className="absolute inset-0 z-0">
             <div className="absolute inset-0 bg-black/60 z-10"></div>
             <img 
                src={emotionalContext.bgImage} 
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
               {displayMessage.title}
           </h1>
           <p className="text-indigo-200 text-lg font-medium drop-shadow-md mb-2 leading-relaxed px-4">
               {displayMessage.subtitle}
           </p>
           
           <div className="mt-4 flex items-center gap-2 text-sm text-slate-300 bg-slate-900/40 backdrop-blur-md px-5 py-2 rounded-full border border-white/10 shadow-lg">
              <Sparkles className="w-4 h-4 text-yellow-400 animate-spin-slow" />
              <span className="font-semibold tracking-wide">{displayMessage.cta}</span>
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
                placeholder="Contraseña..."
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
