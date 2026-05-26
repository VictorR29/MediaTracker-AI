import React, { useMemo } from 'react';
import { Crown, Trophy, Award, Medal, Scroll } from 'lucide-react';
import { StatsData } from './StatsData';

export interface RankingBannerProps {
  stats: StatsData;
}

export const RankingBanner: React.FC<RankingBannerProps> = ({ stats }) => {
  const rankingSystem = useMemo(() => {
    const points = stats.totalConsumptionUnits;

    // Rank Definitions
    let rankTitle = "Explorador Novato";
    let rankColor = "text-zinc-400";
    let RankIcon = Scroll;

    if (points > 1500) {
      rankTitle = "Maestro del Consumo";
      rankColor = "text-amber-400";
      RankIcon = Crown;
    } else if (points > 750) {
      rankTitle = "Historiador de Medios";
      rankColor = "text-purple-400";
      RankIcon = Trophy;
    } else if (points > 250) {
      rankTitle = "Coleccionista Dedicado";
      rankColor = "text-emerald-400";
      RankIcon = Award;
    } else if (points > 50) {
      rankTitle = "Aprendiz de Coleccionista";
      rankColor = "text-blue-400";
      RankIcon = Medal;
    }

    // --- Template Banks ---

    // Banco A: Foco en Tiempo (Visual vs Lectura)
    const BANK_A_TIME = [
      "Has pasado [Tiempo Visual Total] en pantallas, ¡pero no olvides que tu mente ha estado sumergida [Tiempo Lectura Total] en historias!",
      "Si sumamos todo, tu vida es arte: [Tiempo Visual Total] de cine/series y [Tiempo Lectura Total] de literatura.",
      "Tu reloj biológico marca [Tiempo Visual Total] en modo espectador y [Tiempo Lectura Total] en modo lector.",
      "Inversión de vida: [Tiempo Visual Total] viendo tramas épicas y [Tiempo Lectura Total] leyéndolas.",
      "Entre [Tiempo Visual Total] de maratones y [Tiempo Lectura Total] de lectura, eres un verdadero fan.",
      "El equilibrio es la clave: has dedicado [Tiempo Visual Total] al medio audiovisual y [Tiempo Lectura Total] al texto."
    ];

    // Banco B: Foco en Cantidad y Contraste
    const BANK_B_QUANTITY = [
      "¡Has conquistado [Total Animes] animes completos! ¿Y quién diría que has devorado [Total Capítulos de Manhwa] capítulos de manhwa?",
      "Tu lista de [Total Libros] leídos demuestra que valoras las historias largas tanto como las series cortas ([Total Series] series vistas).",
      "Desde [Total Peliculas] películas hasta [Total Manhwa] obras gráficas. Tu rango de gustos es envidiable.",
      "Has leído [Total Capítulos de Manhwa] capítulos. ¡Eso compite ferozmente con tus [Total Animes] animes vistos!",
      "La suma de [Total Series] series y [Total Libros] libros crea una base de datos narrativa en tu cabeza.",
      "Pocos pueden decir que han visto [Total Peliculas] películas y leído [Total Capítulos de Libros] capítulos de libros."
    ];

    // Banco C: Foco en Consumo Total y Rango Actual
    const BANK_C_RANK = [
      "Como [Rango Actual del Usuario], has acumulado [Tiempo Visual Total] invirtiendo en historias. ¡Mantén esa racha!",
      "Tu récord de [Total Capítulos de Manhwa] leídos te hace un experto. ¡Usa esa experiencia para honrar tu rango de [Rango Actual del Usuario]!",
      "Llevas con orgullo el título de [Rango Actual del Usuario]. Tus [Total Animes] animes completados lo demuestran.",
      "Un [Rango Actual del Usuario] no se hace en un día. [Tiempo Lectura Total] de dedicación te respaldan.",
      "Honor a quien honor merece: [Rango Actual del Usuario]. Más de [Total Consumption Units] unidades de historia consumidas.",
      "Tu estatus de [Rango Actual del Usuario] se forjó con [Total Series] series y [Total Libros] libros."
    ];

    // Rotation Logic: Select Bank randomly
    const banks = [BANK_A_TIME, BANK_B_QUANTITY, BANK_C_RANK];
    const selectedBank = banks[Math.floor(Math.random() * banks.length)];

    // Select Template randomly from chosen bank
    const rawTemplate = selectedBank[Math.floor(Math.random() * selectedBank.length)];

    // Replacer Function for all placeholders
    const processedMessage = rawTemplate
      .replace(/\[Total Animes\]/g, String(stats.consumedAnimes))
      .replace(/\[Total Series\]/g, String(stats.consumedSeries))
      .replace(/\[Total Peliculas\]/g, String(stats.consumedMovies))
      .replace(/\[Total Capítulos de Manhwa\]/g, String(stats.readingChapters))
      .replace(/\[Total Manhwa\]/g, String(stats.consumedManhwas))
      .replace(/\[Total Capítulos de Libros\]/g, String(stats.bookChapters))
      .replace(/\[Total Libros\]/g, String(stats.consumedBooks))
      .replace(/\[Tiempo Visual Total\]/g, stats.visualTimeDisplay)
      .replace(/\[Tiempo Lectura Total\]/g, stats.readingTimeDisplay)
      .replace(/\[Total Consumption Units\]/g, String(stats.totalConsumptionUnits))
      .replace(/\[Rango Actual del Usuario\]/g, rankTitle);

    return { rankTitle, rankColor, RankIcon, message: processedMessage };
  }, [stats]);

  if (stats.totalConsumptionUnits <= 0) return null;

  return (
  <div
    className="w-full bg-[#111113] ring-1 ring-white/[0.06] p-1 rounded-2xl text-center relative overflow-hidden transition-all duration-500"
  >
    {/* Decorative Elements */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 opacity-50 pointer-events-none"></div>
    <div className="absolute top-2 left-2 text-zinc-700 opacity-20 pointer-events-none"><rankingSystem.RankIcon className="w-12 h-12 md:w-16 md:h-16" /></div>
    <div className="absolute bottom-2 right-2 text-zinc-700 opacity-20 pointer-events-none"><rankingSystem.RankIcon className="w-12 h-12 md:w-16 md:h-16" /></div>

    <div className="relative z-10 max-w-2xl mx-auto bg-[#18181B] rounded-[calc(1rem-0.25rem)] p-6 md:p-8">
    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1C1C1F] ring-1 ring-white/[0.08] shadow-xl mb-4 ${rankingSystem.rankColor}`}>
      <rankingSystem.RankIcon className="w-4 h-4" />
      <span className="text-xs font-bold uppercase tracking-widest">{rankingSystem.rankTitle}</span>
    </div>
    <h2 className="text-xl md:text-2xl font-bold text-zinc-200 mb-3 leading-tight italic break-words">
      "{rankingSystem.message}"
    </h2>
    <div className="w-full bg-white/10 h-1.5 rounded-full mt-4 overflow-hidden max-w-xs mx-auto">
      <div
        className="h-full bg-white/60 rounded-full transition-all duration-1000"
        style={{ width: `${Math.min(100, (stats.totalConsumptionUnits % 250) / 2.5)}%` }}
      />
    </div>
    <p className="text-zinc-500 text-[10px] mt-2 font-mono" style={{ letterSpacing: '0.02em' }}>
      Unidades Consumidas: {stats.totalConsumptionUnits}
    </p>
    </div>
  </div>
  );
};
