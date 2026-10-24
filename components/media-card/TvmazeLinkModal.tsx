import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageOff, X } from 'lucide-react';
import type { MediaItem } from '../../types';
import type { TvmazeMatch } from '../../services/tvmazeService';
import { applyTvmazeMetadata, fetchTvmazeShow, searchTvmazeShow } from '../../services/tvmazeService';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface TvmazeLinkModalProps {
  isOpen: boolean;
  item: MediaItem;
  onClose: () => void;
  onSelect: (linkedItem: MediaItem) => void;
}

const TITLE_ID = 'tvmaze-link-modal-title';

/** "Spanish · 2016 · En emisión", dropping whatever the show does not carry. */
const candidateMeta = (candidate: TvmazeMatch): string => {
  const year = candidate.premiered?.trim().slice(0, 4);
  return [candidate.language, year, candidate.status]
    .filter((part): part is string => !!part)
    .join(' · ');
};

export const TvmazeLinkModal: React.FC<TvmazeLinkModalProps> = ({
  isOpen,
  item,
  onClose,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<TvmazeMatch | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [linkingId, setLinkingId] = useState<number | null>(null);
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
  // typing must never spam the throttled TVmaze queue.
  const runSearch = useCallback(async (raw: string) => {
    const search = raw.trim();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setSearchFailed(false);
    setLinkFailed(false);

    if (!search) {
      setResult(null);
      setHasSearched(true);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      const match = await searchTvmazeShow(search);
      if (requestIdRef.current !== requestId) return;
      setResult(match);
      setHasSearched(true);
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      console.error('Failed to search TVmaze candidates', error);
      setResult(null);
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
    setResult(null);
    setHasSearched(false);
    setSearchFailed(false);
    setLinkFailed(false);
    setLinkingId(null);
    void runSearch(initialQuery);
  }, [isOpen, item.id, runSearch]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(query);
  };

  const handleSelect = async (candidate: TvmazeMatch) => {
    if (linkingId !== null) return;

    setLinkingId(candidate.id);
    setLinkFailed(false);

    try {
      // The detail carries real episode counts. A failure keeps the search match,
      // which already holds identity, cover, status and dates.
      const detail = await fetchTvmazeShow(candidate.id).catch(() => null);

      // `overwrite: true` is deliberate: a manual link is the user asking for
      // the correct structure, so an invented `totalContent` is replaced.
      onSelect({
        ...item,
        aiData: applyTvmazeMetadata(item.aiData, detail ?? candidate, { overwrite: true }),
      });
      onClose();
    } catch (error) {
      console.error('Failed to link the TVmaze candidate', error);
      setLinkFailed(true);
    } finally {
      setLinkingId(null);
    }
  };

  if (!isOpen) return null;

  const linkedId = item.aiData.tvmaze?.id;
  const isBusy = linkingId !== null;

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
            Vincular con TVmaze
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

        <form onSubmit={handleSubmit} className="flex gap-2 px-4 pt-3 pb-1.5">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar en TVmaze"
            placeholder="Título en TVmaze"
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

        <p className="px-4 pb-3 text-[11px] text-zinc-600">
          Metadata de TVmaze (CC BY-SA). Solo se guardan datos de la obra en tu biblioteca.
        </p>

        <div className="px-4 pb-4 overflow-y-auto max-h-[60vh]" aria-busy={isBusy}>
          {isSearching && (
            <p className="text-xs text-zinc-500 animate-pulse py-4">Buscando…</p>
          )}

          {!isSearching && searchFailed && (
            <div className="flex items-center justify-between gap-3 py-4">
              <span className="text-xs text-zinc-500">No se pudo consultar TVmaze.</span>
              <button
                type="button"
                onClick={() => void runSearch(query)}
                className="min-w-[44px] min-h-[44px] -my-2 -mr-2 px-2 inline-flex items-center justify-end text-xs font-bold text-zinc-400 hover:text-white transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {!isSearching && !searchFailed && hasSearched && result === null && (
            <p className="text-xs text-zinc-500 py-4">
              No encontramos esa serie en TVmaze. Probá con otro título.
            </p>
          )}

          {!isSearching && !searchFailed && result !== null && (
            <ul className={`space-y-2 ${isBusy ? 'pointer-events-none opacity-60' : ''}`}>
              <li>
                <button
                  type="button"
                  onClick={() => void handleSelect(result)}
                  disabled={isBusy}
                  aria-label={`Vincular con ${result.name}`}
                  className={`w-full min-h-[44px] flex items-start gap-3 p-2.5 text-left rounded-xl bg-zinc-900/50 ring-1 transition-colors ${
                    result.id === linkedId ? 'ring-violet-500/60' : 'ring-white/[0.06] hover:bg-zinc-800/70'
                  }`}
                >
                  {result.image ? (
                    <img
                      src={result.image}
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
                      <span className="text-sm font-bold text-white truncate">{result.name}</span>
                      {result.id === linkedId && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-violet-400">
                          Vinculado
                        </span>
                      )}
                      {result.id === linkingId && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                          Vinculando…
                        </span>
                      )}
                    </div>

                    {candidateMeta(result) && (
                      <span className="text-[10px] text-zinc-500">{candidateMeta(result)}</span>
                    )}
                  </div>
                </button>
              </li>
            </ul>
          )}

          {linkFailed && (
            <p className="text-xs text-red-400 pt-3">No se pudo vincular. Probá de nuevo.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
