import React, { useMemo, useState, useEffect } from 'react';
import { MediaItem, UserProfile, RATING_TO_SCORE } from '../types';
import { Sparkles, Coffee, Sun, Moon, Zap, Heart, Skull, Rocket, BookOpen, Smile, Crown, Flame } from 'lucide-react';

interface ContextualGreetingProps {
  userProfile: UserProfile;
  library: MediaItem[];
}

export const ContextualGreeting: React.FC<ContextualGreetingProps> = ({ userProfile, library }) => {
  const [greeting, setGreeting] = useState<{ text: string; icon: React.ElementType, subtext?: string } | null>(null);

  // Analyze library to find Deep Context
  const contextData = useMemo(() => {
    if (library.length === 0) return { status: 'empty' };

    let focusWork: MediaItem | undefined;

    // 1. Prioridad Máxima: Obras Activas (Viendo/Leyendo o Planeado)
    const activeWorks = library.filter(i => 
        i.trackingData.status === 'Viendo/Leyendo' || 
        i.trackingData.status === 'Planeado / Pendiente'
    );

    // 2. Segunda Prioridad: God Tier Completado
    const godTierWorks = library.filter(i => 
        i.trackingData.status === 'Completado' && 
        i.trackingData.rating.includes('God Tier')
    );

    // Selección basada en prioridad
    if (activeWorks.length > 0) {
        focusWork = activeWorks[0];
    } else if (godTierWorks.length > 0) {
        focusWork = godTierWorks[0];
    } else {
        focusWork = library[0];
    }

    // Extraer Metadata
    const title = focusWork?.aiData.title || '';
    const genre = focusWork?.aiData.genres[0] || 'Historias';
    
    // Character
    const chars = focusWork?.trackingData.favoriteCharacters || [];
    const charList = Array.isArray(chars) ? chars : (typeof chars === 'string' ? (chars as string).split(',') : []);
    const character = charList.length > 0 ? charList[0].trim() : 'ese personaje especial';

    // Emotion
    const emotions = focusWork?.trackingData.emotionalTags || [];
    const emotion = emotions.length > 0 ? emotions[0].toLowerCase() : 'emoción';

    // Genre Dominance for general stats
    const genreCounts: Record<string, number> = {};
    library.forEach(item => {
        const r = item.trackingData.rating;
        const s = RATING_TO_SCORE[r] || 0;
        if (s >= 7 || item.trackingData.status === 'Completado') {
             item.aiData.genres.forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1);
        }
    });
    let topGenre = '';
    let maxCount = 0;
    Object.entries(genreCounts).forEach(([g, c]) => { if (c > maxCount) { maxCount = c; topGenre = g; } });

    return {
        status: 'active',
        focusWork,
        title,
        character,
        emotion,
        genre,
        topGenre: topGenre || genre,
        hasChar: charList.length > 0,
        hasEmotion: emotions.length > 0
    };
  }, [library]);

  useEffect(() => {
    const generateMessage = () => {
      const hour = new Date().getHours();
      let timeGreeting = "Hola";
      let TimeIcon = Sun;
      
      if (hour >= 5 && hour < 12) { timeGreeting = "Buenos días"; TimeIcon = Coffee; } 
      else if (hour >= 12 && hour < 20) { timeGreeting = "Buenas tardes"; TimeIcon = Sun; } 
      else { timeGreeting = "Buenas noches"; TimeIcon = Moon; }

      const { username } = userProfile;

      // 1. EMPTY STATE
      if (contextData.status === 'empty') {
          setGreeting({ 
              text: `${timeGreeting}, ${username}. Tu biblioteca es un lienzo en blanco. ¿Qué descubriremos hoy?`,
              icon: Sparkles
          });
          return;
      }

      // 2. PLANTILLAS DINÁMICAS (ROTACIÓN)
      const templates = [
          // T1: Standard / Time based
          {
              condition: true,
              text: `${timeGreeting}, ${username}. ¿Listo para continuar donde lo dejaste en ${contextData.title}?`,
              subtext: `Tu colección de ${contextData.topGenre} sigue creciendo.`,
              icon: TimeIcon
          },
          // T2: Character Focus
          {
              condition: contextData.hasChar,
              text: `El destino de ${contextData.character} pende de un hilo, ${username}.`,
              subtext: `Continúa viendo ${contextData.title}.`,
              icon: Crown
          },
          // T3: Emotion Focus
          {
              condition: contextData.hasEmotion,
              text: `${username}, esa sensación de ${contextData.emotion} en ${contextData.title} es única.`,
              subtext: `Vale la pena seguir explorando.`,
              icon: Heart
          },
          // T4: Action / Hype
          {
              condition: true,
              text: `¡Qué buen día para consumir ${contextData.genre}, ${username}!`,
              subtext: `${contextData.title} te está esperando.`,
              icon: Zap
          },
          // T5: Obsession / God Tier Ref
          {
              condition: true,
              text: `Tu obsesión actual: ${contextData.title}.`,
              subtext: `No dejes a ${contextData.character} esperando.`,
              icon: Flame
          }
      ];

      // Filter & Random Selection
      const valid = templates.filter(t => t.condition);
      const selected = valid[Math.floor(Math.random() * valid.length)];

      setGreeting({ text: selected.text, icon: selected.icon, subtext: selected.subtext });
    };

    generateMessage();
  }, [userProfile, contextData]);

  if (!greeting) return null;
  const Icon = greeting.icon;

  return (
    <div className="w-full max-w-5xl mx-auto mb-6 animate-fade-in">
        <div 
            className="relative overflow-hidden rounded-xl p-6 border border-white/10 shadow-lg"
            style={{ 
                background: `linear-gradient(135deg, ${userProfile.accentColor ? '#' + userProfile.accentColor.split(' ')[0] : '#6366f1'} 0%, #1e293b 100%)` 
            }}
        >
             {/* Abstract Shapes */}
             <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
             <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-black/20 rounded-full blur-3xl pointer-events-none"></div>

             <div className="relative z-10 flex items-start md:items-center gap-4">
                 <div className="p-3 bg-white/20 backdrop-blur-md rounded-full shadow-inner flex-shrink-0">
                     <Icon className="w-6 h-6 text-white" />
                 </div>
                 <div>
                     <p className="text-white md:text-lg font-bold leading-tight drop-shadow-md">
                        {greeting.text}
                     </p>
                     {greeting.subtext && (
                        <p className="text-white/70 text-sm mt-1 font-medium">
                            {greeting.subtext}
                        </p>
                     )}
                 </div>
             </div>
        </div>
    </div>
  );
};