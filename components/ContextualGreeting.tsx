

import React, { useMemo, useState, useEffect } from 'react';
import { MediaItem, UserProfile } from '../types';
import { Sparkles, Coffee, Sun, Moon, Film, Tv, BookOpen, PenTool, Zap, Heart, Clock, Star } from 'lucide-react';

interface ContextualGreetingProps {
  userProfile: UserProfile;
  library: MediaItem[];
}

// Interfaces for Template System
interface Template {
  text: string;
  subtext: string;
  icon: React.ElementType;
}

type TemplateBank = Record<string, Template[]>;

export const ContextualGreeting: React.FC<ContextualGreetingProps> = ({ userProfile, library }) => {
  const [greeting, setGreeting] = useState<{ text: string; icon: React.ElementType, subtext?: string } | null>(null);

  // Analyze library to find Deep Context based on Last Interaction
  const contextData = useMemo(() => {
    if (library.length === 0) return { status: 'empty' };

    // 1. Sort strictly by lastInteraction timestamp to find the absolute latest focus work
    // Fallback to createdAt if lastInteraction is missing (for legacy items)
    const sortedByInteraction = [...library].sort((a, b) => {
        const timeA = a.lastInteraction || a.createdAt || 0;
        const timeB = b.lastInteraction || b.createdAt || 0;
        return timeB - timeA;
    });

    const focusWork = sortedByInteraction[0];
    if (!focusWork) return { status: 'empty' };

    // Extraer Metadata
    const title = focusWork.aiData.title;
    const mediaType = focusWork.aiData.mediaType;
    
    // Deep Metadata Extraction
    const chars = focusWork.trackingData.favoriteCharacters || [];
    const charList = Array.isArray(chars) ? chars : (typeof chars === 'string' ? (chars as string).split(',') : []);
    const character = charList.length > 0 ? charList[0].trim() : (mediaType === 'Pelicula' ? 'el elenco' : 'el protagonista');

    const emotions = focusWork.trackingData.emotionalTags || [];
    const emotion = emotions.length > 0 ? emotions[0].toLowerCase() : 'esa emoción';

    return {
        status: 'active',
        focusWork,
        title,
        mediaType,
        character,
        emotion
    };
  }, [library]);

  // TEMPLATE BANKS BY CONTENT TYPE
  const TEMPLATES: TemplateBank = useMemo(() => ({
    // Bank 1: Peliculas
    'Pelicula': [
        { text: `Los créditos de {title} han terminado, {user}.`, subtext: `Pero la sensación de {emotion} perdura en el aire.`, icon: Film },
        { text: `¿Sigues pensando en el final de {title}?`, subtext: `Fue un viaje corto pero intenso junto a {character}.`, icon: Star },
        { text: `{user}, el cine tiene el poder de cambiarnos.`, subtext: `Como lo hizo {title} con su dosis de {emotion}.`, icon: Film },
        { text: `Una historia contada en dos horas: {title}.`, subtext: `Suficiente para que {character} sea memorable.`, icon: Clock },
        { text: `La pantalla se apaga, pero {title} se queda.`, subtext: `Esa atmósfera de {emotion} es difícil de olvidar.`, icon: Heart }
    ],
    // Bank 2: Series & Anime
    'Serie': [
        { text: `El siguiente episodio de {title} te espera, {user}.`, subtext: `{character} tiene mucho que contarte todavía.`, icon: Tv },
        { text: `¿Maratón de {title} hoy?`, subtext: `La trama se está poniendo intensa y llena de {emotion}.`, icon: Zap },
        { text: `No dejes a {character} en suspenso.`, subtext: `El mundo de {title} sigue girando sin ti.`, icon: Clock },
        { text: `Esa sensación de {emotion} en {title}...`, subtext: `Es lo que hace que esta serie sea especial.`, icon: Heart },
        { text: `{user}, es hora de volver al mundo de {title}.`, subtext: `Quedan historias por cerrar.`, icon: Tv }
    ],
    // Bank 3: Libros
    'Libro': [
        { text: `Las páginas de {title} te llaman, {user}.`, subtext: `{character} vive en tu imaginación ahora.`, icon: BookOpen },
        { text: `Solo un capítulo más de {title}...`, subtext: `Sumérgete de nuevo en esa atmósfera de {emotion}.`, icon: Moon },
        { text: `El marcador en {title} sigue en el mismo lugar.`, subtext: `Es hora de avanzar en la historia de {character}.`, icon: BookOpen },
        { text: `{user}, la tinta de {title} es indeleble.`, subtext: `Sobre todo cuando te provoca tanta {emotion}.`, icon: Star },
        { text: `Un buen libro como {title} es un amigo.`, subtext: `Vuelve a visitar a {character} hoy.`, icon: Coffee }
    ],
    // Bank 4: Reading Visual (Manhwa, Manga, Comic)
    'LecturaVisual': [
        { text: `El arte de {title} te sigue esperando.`, subtext: `Cada panel con {character} es una obra maestra.`, icon: PenTool },
        { text: `¿Listo para el siguiente capítulo de {title}?`, subtext: `Ese cliffhanger lleno de {emotion} no se resolverá solo.`, icon: Zap },
        { text: `{user}, el mundo de {title} es adictivo.`, subtext: `Vuelve a conectar con la historia de {character}.`, icon: BookOpen },
        { text: `Desliza hacia el siguiente panel de {title}.`, subtext: `Donde la {emotion} cobra vida visualmente.`, icon: PenTool },
        { text: `Tu lectura de {title} está en pausa.`, subtext: `Es hora de reanudar el viaje de {character}.`, icon: Clock }
    ]
  }), []);

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
      if (contextData.status === 'empty' || !contextData.focusWork) {
          setGreeting({ 
              text: `${timeGreeting}, ${username}.`,
              subtext: "Tu biblioteca es un lienzo en blanco. ¿Qué descubriremos hoy?",
              icon: Sparkles
          });
          return;
      }

      // 2. DETERMINE CATEGORY & SELECT TEMPLATE
      const type = contextData.mediaType;
      let category = 'Serie'; // Default
      if (type === 'Pelicula') category = 'Pelicula';
      else if (type === 'Libro') category = 'Libro';
      else if (['Manhwa', 'Manga', 'Comic'].includes(type)) category = 'LecturaVisual';
      else if (['Anime', 'Serie'].includes(type)) category = 'Serie';

      const bank = TEMPLATES[category] || TEMPLATES['Serie'];
      const rawTemplate = bank[Math.floor(Math.random() * bank.length)];

      // 3. REPLACE PLACEHOLDERS
      const processedText = rawTemplate.text
        .replace('{user}', username)
        .replace('{title}', contextData.title || 'tu obra')
        .replace('{character}', contextData.character)
        .replace('{emotion}', contextData.emotion);

      const processedSubtext = rawTemplate.subtext
        .replace('{user}', username)
        .replace('{title}', contextData.title || 'tu obra')
        .replace('{character}', contextData.character)
        .replace('{emotion}', contextData.emotion);

      setGreeting({ 
          text: processedText, 
          subtext: processedSubtext, 
          icon: rawTemplate.icon 
      });
    };

    generateMessage();
  }, [userProfile, contextData, TEMPLATES]);

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