import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link as LinkIcon, Upload, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface CharacterImageModalProps {
  /**
   * The character being edited, or null when the dialog is closed. The name is
   * the identity that reaches the write: two works can share a character name,
   * and one work can hold several characters.
   */
  characterName: string | null;
  /** The work the character belongs to, shown for context. */
  workTitle?: string;
  onClose: () => void;
  /** Handed a trimmed, non-empty URL. The caller closes the dialog on success. */
  onSaveUrl: (url: string) => void;
  /** Opens the OS file picker. The dialog closes itself right after. */
  onPickFile: () => void;
}

/**
 * Character photo editor, shared by the characters collection and the stats
 * carousel. They carried two near-identical copies of this dialog, each with its
 * own draft state, focus trap and Escape handling.
 *
 * The draft URL lives here rather than in the parents: it is pure dialog state,
 * and keeping it local means a half-typed URL cannot survive into the next
 * character's dialog.
 */
export const CharacterImageModal: React.FC<CharacterImageModalProps> = ({
  characterName,
  workTitle,
  onClose,
  onSaveUrl,
  onPickFile,
}) => {
  const isOpen = characterName !== null;
  const [url, setUrl] = useState('');
  const titleId = useId();
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

  // A new character starts with an empty field, not with the previous answer.
  useEffect(() => {
    setUrl('');
  }, [characterName]);

  if (characterName === null) return null;

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (trimmed) onSaveUrl(trimmed);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-[#1C1C1F] rounded-2xl p-6 w-full max-w-sm ring-1 ring-white/10 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-bold text-white">Imagen del Personaje</h3>
            <p className="text-xs text-zinc-400 truncate mt-0.5">
              {characterName}
              {workTitle ? ` · ${workTitle}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            // Opened first, then closed: the caller needs the character still
            // selected to know which card to upload onto.
            onPickFile();
            onClose();
          }}
          className="w-full flex items-center gap-3 p-4 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl ring-1 ring-white/[0.08] transition-colors mb-3"
        >
          <div className="p-2 bg-violet-500/20 rounded-lg">
            <Upload className="w-5 h-5 text-violet-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">Subir archivo</p>
            <p className="text-xs text-zinc-400">JPG, PNG, GIF</p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="https://..."
              aria-label="URL de la imagen"
              className="w-full bg-zinc-900 ring-1 ring-white/[0.06] rounded-xl pl-9 pr-4 py-3 text-sm text-white outline-none focus:ring-white/20 placeholder:text-zinc-600"
            />
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!url.trim()}
            className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl font-medium transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
