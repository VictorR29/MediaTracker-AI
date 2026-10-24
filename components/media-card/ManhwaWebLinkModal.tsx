import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageOff, X } from 'lucide-react';
import type { MediaItem } from '../../types';
import type { ManhwaWebCandidate } from '../../services/manhwawebService';
import {
  applyManhwaWebLink,
  fetchManhwaWebDetail,
  searchManhwaWeb,
} from '../../services/manhwawebService';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ManhwaWebLinkModalProps {
  isOpen: boolean;
  item: MediaItem;
  onClose: () => void;
  onSelect: (linkedItem: MediaItem) => void;
}

const TITLE_ID = 'manhwaweb-link-modal-title';

const CHIP_BASE_CLASS =
  'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ring-1';

const statusChip = (status: string | undefined): React.ReactNode => {
  if (!status) return null;
  return (
    <span className={`${CHIP_BASE_CLASS} bg-zinc-800/80 text-zinc-400 ring-white/[0.06]`}>
      {status}
    </span>
  );
};

const isPositiveFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const ManhwaWebLinkModal: React.FC<ManhwaWebLinkModalProps> = ({
  isOpen,
  item,
  onClose,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ManhwaWebCandidate[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [linkingSlug, setLinkingSlug] = useState<string | null>(null);
  const [linkFailed, setLinkFailed] = useState(false);

  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Only an explicit submit (or the automatic search on open) hits the service:
  // ManhwaWeb is a third party, so typing must never spam it.
  const runSearch = useCallback(async (raw: string) => {
    const search = raw.trim();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setSearchFailed(false);
    setLinkFailed(false);

    if (!search) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      const candidates = await searchManhwaWeb(search);
      if (requestIdRef.current !== requestId) return;
      setResults(candidates);
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      console.error('Failed to search ManhwaWeb candidates', error);
      setResults(null);
      setSearchFailed(true);
    } finally {
      if (requestIdRef.current === requestId) setIsSearching(false);
    }
  }, []);

  // Search once per open, prefilled with the local title.
  useEffect(() => {
    if (!isOpen) return;

    const initialQuery = item.aiData.title;
    setQuery(initialQuery);
    setResults(null);
    setSearchFailed(false);
    setLinkFailed(false);
    setLinkingSlug(null);
    void runSearch(initialQuery);
  }, [isOpen, item.id, runSearch]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(query);
  };

  const handleSelect = async (candidate: ManhwaWebCandidate) => {
    if (linkingSlug !== null) return;

    setLinkingSlug(candidate.slug);
    setLinkFailed(false);

    try {
      const detail = await fetchManhwaWebDetail(candidate.slug);
      onSelect(applyManhwaWebLink(item, detail));
      onClose();
    } catch (error) {
      console.error('Failed to link the ManhwaWeb candidate', error);
      setLinkFailed(true);
    } finally {
      setLinkingSlug(null);
    }
  };

  if (!isOpen) return null;

  const isBusy = linkingSlug !== null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onClick={(event) => event.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col bg-[#09090B] ring-1 ring-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 ring-1 ring-white/[0.06] bg-[#18181B]">
          <h2 id={TITLE_ID} className="text-sm font-bold text-white uppercase tracking-wider">
            Vincular con ManhwaWeb
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="min-w-[44px] min-h-[44px] -my-2 -mr-2 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 px-4 pt-3">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar en ManhwaWeb"
            placeholder="Título en ManhwaWeb"
            className="flex-1 min-w-0 min-h-[44px] bg-zinc-900/50 ring-1 ring-white/10 rounded-xl px-3 text-sm text-white outline-none focus:ring-white/20 placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={isSearching || isBusy}
            className="min-w-[44px] min-h-[44px] px-4 bg-white text-zinc-900 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            Buscar
          </button>
        </form>

        <p className="px-4 pb-2 pt-2 text-[10px] text-zinc-600">
          Fuente externa no oficial. Solo se guarda el enlace en tu biblioteca.
        </p>

        <div className="px-4 pb-4 overflow-y-auto max-h-[60vh]" aria-busy={isBusy}>
          {isSearching && (
            <p className="text-xs text-zinc-500 animate-pulse py-4">Buscando…</p>
          )}

          {!isSearching && searchFailed && (
            <div className="flex items-center justify-between gap-3 py-4">
              <span className="text-xs text-zinc-500">No se pudo consultar ManhwaWeb</span>
              <button
                type="button"
                onClick={() => void runSearch(query)}
                className="min-w-[44px] min-h-[44px] -my-2 -mr-2 px-2 inline-flex items-center justify-end text-xs font-bold text-zinc-400 hover:text-white transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {!isSearching && !searchFailed && results !== null && results.length === 0 && (
            <p className="text-xs text-zinc-500 py-4">
              No encontramos esa obra en ManhwaWeb. Probá con otro título.
            </p>
          )}

          {!isSearching && !searchFailed && results !== null && results.length > 0 && (
            <ul className={`space-y-2 ${isBusy ? 'pointer-events-none opacity-60' : ''}`}>
              {results.map((candidate) => {
                const isLinking = candidate.slug === linkingSlug;
                const meta = isPositiveFinite(candidate.chapters)
                  ? `${candidate.chapters} caps`
                  : undefined;

                return (
                  <li key={candidate.slug}>
                    <button
                      type="button"
                      onClick={() => void handleSelect(candidate)}
                      disabled={isBusy}
                      aria-label={`Vincular con ${candidate.title}`}
                      className="w-full min-h-[44px] flex items-start gap-3 p-2.5 text-left rounded-xl bg-zinc-900/50 ring-1 transition-colors ring-white/[0.06] hover:bg-zinc-800/70"
                    >
                      {candidate.coverImage ? (
                        <img
                          src={candidate.coverImage}
                          alt=""
                          className="w-10 h-14 object-cover rounded shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-14 rounded bg-zinc-800 flex items-center justify-center shrink-0">
                          <ImageOff className="w-4 h-4 text-zinc-600" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">{candidate.title}</span>
                          {isLinking && (
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                              Vinculando…
                            </span>
                          )}
                        </div>

                        {candidate.spanishTitle && (
                          <p className="text-xs text-zinc-500 truncate">{candidate.spanishTitle}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5">
                          {meta && <span className="text-[10px] text-zinc-500">{meta}</span>}
                          {statusChip(candidate.status)}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {linkFailed && (
            <p className="text-xs text-red-400 pt-3">
              No se pudo vincular con ManhwaWeb. Probá de nuevo.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
