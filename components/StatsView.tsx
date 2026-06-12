import React, { useState } from 'react';
import { MediaItem, UserProfile } from '../types';
import { BarChart2, Settings, Layers, Trophy, Zap, Hash } from 'lucide-react';
import { useStatsComputations } from './stats/useStatsComputations';
import { DurationPreferences } from './stats/StatsData';
import { PersonalRecap } from './stats/PersonalRecap';
import { ObsessionTracker } from './stats/ObsessionTracker';
import { ConsumptionDistribution } from './stats/ConsumptionDistribution';
import { StatCard } from './stats/StatCard';
import { ChartsRow } from './stats/ChartsRow';
import { RankingBanner } from './stats/RankingBanner';
import { EmotionalRadar } from './stats/EmotionalRadar';
import { TopCharacters } from './stats/TopCharacters';
import { SettingsModal } from './stats/SettingsModal';

interface StatsViewProps {
  library: MediaItem[];
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({ library, userProfile, onUpdateProfile }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [durations, setDurations] = useState<DurationPreferences>({
    animeEpisodeDuration: userProfile.preferences?.animeEpisodeDuration || 24,
    seriesEpisodeDuration: userProfile.preferences?.seriesEpisodeDuration || 45,
    movieDuration: userProfile.preferences?.movieDuration || 90,
    mangaChapterDuration: userProfile.preferences?.mangaChapterDuration || 3,
    bookChapterDuration: userProfile.preferences?.bookChapterDuration || 15,
  });

  const stats = useStatsComputations(library, durations);

  const saveSettings = (newDurations: DurationPreferences) => {
    setDurations(newDurations);
    onUpdateProfile({
      ...userProfile,
      preferences: newDurations
    });
    setIsSettingsOpen(false);
  };

  return (
    <div className="animate-fade-in space-y-4 md:space-y-6 pb-12 w-full max-w-[100vw] overflow-x-hidden">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 bg-[#111113] rounded-lg ring-1 ring-white/[0.06] flex-shrink-0">
          <BarChart2 className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-[-0.02em] truncate">Mis Insights</h2>
      </div>
      <button
        onClick={() => setIsSettingsOpen(true)}
        className="p-2 text-zinc-400 hover:text-white bg-[#1C1C1F] hover:bg-white/[0.08] rounded-lg ring-1 ring-white/[0.06] transition-all duration-150 flex items-center gap-2 text-xs font-medium flex-shrink-0 active:scale-[0.97]"
        style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        <Settings className="w-4 h-4" />
        <span className="hidden sm:inline">Configurar</span>
      </button>
      </div>

      {/* 1. HERO — Ranking Banner */}
      <RankingBanner stats={stats} />

      {/* 2. RESUMEN — KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          title="Total Obras"
          value={stats.total}
          icon={Layers}
          color={{ bg: 'bg-blue-500', text: 'text-blue-500' }}
          accentColor="#3b82f6"
        />
        <StatCard
          title="Completados"
          value={stats.completed}
          subtext={`${Math.round((stats.completed / (stats.total || 1)) * 100)}% del total`}
          icon={Trophy}
          color={{ bg: 'bg-green-500', text: 'text-green-500' }}
          accentColor="#22c55e"
        />
        <StatCard
          title="Calificación Prom."
          value={stats.averageScore === "N/A" ? "-" : stats.averageScore}
          subtext={stats.averageScore === "N/A" ? "" : stats.averageLabel}
          icon={Zap}
          color={{ bg: 'bg-yellow-500', text: 'text-yellow-500' }}
          accentColor="#eab308"
        />
        <StatCard
          title="Género Más Común"
          value={stats.topGenre}
          subtext={`En ${stats.maxGenreCount} obras (${Math.round((stats.maxGenreCount / (stats.total || 1)) * 100)}%)`}
          icon={Hash}
          color={{ bg: 'bg-purple-500', text: 'text-purple-500' }}
          accentColor="#a855f7"
        />
      </div>

      {/* 3. TIEMPO — Personal Recap */}
      <PersonalRecap stats={stats} />

      {/* 4. OBSESIONES — Top 3 */}
      <ObsessionTracker stats={stats} />

      {/* 5. TU PERFIL — Distribución + Radar + Gráficos + Personajes */}
      <div className="space-y-4 md:space-y-6">
        <ConsumptionDistribution stats={stats} />
        <EmotionalRadar stats={stats} />
        <TopCharacters library={library} />
        <ChartsRow stats={stats} />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={saveSettings}
        durations={durations}
        onDurationChange={setDurations}
      />
    </div>
  );
};
