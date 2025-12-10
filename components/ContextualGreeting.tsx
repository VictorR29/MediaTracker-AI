
import React, { useMemo, useState, useEffect } from 'react';
import { MediaItem, UserProfile, RATING_TO_SCORE } from '../types';
import { Sparkles, Coffee, Sun, Moon, Zap, Heart, Skull, Rocket, BookOpen, Smile, Crown } from 'lucide-react';

interface ContextualGreetingProps {
  userProfile: UserProfile;
  library: MediaItem[];
}

export const ContextualGreeting: React.FC<ContextualGreetingProps> = ({ userProfile, library }) => {
  const [greeting, setGreeting] = useState<{ text: string; icon: React.ElementType } | null>(null);

  // Analyze library to find context
  const contextData = useMemo(() => {
    if (library.length === 0) return { status: 'empty' };

    let totalScore = 0;
    let ratedCount = 0;
    const genreCounts: Record<string, number> = {};
    let completedCount = 0;

    library.forEach(item => {
      // Count Completed
      if (item.trackingData.status === 'Completado') completedCount++;

      // Genre Analysis (Weighted by Rating)
      const rating = item.trackingData.rating;
      const score = RATING_TO_SCORE[rating] || 0;
      
      // We consider "Dominant" genres from things the user ACTUALLY likes (Score >= 7 or Completed)
      if (score >= 7 || item.trackingData.status === 'Completado') {
         item.aiData.genres.forEach(g => {
            // High rated items give more weight to the genre
            const weight = score >= 9 ? 2 : 1;
            genreCounts[g] = (genreCounts[g] || 0) + weight;
         });
      }
      
      if (score > 0) {
          totalScore += score;
          ratedCount++;
      }
    });

    // Find Top Genre
    let topGenre = '';
    let maxCount = 0;
    Object.entries(genreCounts).forEach(([g, c]) => {
        if (c > maxCount) {
            maxCount = c;
            topGenre = g;
        }
    });

    return {
        status: 'active',
        topGenre,
        completedCount,
        totalItems: library.length,
        avgScore: ratedCount > 0 ? totalScore / ratedCount : 0
    };
  }, [library]);

  useEffect(() => {
    const generateMessage = () => {
      const hour = new Date().getHours();
      let timeGreeting = "Hola";
      let TimeIcon = Sun;
      
      if (hour >= 5 && hour < 12) {
          timeGreeting = "Buenos días";
          TimeIcon = Coffee;
      } else if (hour >= 12 && hour < 20) {
          timeGreeting = "Buenas tardes";
          TimeIcon = Sun;
      } else {
          timeGreeting = "Buenas noches";
          TimeIcon = Moon;
      }

      const { username } = userProfile;

      // 1. EMPTY STATE
      if (contextData.status === 'empty') {
          setGreeting({ 
              text: `${timeGreeting}, ${username}. Tu biblioteca es un lienzo en blanco. ¿Qué descubriremos hoy?`,
              icon: Sparkles
          });
          return;
      }

      // 2. SPECIFIC GENRE MESSAGES (If user has a clear preference)
      // Check specific keywords in the top genre
      const genre = contextData.topGenre?.toLowerCase() || '';
      
      if (genre.includes('terror') || genre.includes('horror') || genre.includes('miedo')) {
          setGreeting({ 
              text: hour >= 20 
                ? `La oscuridad te llama, ${username}. ¿Listo para no dormir hoy?` 
                : `${timeGreeting}, ${username}. ¿Buscando más escalofríos para tu colección?`,
              icon: Skull
          });
          return;
      }

      if (genre.includes('romance') || genre.includes('romántico')) {
          setGreeting({ 
              text: `El amor está en el aire, ${username}. ¿Continuamos esa historia conmovedora?`,
              icon: Heart
          });
          return;
      }

      if (genre.includes('acción') || genre.includes('aventura') || genre.includes('shonen')) {
           setGreeting({ 
              text: `${timeGreeting}, ${username}. La adrenalina y la aventura te esperan.`,
              icon: Zap
          });
          return;
      }

      if (genre.includes('ciencia ficción') || genre.includes('sci-fi') || genre.includes('mecha')) {
           setGreeting({ 
              text: `Sistemas en línea, ${username}. El futuro (y tu biblioteca) aguardan.`,
              icon: Rocket
          });
          return;
      }
      
      if (genre.includes('fantasía') || genre.includes('isekai')) {
           setGreeting({ 
              text: `La magia fluye fuerte hoy, ${username}. ¿A qué mundo viajaremos?`,
              icon: Crown
          });
          return;
      }

      // 3. COMPLETIONIST STATE (High completion rate)
      // @ts-ignore
      if (contextData.completedCount > 5 && (contextData.completedCount / contextData.totalItems) > 0.7) {
           setGreeting({ 
              text: `Imparable, ${username}. Llevas ${contextData.completedCount} obras completadas. ¡A por la siguiente!`,
              icon: Crown
          });
          return;
      }

      // 4. FALLBACK / GENERAL
      const messages = [
          { text: `${timeGreeting}, ${username}. Tienes pendientes en tu lista. ¿Continuamos?`, icon: BookOpen },
          { text: `¡Qué bueno verte, ${username}! Tu colección personal te extrañaba.`, icon: Smile },
          { text: `${timeGreeting}, ${username}. Es un buen momento para desconectar y disfrutar una historia.`, icon: TimeIcon },
      ];

      // Pick random based on minute to stay semi-consistent but dynamic
      const index = new Date().getMinutes() % messages.length;
      setGreeting(messages[index]);
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
                     <p className="text-white md:text-lg font-medium leading-relaxed drop-shadow-md">
                        {greeting.text}
                     </p>
                     {contextData.status === 'active' && contextData.topGenre && (
                        <p className="text-white/60 text-xs mt-1 uppercase tracking-wider font-bold">
                            Mood Actual: {contextData.topGenre}
                        </p>
                     )}
                 </div>
             </div>
        </div>
    </div>
  );
};
