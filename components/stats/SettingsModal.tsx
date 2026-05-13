import React from 'react';
import { Timer, X, Save } from 'lucide-react';
import { DurationPreferences } from './StatsData';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Timer className="w-5 h-5 text-primary" /> Configurar Tiempos
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <p className="text-sm text-slate-400 mb-2">
            Ajusta la duración promedio (minutos) para calcular tus estadísticas de tiempo.
          </p>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider">Visual</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Episodio Anime</label>
                <input
                  type="number" min="1" value={durations.animeEpisodeDuration}
                  onChange={(e) => onDurationChange({ ...durations, animeEpisodeDuration: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Episodio Serie</label>
                <input
                  type="number" min="1" value={durations.seriesEpisodeDuration}
                  onChange={(e) => onDurationChange({ ...durations, seriesEpisodeDuration: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Película</label>
                <input
                  type="number" min="1" value={durations.movieDuration}
                  onChange={(e) => onDurationChange({ ...durations, movieDuration: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1 pt-2">
            <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider">Lectura</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cap. Manhwa/Manga</label>
                <input
                  type="number" min="1" value={durations.mangaChapterDuration}
                  onChange={(e) => onDurationChange({ ...durations, mangaChapterDuration: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cap. Libro/Novela</label>
                <input
                  type="number" min="1" value={durations.bookChapterDuration}
                  onChange={(e) => onDurationChange({ ...durations, bookChapterDuration: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => onSave(durations)}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg mt-4"
          >
            <Save className="w-4 h-4" /> Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
