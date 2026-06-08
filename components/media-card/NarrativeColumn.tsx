import React from 'react';
import { AIWorkData, UserTrackingData } from '../../types';
import {
  PlayCircle, CheckCircle2, ChevronLeft, ChevronRight,
  RefreshCw, FileText, User, Minus, Plus,
  CalendarClock, Trophy, Medal, GripVertical, X,
} from 'lucide-react';

interface NarrativeColumnProps {
  aiData: AIWorkData;
  trackingData: UserTrackingData;
  isEditing: boolean;
  dynamicColor: string;
  dynamicRgb: string;
  username?: string;
  onInputChange: (field: keyof UserTrackingData, value: any, shouldSave?: boolean) => void;
  onAIDataChange: (field: keyof AIWorkData, value: any) => void;
  onSmartUpdate: () => void;
  isUpdatingInfo: boolean;
  onNextSeason: () => void;
  newCharacterInput: string;
  setNewCharacterInput: (val: string) => void;
  onAddCharacter: () => void;
  onCharDragStart: (e: React.DragEvent, position: number) => void;
  onCharDragEnter: (e: React.DragEvent, position: number) => void;
  onCharDrop: (e: React.DragEvent) => void;
  progressPercent: number;
  onRemoveCharacter: (index: number) => void;
}

