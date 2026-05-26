import React, { useState, useMemo, useEffect } from 'react';
import { Lock, ArrowRight, User, Sparkles, Unlock } from 'lucide-react';
import { MediaItem, EMOTIONAL_TAGS_OPTIONS } from '../types';

interface LoginScreenProps {
  onUnlock: (password: string) => Promise<boolean>;
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

    // 2. Extraer Datos Profundos de la Obra Ganadora
    const title = focusWork.aiData.title;
    const status = focusWork.trackingData.status;
    
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

    // Negative Tag Detection
    const negativeTags = EMOTIONAL_TAGS_OPTIONS
        .filter(opt => opt.sentiment === 'negative')
        .map(opt => opt.label);
    const hasNegativeTag = emotionList.some(tag => negativeTags.includes(tag));
    const negativeEmotion = emotionList.find(tag => negativeTags.includes(tag)) || 'ese detalle';

    // 3. Plantillas de Mensajes BASADAS EN ESTADO (STATUS)
    const templates = [
         // Template 0: CRÍTICO / PAUSADO (Si hay tags negativos o está en pausa)
        {
            condition: () => (status === 'En Pausa' || status === 'Descartado') || hasNegativeTag,
            title: `Una decisión pendiente, ${user}.`,
            subtitle: hasNegativeTag 
                ? `Notaste "${negativeEmotion}" en "${title}". ¿Es momento de reconsiderar?`
                : `"${title}" espera en el limbo. ¿Le damos una segunda oportunidad?`,
            cta: `Analizar Biblioteca`
        },
        // Template 1: VIENDO / LEYENDO (Progreso Activo)
        {
            condition: () => status === 'Viendo/Leyendo',
            title: `El viaje continúa, ${user}.`,
            subtitle: cleanChars.length > 0 
                 ? `El mundo de "${title}" sigue girando. ${character} te necesita.`
                 : `Estás inmerso en "${title}". El siguiente capítulo promete ${emotion}.`,
            cta: `Continuar con ${title}`
        },
        // Template 2: SIN EMPEZAR (Provocación)
        {
            condition: () => status === 'Sin empezar',
            title: `Una nueva historia te llama.`,
            subtitle: `"${title}" está lista. ¿Hoy es el día de comenzar esta aventura de ${genre}?`,
            cta: `Empezar ${title}`
        },
        // Template 3: COMPLETADO (Celebración)
        {
            condition: () => status === 'Completado',
            title: `Misión cumplida, ${user}.`,
            subtitle: `Has completado "${title}". Ese sentimiento de ${emotion} perdurará.`,
            cta: `Ver Colección`
        },
        // Template 4: PLANEADO (Expectativa)
        {
            condition: () => status === 'Planeado / Pendiente',
            title: `Futuros estrenos.`,
            subtitle: `"${title}" está en tu horizonte. La espera valdrá la pena.`,
            cta: `Revisar Wishlist`
        },
         // Template 5: Fallback General
        {
            condition: () => true,
            title: `Tu biblioteca te espera, ${user}.`,
            subtitle: `Es momento de retomar tu colección de ${genre}.`,
            cta: `Desbloquear`
        }
    ];

    // Selección lógica basada en condición
    const selectedTemplate = templates.find(t => t.condition()) || templates[templates.length - 1];

    // Validate Cover Image for Background
    let bgImage = focusWork.aiData.coverImage;
    if (!bgImage || bgImage.trim() === '' || bgImage.includes('placehold.co')) {
        bgImage = undefined;
    }

