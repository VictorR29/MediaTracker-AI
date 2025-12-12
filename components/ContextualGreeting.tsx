
import React, { useMemo, useState, useEffect } from 'react';
import { MediaItem, UserProfile, EMOTIONAL_TAGS_OPTIONS } from '../types';
import { Sparkles, Coffee, Sun, Moon, Film, Tv, BookOpen, PenTool, Zap, Heart, Clock, Star, Hourglass, Bookmark, Feather, Image as ImageIcon, Clapperboard, AlertCircle, Frown, CloudRain, PlayCircle, CheckCircle2, PauseCircle, CalendarClock } from 'lucide-react';

interface ContextualGreetingProps {
  userProfile: UserProfile;
  library: MediaItem[];
  view: string;
}

// Interfaces for Template System
interface Template {
  text: string;
  subtext: string;
  icon: React.ElementType;
}

type TemplateBank = Record<string, Template[]>;

// Helper to pick a random item from an array safely
const pickRandom = (arr: string[] | string | undefined): string | null => {
  if (!arr) return null;
  if (typeof arr === 'string') return arr; 
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
};

export const ContextualGreeting: React.FC<ContextualGreetingProps> = ({ userProfile, library, view }) => {
  const [greeting, setGreeting] = useState<{ text: string; icon: React.ElementType, subtext?: string } | null>(null);

  // Analyze library to find Deep Context based on Last Interaction (Timestamp Unificado)
  const contextData = useMemo(() => {
    if (library.length === 0) return { status: 'empty' };

    // 1. Sort strictly by lastInteraction timestamp to find the absolute latest focus work
    const sortedByInteraction = [...library].sort((a, b) => {
        const timeA = a.lastInteraction || a.createdAt || 0;
        const timeB = b.lastInteraction || b.createdAt || 0;
        return timeB - timeA;
    });

    const focusWork = sortedByInteraction[0];
    if (!focusWork) return { status: 'empty' };

    // Extraer Metadata Base
    const title = focusWork.aiData.title;
    const mediaType = focusWork.aiData.mediaType;
    const workStatus = focusWork.trackingData.status;
    
    // Deep Metadata Extraction for Personalization (Random Selection)
    // [Personaje Favorito]
    const rawChars = focusWork.trackingData.favoriteCharacters;
    const charList = Array.isArray(rawChars) ? rawChars : (typeof rawChars === 'string' ? (rawChars as string).split(',') : []);
    const cleanChars = charList.filter(c => c && c.trim() !== '');
    const character = pickRandom(cleanChars) || (mediaType === 'Pelicula' ? 'el protagonista' : 'tu personaje favorito');

    // [Emoción Dominante]
    const rawEmotions = focusWork.trackingData.emotionalTags;
    const emotionList = Array.isArray(rawEmotions) ? rawEmotions : [];
    const emotion = pickRandom(emotionList) || 'una emoción intensa';

    // [Negative Check]
    const negativeTags = EMOTIONAL_TAGS_OPTIONS
        .filter(opt => opt.sentiment === 'negative')
        .map(opt => opt.label);
    
    const hasNegativeTag = emotionList.some(tag => negativeTags.includes(tag));
    const negativeEmotion = emotionList.find(tag => negativeTags.includes(tag)) || 'ese problema';

    // [Clave de Trama / Género]
    const genres = focusWork.aiData.genres || [];
    const plotKey = pickRandom(genres) || 'esta historia';

    // [Calificación]
    const ratingRaw = focusWork.trackingData.rating || '';
    const rating = ratingRaw.split('(')[0].trim() || 'esta obra';

    return {
        status: 'active',
        focusWork,
        title,
        mediaType,
        workStatus, // Key for logic
        character: character.trim(),
        emotion: emotion.toLowerCase(),
        negativeEmotion: negativeEmotion.toLowerCase(),
        hasNegativeTag,
        plotKey,
        rating
    };
  }, [library]);

  // TEMPLATE BANKS BASED ON CONSUMPTION STATUS
  const TEMPLATES: TemplateBank = useMemo(() => ({
    
    // --- CONTEXTO: VIENDO / LEYENDO (MOTIVACIONAL) ---
    'Watching': [
        { text: `¡El próximo capítulo de "{title}" te espera!`, subtext: `Continúa el viaje junto a {character} en medio de tanto {plotKey}.`, icon: PlayCircle },
        { text: `¿Continuamos con "{title}", {user}?`, subtext: `Esa atmósfera de {emotion} se está poniendo interesante.`, icon: Zap },
        { text: `No dejes a {character} esperando.`, subtext: `Tu progreso en "{title}" es constante. ¡Sigue así!`, icon: Clock },
        { text: `Hora de volver al mundo de "{title}".`, subtext: `La trama de {plotKey} requiere tu atención inmediata.`, icon: Tv },
        { text: `Un poco más de "{title}" para hoy.`, subtext: `Sumérgete de nuevo y siente esa {emotion}.`, icon: Coffee }
    ],

    // --- CONTEXTO: SIN EMPEZAR (PROVOCADOR / INICIO) ---
    'NotStarted': [
        { text: `"{title}" está lista para ser devorada.`, subtext: `¿Hoy es el día del primer capítulo de esta joya de {plotKey}?`, icon: Sparkles },
        { text: `Una nueva aventura te aguarda: "{title}".`, subtext: `Descubre por qué {character} será importante en tu viaje.`, icon: Star },
        { text: `{user}, "{title}" sigue intacta.`, subtext: `Es el momento perfecto para empezar y sentir {emotion} por primera vez.`, icon: BookOpen },
        { text: `¿Curiosidad por "{title}"?`, subtext: `No dejes que siga acumulando polvo digital. ¡Dale play!`, icon: Clapperboard },
        { text: `El inicio de "{title}" promete mucho.`, subtext: `Prepara tus emociones para una dosis de {plotKey}.`, icon: Sun }
    ],

    // --- CONTEXTO: COMPLETADO (CELEBRACIÓN / MEMORIA) ---
    'Completed': [
        { text: `Gracias por registrar esta joya: "{title}".`, subtext: `Tu reflexión sobre {emotion} ha sido guardada en la historia.`, icon: CheckCircle2 },
        { text: `¡Misión cumplida con "{title}"!`, subtext: `Ahora {character} vive en tu memoria como una leyenda.`, icon: Heart },
        { text: `Qué viaje ha sido "{title}", ¿verdad?`, subtext: `Una obra {rating} que definió tu gusto por {plotKey}.`, icon: Feather },
        { text: `Cerraste el ciclo de "{title}".`, subtext: `¿Qué vas a empezar ahora que has superado esa {emotion}?`, icon: Trophy },
        { text: `Honor a quien honor merece.`, subtext: `Has completado "{title}". Tu colección brilla más hoy.`, icon: Award }
    ],

    // --- CONTEXTO: PLANEADO / PENDIENTE (EXPECTATIVA) ---
    'Planned': [
        { text: `La dulce espera por "{title}".`, subtext: `Está en tu Wishlist. Pronto llegará el momento de {character}.`, icon: CalendarClock },
        { text: `"{title}" está en el horizonte.`, subtext: `Prepárate mentalmente para una dosis futura de {plotKey}.`, icon: Hourglass },
        { text: `Paciencia, {user}. "{title}" llegará.`, subtext: `Mientras tanto, imagina las posibilidades de esa {emotion}.`, icon: Bookmark },
        { text: `Tienes "{title}" en la mira.`, subtext: `Un futuro estreno que promete sacudir tu lista de {plotKey}.`, icon: Telescope },
        { text: `Reserva energía para "{title}".`, subtext: `Cuando se estrene, {character} te estará esperando.`, icon: Star }
    ],

    // --- CONTEXTO: PAUSA / DESCARTADO (INVITACIÓN SUAVE / NEUTRAL) ---
    'Paused': [
        { text: `¿Segunda oportunidad para "{title}"?`, subtext: `Hemos notado que está en pausa. ¿Quizás {character} merece otro intento?`, icon: PauseCircle },
        { text: `"{title}" sigue esperando tu regreso.`, subtext: `¿Fue por {negativeEmotion} o simplemente falta de tiempo?`, icon: CloudRain },
        { text: `El tiempo cura todo, incluso en "{title}".`, subtext: `Si decides volver, la trama de {plotKey} seguirá ahí.`, icon: Clock },
        { text: `¿Retomamos o soltamos "{title}"?`, subtext: `Tu biblioteca, tus reglas. Tú decides el destino de {character}.`, icon: HelpCircle },
        { text: `Un descanso de "{title}" es válido.`, subtext: `Pero recuerda esa chispa de {emotion} que te hizo empezar.`, icon: Coffee }
    ],

    // --- CONTEXTO: CRÍTICO (Prioridad si hay tags negativos en Pausa/Watching) ---
    'Critical': [
        { text: `¿Vale la pena continuar "{title}"?`, subtext: `Notaste "{negativeEmotion}". Quizás es hora de reevaluar tu tiempo.`, icon: AlertCircle },
        { text: `{user}, fuiste duro con "{title}".`, subtext: `Esa sensación de {negativeEmotion} no se ignora fácilmente.`, icon: Frown },
        { text: `Reflexionemos sobre "{title}".`, subtext: `¿{negativeEmotion} arruinó la experiencia o hay esperanza?`, icon: CloudRain }
    ]

  }), []);

  useEffect(() => {
    const generateMessage = () => {
      const hour = new Date().getHours();
      let timeGreeting = "Hola";
      
      if (hour >= 5 && hour < 12) { timeGreeting = "Buenos días"; } 
      else if (hour >= 12 && hour < 20) { timeGreeting = "Buenas tardes"; } 
      else { timeGreeting = "Buenas noches"; }

      const { username } = userProfile;

      // 1. EMPTY STATE
      if (contextData.status === 'empty' || !contextData.focusWork) {
          setGreeting({ 
              text: `${timeGreeting}, ${username}.`,
              subtext: "Tu biblioteca está vacía. Busca algo nuevo para empezar.",
              icon: Sparkles
          });
          return;
      }

      // 2. DETERMINE CATEGORY BASED ON STATUS (Not Media Type)
      let category = 'Watching'; // Default fallback
      const status = contextData.workStatus;
      
      // CRITICAL CHECK OVERRIDE (Only if negative tags exist AND status implies active engagement or pause)
      if (contextData.hasNegativeTag && (status === 'Viendo/Leyendo' || status === 'En Pausa')) {
          category = 'Critical';
      } else {
          // Map Status to Template Bank
          switch (status) {
              case 'Viendo/Leyendo':
                  category = 'Watching';
                  break;
              case 'Sin empezar':
                  category = 'NotStarted';
                  break;
              case 'Completado':
                  category = 'Completed';
                  break;
              case 'Planeado / Pendiente':
                  category = 'Planned';
                  break;
              case 'En Pausa':
              case 'Descartado':
                  category = 'Paused';
                  break;
              default:
                  category = 'Watching';
          }
      }

      const bank = TEMPLATES[category] || TEMPLATES['Watching'];
      const rawTemplate = bank[Math.floor(Math.random() * bank.length)];

      // 3. DEEP PERSONALIZATION REPLACEMENT
      const processString = (str: string) => str
        .replace('{user}', username)
        .replace('{title}', contextData.title || 'tu obra')
        .replace('{character}', contextData.character)
        .replace('{emotion}', contextData.emotion)
        .replace('{negativeEmotion}', contextData.negativeEmotion || 'ese detalle')
        .replace('{plotKey}', contextData.plotKey)
        .replace('{rating}', contextData.rating.toLowerCase());

      setGreeting({ 
          text: processString(rawTemplate.text), 
          subtext: processString(rawTemplate.subtext), 
          icon: rawTemplate.icon 
      });
    };

    generateMessage();
  }, [userProfile, contextData, TEMPLATES]);

  if (!greeting) return null;
  const Icon = greeting.icon;

  // Import missing icons for the TSX to compile correctly if not already present
  // Note: Added imports to the top of the file.

  return (
    <div key={view} className="w-full max-w-5xl mx-auto mb-6 animate-fade-in px-4 md:px-0">
        <div 
            className="relative overflow-hidden rounded-xl p-6 border border-white/10 shadow-lg group hover:shadow-2xl transition-all duration-500"
            style={{ 
                background: `linear-gradient(135deg, ${userProfile.accentColor ? '#' + userProfile.accentColor.split(' ')[0] : '#6366f1'} 0%, #0f172a 100%)` 
            }}
        >
             {/* Abstract Shapes */}
             <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none group-hover:bg-white/20 transition-all duration-700 animate-pulse"></div>
             <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-black/30 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

             <div className="relative z-10 flex items-start md:items-center gap-4">
                 <div className="p-3 bg-white/20 backdrop-blur-md rounded-full shadow-inner flex-shrink-0 animate-fade-in-up">
                     <Icon className="w-6 h-6 text-white" />
                 </div>
                 <div className="animate-fade-in">
                     <p className="text-white text-lg md:text-xl font-bold leading-tight drop-shadow-md">
                        {greeting.text}
                     </p>
                     {greeting.subtext && (
                        <p className="text-white/80 text-sm md:text-base mt-1 font-medium leading-relaxed">
                            {greeting.subtext}
                        </p>
                     )}
                 </div>
             </div>
        </div>
    </div>
  );
};

// Helper components for icons not imported in original file
const Trophy = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>;
const Award = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>;
const Telescope = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m10.065 12.493-6.15 6.15a2.121 2.121 0 1 1-3-3l6.15-6.15"/><path d="m14.935 12.493 6.15 6.15a2.121 2.121 0 1 0 3-3l-6.15-6.15"/><path d="m20 4-6 6a2 2 0 0 1-2.828 0l-6-6a2 2 0 0 1 2.828 0L12 8l4-4 2.828 2.828a2 2 0 0 1 0 2.828z"/></svg>;
const HelpCircle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>;
