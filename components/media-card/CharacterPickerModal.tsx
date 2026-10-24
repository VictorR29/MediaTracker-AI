import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ImageOff, X } from 'lucide-react';
import { fetchMediaCharacters } from '../../services/anilistService';
import { fetchTvmazeCharacters } from '../../services/tvmazeService';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/**
 * One selectable character. `subtitle` is the native name for AniList and the
 * actor for TVmaze, so the second line means the right thing for each source.
 */
export interface CharacterCandidate {
  id: number;
  name: string;
  subtitle?: string;
  image?: string;
}

type CharacterPickerModalProps = {
  itemId: string;
  existing: { name: string; image?: string }[];
  onConfirm: (selected: { name: string; image?: string }[]) => void;
  onClose: () => void;
} & (
  | { anilistId: number; tvmazeId?: never }
  | { tvmazeId: number; anilistId?: never }
);

type CharacterSource = 'anilist' | 'tvmaze';

const SOURCE_COPY = {
  anilist: {
    title: 'Personajes de AniList',
    empty: 'Este anime no tiene personajes en AniList.',
    failure: 'No se pudo consultar AniList',
    consoleLabel: 'AniList',
  },
  tvmaze: {
    title: 'Reparto de TVmaze',
    empty: 'TVmaze no tiene reparto para esta serie.',
    failure: 'No se pudo consultar TVmaze',
    consoleLabel: 'TVmaze',
  },
} as const;

const TITLE_ID = 'character-picker-modal-title';

/** Local copy: case- and accent-insensitive, collapsed whitespace. */
const normalizeName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

export const CharacterPickerModal: React.FC<CharacterPickerModalProps> = ({
  itemId,
  anilistId,
  tvmazeId,
  existing,
  onConfirm,
  onClose,
}) => {
  const [characters, setCharacters] = useState<CharacterCandidate[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [reloadToken, setReloadToken] = useState(0);

  // The props are a discriminated union, so exactly one source is defined.
  const source: CharacterSource = anilistId !== undefined ? 'anilist' : 'tvmaze';
  const copy = SOURCE_COPY[source];

  const modalRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const requestIdRef = useRef(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // One request per open. The service caches successes, so reopening the picker
  // is free and a retry after a failure is the only repeat request.
  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setCharacters(null);
    setIsLoading(true);
    setLoadFailed(false);

    const load = async (): Promise<CharacterCandidate[]> => {
      if (anilistId !== undefined) {
        const list = await fetchMediaCharacters(anilistId);
        return list.map(c => ({ id: c.id, name: c.name, subtitle: c.nativeName, image: c.image }));
      }
      if (tvmazeId !== undefined) {
        const list = await fetchTvmazeCharacters(tvmazeId);
        return list.map(c => ({ id: c.id, name: c.name, subtitle: c.actor, image: c.image }));
      }
      return [];
    };

    load()
      .then((list) => {
        if (requestIdRef.current !== requestId) return;
        setCharacters(list);
      })
      .catch((error) => {
        if (requestIdRef.current !== requestId) return;
        console.error(`Failed to load ${copy.consoleLabel} characters`, error);
        setLoadFailed(true);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsLoading(false);
      });
  }, [anilistId, tvmazeId, itemId, reloadToken]);

  // A different work starts with a clean selection and filter; a retry keeps them.
  useEffect(() => {
    setSelectedIds(new Set());
    setFilter('');
  }, [anilistId, tvmazeId, itemId]);

  const existingKeys = useMemo(
    () => new Set(existing.map((character) => normalizeName(character.name))),
    [existing],
  );

  const visibleCharacters = useMemo(() => {
    if (!characters) return [];
    const query = normalizeName(filter);
    if (!query) return characters;

    return characters.filter((character) => {
      if (normalizeName(character.name).includes(query)) return true;
      return !!character.subtitle && normalizeName(character.subtitle).includes(query);
    });
  }, [characters, filter]);

  const selectedCount = useMemo(
    () => (characters ?? []).filter((character) => selectedIds.has(character.id)).length,
    [characters, selectedIds],
  );

  const toggleCharacter = (id: number) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = (characters ?? [])
      .filter((character) => selectedIds.has(character.id))
      .map((character) => ({ name: character.name, image: character.image }));

    if (selected.length === 0) return;
    onConfirm(selected);
    onClose();
  };

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
            {copy.title}
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

        <div className="px-4 py-3">
          <input
            type="text"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filtrar personajes"
            placeholder="Filtrar personajes…"
            className="w-full min-h-[44px] bg-zinc-900/50 ring-1 ring-white/10 rounded-xl px-3 text-sm text-white outline-none focus:ring-white/20 placeholder:text-zinc-600"
          />
        </div>

        <div className="px-4 pb-4 overflow-y-auto max-h-[60vh]" aria-busy={isLoading}>
          {isLoading && (
            <p className="text-xs text-zinc-500 animate-pulse py-4">Cargando personajes…</p>
          )}

          {!isLoading && loadFailed && (
            <div className="flex items-center justify-between gap-3 py-4">
              <span className="text-xs text-zinc-500">{copy.failure}</span>
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className="min-w-[44px] min-h-[44px] -my-2 -mr-2 px-2 inline-flex items-center justify-end text-xs font-bold text-zinc-400 hover:text-white transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {!isLoading && !loadFailed && characters !== null && characters.length === 0 && (
            <p className="text-xs text-zinc-500 py-4">{copy.empty}</p>
          )}

          {!isLoading && !loadFailed && characters !== null && characters.length > 0 && visibleCharacters.length === 0 && (
            <p className="text-xs text-zinc-500 py-4">Ningún personaje coincide con el filtro.</p>
          )}

          {!isLoading && !loadFailed && visibleCharacters.length > 0 && (
            <ul className="space-y-2">
              {visibleCharacters.map((character) => {
                const isSelected = selectedIds.has(character.id);
                const isAlreadyAdded = existingKeys.has(normalizeName(character.name));
                const showSubtitle = !!character.subtitle && character.subtitle !== character.name;

                return (
                  <li key={character.id}>
                    <button
                      type="button"
                      onClick={() => toggleCharacter(character.id)}
                      disabled={isAlreadyAdded}
                      aria-pressed={isAlreadyAdded ? undefined : isSelected}
                      aria-label={isAlreadyAdded ? `${character.name} — Ya agregado` : character.name}
                      className={`w-full min-h-[44px] flex items-center gap-3 p-2.5 text-left rounded-xl ring-1 transition-colors ${
                        isAlreadyAdded
                          ? 'bg-zinc-900/30 ring-white/[0.04] opacity-60 cursor-default'
                          : isSelected
                            ? 'bg-violet-500/10 ring-violet-500/60'
                            : 'bg-zinc-900/50 ring-white/[0.06] hover:bg-zinc-800/70'
                      }`}
                    >
                      {character.image ? (
                        <img
                          src={character.image}
                          alt=""
                          loading="lazy"
                          className="w-11 h-11 rounded-full object-cover bg-zinc-800 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                          <ImageOff className="w-4 h-4 text-zinc-600" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-sm font-bold text-white truncate">{character.name}</p>
                        {showSubtitle && <p className="text-xs text-zinc-500 truncate">{character.subtitle}</p>}
                      </div>

                      {isAlreadyAdded ? (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                          Ya agregado
                        </span>
                      ) : (
                        isSelected && <Check className="w-4 h-4 shrink-0 text-violet-400" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 ring-1 ring-white/[0.06] bg-[#18181B]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-2 inline-flex items-center text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="min-w-[44px] min-h-[44px] px-4 bg-white text-zinc-900 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Agregar {selectedCount}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