    return {
        message: selectedTemplate,
        bgImage: bgImage
    };

  }, [library, username]);

  // Fallback data if no library/focus work
  const displayMessage = emotionalContext?.message || {
      title: `Bienvenido, ${username || 'Usuario'}.`,
      subtitle: "Tu colección privada está protegida y lista.",
      cta: "Ingresa tu llave"
  };

  const [isVerifying, setIsVerifying] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    try {
      const success = await onUnlock(password);
      if (!success) {
        setError(true);
        setPassword('');
      }
    } catch {
      setError(true);
      setPassword('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#09090B] flex items-center justify-center relative overflow-hidden">

      {/* Dynamic Background Cover with Blur and Overlay */}
      {emotionalContext?.bgImage ? (
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* Dark Overlay - Void Black to ensure readability */}
          <div className="absolute inset-0 bg-[#09090B]/70 z-10"></div>

          {/* The Image - Full Cover, Blurred */}
          <img
            src={emotionalContext.bgImage}
            className="w-full h-full object-cover blur-[8px] scale-110 transition-transform duration-1000"
            alt="Background Cover"
          />
        </div>
      ) : (
        /* Standard Fallback Background (Gradient) */
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#09090B] via-[#111113] to-[#09090B]"></div>
      )}

      <div className={`w-full max-w-md z-10 p-6 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        
        {/* Profile Section */}
        <div className="text-center mb-10 flex flex-col items-center">
      <div className="relative mb-6 group">
        <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_20px_rgba(99,102,241,0.40)]">
          <div className="w-full h-full rounded-full bg-[#09090B] overflow-hidden relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#111113]">
                <User className="w-12 h-12 text-zinc-500" />
              </div>
            )}
          </div>
        </div>
        <div className="absolute -bottom-2 -right-2 bg-[#111113] rounded-full p-2 ring-1 ring-white/[0.12] shadow-lg">
          <Lock className="w-5 h-5 text-white" />
        </div>
      </div>
           
      <h1 className="text-4xl font-extrabold text-white mb-2 drop-shadow-2xl" style={{ letterSpacing: '-0.03em' }}>
        {displayMessage.title}
      </h1>
      <p className="text-zinc-300 text-lg font-medium drop-shadow-md mb-2 leading-relaxed px-4">

        {displayMessage.subtitle}
      </p>

      <div className="mt-4 flex items-center gap-2 text-[10px] text-zinc-300 bg-[#111113]/80 backdrop-blur-xl px-5 py-2 rounded-full ring-1 ring-white/[0.08] shadow-lg">
        <Sparkles className="w-4 h-4 text-yellow-400 animate-spin-slow" />
        <span className="font-extrabold uppercase" style={{ letterSpacing: '0.1em' }}>{displayMessage.cta}</span>
      </div>
        </div>

      {/* Login Input — Double-Bezel */}
      <form onSubmit={handleSubmit} className="relative group perspective-1000">
        {/* Outer Shell */}
        <div
          className={`bg-[#111113] p-1 rounded-2xl ring-1 ring-white/[0.12] shadow-2xl transition-all duration-300 ${  error ? 'ring-red-500/50' : ''  }`}
        >
          {/* Inner Glass Core */}
          <div
            className={`bg-white/[0.06] backdrop-blur-xl p-2 rounded-[calc(1rem-0.25rem)] flex items-center transition-all duration-300 ${  error ? 'bg-red-900/10' : 'focus-within:bg-white/[0.08]'  }`}
          >
            <input
              type="password"
              autoFocus
              className="bg-transparent border-none text-white px-4 py-3 flex-grow outline-none placeholder-zinc-500 text-lg tracking-widest text-center font-mono"
              placeholder="Contraseña..."
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
            />
            <button
              type="submit"
              className={`p-3 rounded-xl transition-all duration-150 transform active:scale-[0.95] ${  password ? 'bg-white text-[#09090B] shadow-[0_0_16px_rgba(255,255,255,0.10)] scale-100' : 'bg-white/5 text-zinc-500 scale-90 cursor-default'  }`}
              style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              disabled={!password || isVerifying}
            >
              {isVerifying ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : password ? <Unlock className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
          
        {error && (
          <div className="absolute inset-0 pointer-events-none ring-2 ring-red-500 rounded-2xl animate-[shake_0.4s_cubic-bezier(0.32,0.72,0,1)]"></div>
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