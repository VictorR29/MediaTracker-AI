import React from 'react';
import { Timer, X, Save } from 'lucide-react';
import { DurationPreferences } from './StatsData';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (durations: DurationPreferences) => void;
  durations: DurationPreferences;
  onDurationChange: (durations: DurationPreferences) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  durations,
  onDurationChange
}) => {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
    <div className="bg-[#111113] ring-1 ring-white/[0.06] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
      <div className="flex items-center justify-between p-4 ring-1 ring-white/[0.06] bg-[#18181B]">
        <h3 id="settings-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
          <Timer className="w-5 h-5 text-white" /> Configurar Tiempos
        </h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto bg-[#18181B]">
        <p className="text-sm text-zinc-400 mb-2">
          Ajusta la duración promedio (minutos) para calcular tus estadísticas de tiempo.
        </p>

        <div className="space-y-1">
          <label className="block text-[10px] font-extrabold text-zinc-400 uppercase" style={{ letterSpacing: '0.1em' }}>Visual</label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Episodio Anime</label>
              <input
                type="number" min="1" value={durations.animeEpisodeDuration}
                onChange={(e) => onDurationChange({ ...durations, animeEpisodeDuration: Number(e.target.value) })}
                className="w-full bg-[#1C1C1F] ring-1 ring-white/[0.08] rounded-xl px-4 py-3 text-white outline-none focus:ring-white/[0.20] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Episodio Serie</label>
              <input
                type="number" min="1" value={durations.seriesEpisodeDuration}
                onChange={(e) => onDurationChange({ ...durations, seriesEpisodeDuration: Number(e.target.value) })}
                className="w-full bg-[#1C1C1F] ring-1 ring-white/[0.08] rounded-xl px-4 py-3 text-white outline-none focus:ring-white/[0.20] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Película</label>
              <input
                type="number" min="1" value={durations.movieDuration}
                onChange={(e) => onDurationChange({ ...durations, movieDuration: Number(e.target.value) })}
                className="w-full bg-[#1C1C1F] ring-1 ring-white/[0.08] rounded-xl px-4 py-3 text-white outline-none focus:ring-white/[0.20] font-mono"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1 pt-2">
          <label className="block text-[10px] font-extrabold text-emerald-400 uppercase" style={{ letterSpacing: '0.1em' }}>Lectura</label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Cap. Manhwa/Manga</label>
              <input
                type="number" min="1" value={durations.mangaChapterDuration}
                onChange={(e) => onDurationChange({ ...durations, mangaChapterDuration: Number(e.target.value) })}
                className="w-full bg-[#1C1C1F] ring-1 ring-white/[0.08] rounded-xl px-4 py-3 text-white outline-none focus:ring-emerald-500/50 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Cap. Libro/Novela</label>
              <input
                type="number" min="1" value={durations.bookChapterDuration}
                onChange={(e) => onDurationChange({ ...durations, bookChapterDuration: Number(e.target.value) })}
                className="w-full bg-[#1C1C1F] ring-1 ring-white/[0.08] rounded-xl px-4 py-3 text-white outline-none focus:ring-emerald-500/50 font-mono"
              />
            </div>
          </div>
        </div>

        <button
          onClick={() => onSave(durations)}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 text-zinc-900 font-bold py-3 rounded-full transition-all shadow-lg mt-4 active:scale-[0.97]"
          style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
        >
          <Save className="w-4 h-4" /> Guardar Cambios
        </button>
      </div>
    </div>
    </div>
  );
};
