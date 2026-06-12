import React, { useState, useCallback } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { MediaItem } from '../types';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useToast } from '../context/ToastContext';
import { useFocusTrap } from './useFocusTrap';

interface DeleteConfirmState {
  itemToDelete: MediaItem | null;
  pendingDeleteId: string | null;
  requestDelete: (item: MediaItem) => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
  DeleteModal: React.FC;
}

export const useDeleteConfirm = (onAfterDelete?: () => void): DeleteConfirmState => {
  const [itemToDelete, setItemToDelete] = useState<MediaItem | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { showToast } = useToast();

  const requestDelete = useCallback((item: MediaItem) => {
    setItemToDelete(item);
  }, []);

  const cancelDelete = useCallback(() => {
    setItemToDelete(null);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!itemToDelete) return;
    // Close modal immediately, start exit animation
    const id = itemToDelete.id;
    setItemToDelete(null);
    setPendingDeleteId(id);
    // Remove from store after animation completes (250ms matches deleteExit keyframe)
    setTimeout(async () => {
      try {
        await useLibraryStore.getState().removeItem(id);
        showToast("Obra eliminada permanentemente", "info");
        onAfterDelete?.();
      } catch (e) {
        showToast("Error al eliminar", "error");
      } finally {
        setPendingDeleteId(null);
      }
    }, 260);
  }, [itemToDelete, showToast, onAfterDelete]);

  const DeleteModal: React.FC = () => {
    const modalRef = useFocusTrap<HTMLDivElement>(!!itemToDelete, cancelDelete);
    if (!itemToDelete) return null;
    return (
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="delete-modal-title" className="fixed inset-0 z-[100] bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-[#111113] ring-1 ring-white/[0.06] rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-fade-in-up">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h3 id="delete-modal-title" className="text-xl font-bold text-white mb-2">¿Eliminar Obra?</h3>
          <p className="text-sm text-zinc-400 mb-6">
            Estás a punto de borrar <span className="text-white font-bold">"{itemToDelete.aiData.title}"</span>.
            <br />Esta acción es irreversible y perderás todo tu progreso.
          </p>
          <div className="flex gap-3">
            <button
              onClick={cancelDelete}
              className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-all ring-1 ring-white/[0.06]"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return { itemToDelete, pendingDeleteId, requestDelete, confirmDelete, cancelDelete, DeleteModal };
};
