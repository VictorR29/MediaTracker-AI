import React from 'react';
import { Save } from 'lucide-react';

interface EditActionBarProps {
  onSave: () => void;
  onCancel: () => void;
}

export const EditActionBar: React.FC<EditActionBarProps> = ({ onSave, onCancel }) => {
  return (
    <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-xl flex gap-3 sticky bottom-0 z-40 justify-end">
      <button onClick={onSave} className="flex-1 md:flex-none md:w-auto px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 transition-all text-sm tracking-wide">
        <Save className="w-5 h-5" /> GUARDAR TODO
      </button>
      <button onClick={onCancel} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-all border border-zinc-700 text-sm">
        CANCELAR
      </button>
    </div>
  );
};
