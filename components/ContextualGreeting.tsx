
import React, { useMemo, useState, useEffect } from 'react';
import { MediaItem, UserProfile } from '../types';
import { Sparkles, Coffee, Sun, Moon, Film, Tv, BookOpen, PenTool, Zap, Heart, Clock, Star, Hourglass, Bookmark, Feather, Image as ImageIcon, Clapperboard } from 'lucide-react';

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
  if (typeof arr === 'string') return arr; // Handle case where it might be a comma string
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
    
    // Deep Metadata Extraction for Personalization (Random Selection)
    // [Personaje Favorito] - Pick ONE random char from the list
    const rawChars = focusWork.trackingData.favoriteCharacters;
    const charList = Array.isArray(rawChars) ? rawChars : (typeof rawChars === 'string' ? (rawChars as string).split(',') : []);
    // Filter empty strings
    const cleanChars = charList.filter(c => c && c.trim() !== '');
    const character = pickRandom(cleanChars) || (mediaType === 'Pelicula' ? 'el protagonista' : 'tu personaje favorito');

    // [Emoción Dominante] - Pick ONE random emotion from the tags
    const rawEmotions = focusWork.trackingData.emotionalTags;
    const emotionList = Array.isArray(rawEmotions) ? rawEmotions : [];
    const emotion = pickRandom(emotionList) || 'una emoción intensa';

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
        character: character.trim(),
        emotion: emotion.toLowerCase(),
        plotKey,
        rating
    };
  }, [library]);

  // TEMPLATE BANKS BY CONTENT TYPE (4 Banks, 5+ Templates each)
  const TEMPLATES: TemplateBank = useMemo(() => ({
    // Banco 1: Peliculas (Finales y Duración)
    'Pelicula': [
        { text: `¿Aún pensando en el final de "{title}"?`, subtext: `Fue un cierre digno de una {rating}. {character} dejó huella.`, icon: Film },
        { text: `Los créditos han terminado, {user}.`, subtext: `Pero la sensación de {emotion} sigue en el aire gracias a {character}.`, icon: Star },
        { text: `Una película, mil emociones.`, subtext: `"{title}" te hizo sentir {emotion} en menos de dos horas.`, icon: Heart },
        { text: `El cine tiene magia, ¿verdad?`, subtext: `Especialmente cuando {character} protagoniza una historia de {plotKey}.`, icon: Clapperboard },
        { text: `{user}, procesemos lo que acabamos de ver.`, subtext: `"{title}" no es solo una película, es {emotion} pura.`, icon: Hourglass }
    ],
    // Banco 2: Series y Anime (Episodios y Temporadas)
    'Serie': [
        { text: `El siguiente episodio de "{title}" te llama.`, subtext: `No dejes a {character} esperando en medio de tanto {plotKey}.`, icon: Tv },
        { text: `¿Maratón de {plotKey} hoy, {user}?`, subtext: `La trama de "{title}" está cargada de {emotion}.`, icon: Zap },
        { text: `Un capítulo más no hace daño...`, subtext: `Sobre todo para ver qué destino le depara a {character}.`, icon: Clock },
        { text: `Volvamos al mundo de "{title}".`, subtext: `Esa atmósfera de {emotion} es adictiva.`, icon: Bookmark },
        { text: `{user}, tu serie favorita te necesita.`, subtext: `Continúa el viaje junto a {character}.`, icon: Tv }
    ],
    // Banco 3: Libros/Novelas (Capítulos, Páginas y Sagas)
    'Libro': [
        { text: `Tu separador sigue en "{title}".`, subtext: `Es hora de volver a leer sobre {character} y sentir {emotion}.`, icon: BookOpen },
        { text: `La imaginación no descansa, {user}.`, subtext: `El mundo de {plotKey} en "{title}" cobra vida contigo.`, icon: Feather },
        { text: `Solo unas páginas más...`, subtext: `Descubre qué pasa con {character} en este capítulo.`, icon: Moon },
        { text: `Una buena lectura cura todo.`, subtext: `Especialmente una {rating} llena de {emotion} como esta.`, icon: Coffee },
        { text: `La tinta de "{title}" es indeleble.`, subtext: `Sumérgete de nuevo en la historia de {plotKey}.`, icon: BookOpen }
    ],
    // Banco 4: Webtoon/Comic/Manhwa (Capítulos, Dibujo/Arte)
    'LecturaVisual': [
        { text: `El arte de "{title}" es hipnótico.`, subtext: `Cada panel con {character} transmite pura {emotion}.`, icon: PenTool },
        { text: `Desliza hacia el siguiente capítulo.`, subtext: `La historia de {plotKey} en "{title}" se pone mejor.`, icon: ImageIcon },
        { text: `¿Viste ese dibujo de {character}?`, subtext: `"{title}" es visualmente {rating}.`, icon: Zap },
        { text: `{user}, el webtoon te espera.`, subtext: `No pierdas el hilo de esta trama de {emotion}.`, icon: Tv },
        { text: `Vuelve a los paneles de "{title}".`, subtext: `Un festín visual de {plotKey} te aguarda.`, icon: BookOpen }
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

      // 2. DETERMINE CATEGORY & SELECT TEMPLATE
      const type = contextData.mediaType;
      let category = 'Serie'; // Default fallback
      if (type === 'Pelicula') category = 'Pelicula';
      else if (type === 'Libro') category = 'Libro';
      else if (['Manhwa', 'Manga', 'Comic'].includes(type)) category = 'LecturaVisual';
      else if (['Anime', 'Serie'].includes(type)) category = 'Serie';

      const bank = TEMPLATES[category] || TEMPLATES['Serie'];
      const rawTemplate = bank[Math.floor(Math.random() * bank.length)];

      // 3. DEEP PERSONALIZATION REPLACEMENT
      // Reemplaza los marcadores en Título y Subtítulo
      const processString = (str: string) => str
        .replace('{user}', username)
        .replace('{title}', contextData.title || 'tu obra')
        .replace('{character}', contextData.character)
        .replace('{emotion}', contextData.emotion)
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