const NarrativeColumnInner: React.FC<NarrativeColumnProps> = ({
  aiData, trackingData: tracking, isEditing, dynamicColor, dynamicRgb,
  username, onInputChange, onAIDataChange,
  onSmartUpdate, isUpdatingInfo, onNextSeason,
  newCharacterInput, setNewCharacterInput, onAddCharacter,
  onCharDragStart, onCharDragEnter, onCharDrop,
  progressPercent, onRemoveCharacter,
}) => {
  const isMovie = aiData.mediaType === 'Pelicula';
  const isReadingContent = ['Manhwa', 'Manga', 'Comic', 'Libro'].includes(aiData.mediaType);

  return (
    <div className="flex flex-col gap-6 xl:gap-10">
      {/* Synopsis */}
      <div className="bg-zinc-900/40 rounded-2xl p-6 xl:p-8 ring-1 ring-white/[0.04]" style={{ borderTop: `1px solid rgba(${dynamicRgb}, 0.15)`, boxShadow: `inset 0 1px 0 rgba(${dynamicRgb}, 0.08), 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` }}>
        <div className="flex items-center justify-between mb-4 xl:mb-6">
          <h3 className="text-xs xl:text-base font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-3" style={{ textShadow: `0 0 12px rgba(${dynamicRgb}, 0.10)` }}>
            <FileText className="w-4 h-4 xl:w-5 xl:h-5" /> Sinopsis
          </h3>
          <button onClick={onSmartUpdate} disabled={isUpdatingInfo} className="text-xs text-[rgb(var(--card-rgb))] flex items-center gap-2 font-bold hover:underline">
            <RefreshCw className={`w-3 h-3 xl:w-4 xl:h-4 ${isUpdatingInfo ? 'animate-spin' : ''}`} /> ACTUALIZAR CON IA
          </button>
        </div>
        {isEditing ? (
          <textarea
            value={aiData.synopsis}
            onChange={(e) => onAIDataChange('synopsis', e.target.value)}
            className="w-full h-56 bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-2xl p-5 text-zinc-300 text-sm xl:text-base outline-none focus:border-[rgb(var(--card-rgb))] leading-relaxed"
          />
        ) : (
          <p className="text-sm xl:text-base text-zinc-300 leading-relaxed whitespace-pre-line font-medium">
            {aiData.synopsis}
          </p>
        )}
      </div>

      {/* Progress Tracking */}
      <div className="bg-zinc-900/50 rounded-2xl p-6 xl:p-8 ring-1 ring-white/[0.04] relative overflow-hidden" style={{ borderTop: `1px solid rgba(${dynamicRgb}, 0.20)`, boxShadow: `inset 0 1px 0 rgba(${dynamicRgb}, 0.10), 0 25px 50px -12px rgb(0 0 0 / 0.25)` }}>
        <div className="absolute top-0 left-0 w-2 h-full bg-[rgb(var(--card-rgb))]" style={{ boxShadow: `0 0 12px rgba(${dynamicRgb}, 0.40)` }}></div>
        <div className="flex items-center justify-between mb-6 xl:mb-8">
          <h3 className="text-xs xl:text-base font-bold text-white uppercase tracking-widest flex items-center gap-3" style={{ textShadow: `0 0 15px rgba(${dynamicRgb}, 0.20)` }}>
            <CheckCircle2 className="w-4 h-4 xl:w-5 xl:h-5 text-[rgb(var(--card-rgb))]" /> Mi Progreso
          </h3>
          <div className="bg-[rgb(var(--card-rgb)/0.1)] text-[rgb(var(--card-rgb))] text-xs font-bold px-3 py-1 rounded-full border border-[rgb(var(--card-rgb)/0.2)]">
            ¡Victoria, {username || 'Vikthor'}!
          </div>
        </div>

        <div className="space-y-6 xl:space-y-8">
          {/* Status Select */}
          <div>
            <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 xl:mb-3">Estado de la Obra</span>
            <select
              value={tracking.status}
              onChange={(e) => onInputChange('status', e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 xl:px-5 xl:py-4 text-sm xl:text-base font-bold text-white outline-none focus:border-[rgb(var(--card-rgb))] appearance-none shadow-inner"
            >
              <option value="Sin empezar">Sin empezar</option>
              <option value="Viendo/Leyendo">Viendo/Leyendo</option>
              <option value="Completado">Completado</option>
              <option value="En Pausa">En Pausa</option>
              <option value="Descartado">Descartado</option>
              <option value="Planeado / Pendiente">Planeado / Pendiente</option>
            </select>
          </div>

          {/* Optional Date Picker for Planned/Upcoming */}
          {tracking.status === 'Planeado / Pendiente' && (
            <div className="bg-[rgb(var(--card-rgb)/0.2)] border border-[rgb(var(--card-rgb)/0.3)] rounded-2xl p-4 animate-fade-in">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[rgb(var(--card-rgb))]">
                  <CalendarClock className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wide">¿Cuándo se estrena / planeas verla?</span>
                </div>
                <input
                  type="date"
                  value={tracking.nextReleaseDate || ''}
                  onChange={(e) => onInputChange('nextReleaseDate', e.target.value)}
                  className="bg-zinc-900 ring-1 ring-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--card-rgb))]"
                />
              </div>
              <p className="text-xs text-[rgb(var(--card-rgb)/0.7)] mt-2 pl-1">
                Define una fecha para ver una cuenta regresiva en tu biblioteca.
              </p>
            </div>
          )}

          {/* Season & Episode Controls */}
          {!isMovie && (
            <div className="space-y-4 xl:space-y-6">
              <div className="grid grid-cols-2 gap-4 xl:gap-6">
                <div className="flex-1">
<span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 xl:mb-3">
                  {isReadingContent ? 'Volumen Actual' : 'Temporada Actual'}
                  </span>
                  <div className="relative">
                    <button
                      onClick={() => onInputChange('currentSeason', Math.max(1, tracking.currentSeason - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-white"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <input
                      type="number" min={1} max={tracking.totalSeasons}
                      value={tracking.currentSeason}
                      onChange={(e) => {
                        let val = parseInt(e.target.value) || 1;
                        if (tracking.totalSeasons > 0 && val > tracking.totalSeasons) val = tracking.totalSeasons;
                        onInputChange('currentSeason', val);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 xl:py-4 text-center text-base xl:text-lg font-bold text-white outline-none"
                    />
                    <button
                      onClick={() => onInputChange('currentSeason', tracking.totalSeasons > 0 ? Math.min(tracking.totalSeasons, tracking.currentSeason + 1) : tracking.currentSeason + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-white"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1">
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 xl:mb-3">Total {isReadingContent ? 'Vols' : 'Temps'}</span>
                  <input
                    type="number"
                    value={tracking.totalSeasons}
                    onChange={(e) => onInputChange('totalSeasons', parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 xl:py-4 text-center text-base xl:text-lg font-bold text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 xl:gap-6">
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 xl:mb-3">Capítulos Vistos</span>
                  <div className="relative">
                    <button
                      onClick={() => onInputChange('watchedEpisodes', Math.max(0, tracking.watchedEpisodes - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-white"
                    >
                      <Minus className="w-3 h-3 xl:w-4 xl:h-4" />
                    </button>
                    <input
                      type="number" min={0} max={tracking.totalEpisodesInSeason}
                      value={tracking.watchedEpisodes}
                      onChange={(e) => {
                        let val = parseInt(e.target.value) || 0;
                        if (tracking.totalEpisodesInSeason > 0 && val > tracking.totalEpisodesInSeason) val = tracking.totalEpisodesInSeason;
                        onInputChange('watchedEpisodes', val);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 xl:py-4 text-center text-base xl:text-lg font-bold text-white outline-none"
                    />
                    <button
                      onClick={() => onInputChange('watchedEpisodes', tracking.totalEpisodesInSeason > 0 ? Math.min(tracking.totalEpisodesInSeason, tracking.watchedEpisodes + 1) : tracking.watchedEpisodes + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-white"
                    >
                      <Plus className="w-3 h-3 xl:w-4 xl:h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 xl:mb-3">Total Capítulos</span>
                  <input
                    type="number"
                    value={tracking.totalEpisodesInSeason}
                    onChange={(e) => onInputChange('totalEpisodesInSeason', parseInt(e.target.value) || 0)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 xl:py-4 text-center text-base xl:text-lg font-bold text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 xl:mb-3">
                  <span>Progreso T.{tracking.currentSeason}</span>
                  <span>{progressPercent.toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full transition-all duration-700"
                    style={{
                      width: `${progressPercent}%`,
                      background: `linear-gradient(to right, rgb(var(--card-rgb)), rgba(var(--card-rgb), 0.6))`,
                      boxShadow: `0 0 15px rgba(var(--card-rgb), 0.4)`
                    }}
                  />
                </div>

                {/* Complete Season/Series Button */}
                {tracking.totalEpisodesInSeason > 0 && tracking.watchedEpisodes >= tracking.totalEpisodesInSeason && (
                  <button
                    onClick={onNextSeason}
                    className="mt-4 w-full py-3 hover:opacity-90 text-white rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all animate-fade-in"
                    style={{ backgroundColor: `rgb(var(--card-rgb))`, boxShadow: `0 10px 15px -3px rgba(var(--card-rgb), 0.2)` }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {tracking.currentSeason < tracking.totalSeasons ? `Completar Temporada ${tracking.currentSeason}` : 'Completar Obra'}
                  </button>
                )}
              </div>
            </div>
          )}

          {isMovie && (
            <button
              onClick={() => onInputChange('status', tracking.status === 'Completado' ? 'Sin empezar' : 'Completado')}
              className={`w-full py-4 xl:py-5 rounded-[1.25rem] font-black text-sm xl:text-base flex items-center justify-center gap-4 transition-all border-2 ${tracking.status === 'Completado' ? 'bg-green-500/10 border-green-500/50 text-green-500 shadow-lg shadow-green-500/10' : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'}`}
            >
              {tracking.status === 'Completado' ? <CheckCircle2 className="w-5 h-5 xl:w-6 xl:h-6" /> : <PlayCircle className="w-5 h-5 xl:w-6 xl:h-6" />}
              {tracking.status === 'Completado' ? 'COMPLETADO' : 'MARCAR COMO VISTO'}
            </button>
          )}
        </div>
      </div>

      {/* Personajes Destacados */}
      <div className="bg-zinc-900/40 rounded-2xl p-6 xl:p-8 ring-1 ring-white/[0.04]" style={{ borderTop: `1px solid rgba(${dynamicRgb}, 0.15)`, boxShadow: `inset 0 1px 0 rgba(${dynamicRgb}, 0.08)` }}>
        <h3 className="text-xs xl:text-base font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-3 mb-4 xl:mb-6" style={{ textShadow: `0 0 12px rgba(${dynamicRgb}, 0.10)` }}>
          <User className="w-4 h-4 xl:w-5 xl:h-5" /> Personajes Destacados
        </h3>

        {/* Character Tags List with Drag & Drop */}
        <div className="flex flex-wrap gap-2 xl:gap-3 mb-4 xl:mb-6">
          {(tracking.favoriteCharacters || []).map((char, idx) => {
            let rankStyle = "bg-zinc-800 ring-1 ring-zinc-600 text-zinc-300";
            let icon = null;

            if (idx === 0) {
              rankStyle = "bg-yellow-500/10 border-yellow-500 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]";
              icon = <Trophy className="w-3.5 h-3.5" />;
            } else if (idx === 1) {
              rankStyle = "bg-zinc-300/10 border-zinc-400 text-zinc-300 shadow-[0_0_10px_rgba(203,213,225,0.1)]";
              icon = <Medal className="w-3.5 h-3.5" />;
            } else if (idx === 2) {
              rankStyle = "bg-orange-700/10 border-orange-700 text-orange-600 shadow-[0_0_10px_rgba(194,65,12,0.1)]";
              icon = <Medal className="w-3.5 h-3.5" />;
            } else if (idx < 5) {
              rankStyle = `bg-[rgb(var(--card-rgb)/0.1)] border-[rgb(var(--card-rgb)/0.5)] text-[rgb(var(--card-rgb))]`;
            }

            return (
              <div
                key={idx}
                className={`relative group flex items-center gap-2 px-3 py-2 xl:px-4 xl:py-2.5 rounded-xl border text-xs xl:text-sm font-bold transition-all cursor-move select-none active:scale-95 ${rankStyle}`}
                draggable
                onDragStart={(e) => onCharDragStart(e, idx)}
                onDragEnter={(e) => onCharDragEnter(e, idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onCharDrop}
              >
                <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                {icon}
                <span>{char}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveCharacter(idx); }}
                  className="ml-1 hover:text-white hover:bg-white/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 xl:gap-3">
          <input
            placeholder="Añadir nombre de personaje..."
            value={newCharacterInput}
            onChange={(e) => setNewCharacterInput(e.target.value)}
            className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-2.5 xl:px-5 xl:py-3 text-sm text-white outline-none focus:border-[rgb(var(--card-rgb))]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onAddCharacter();
              }
            }}
          />
          <button
            onClick={onAddCharacter}
            className="p-2.5 xl:p-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-all shadow-lg shadow-orange-600/20"
          >
            <Plus className="w-5 h-5 xl:w-6 xl:h-6" />
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-2 italic pl-2">
Arrastra los nombres para cambiar su posición. Los 5 primeros aparecerán destacados.
        </p>
      </div>
      </div>
    );
};

export const NarrativeColumn = React.memo(NarrativeColumnInner);
