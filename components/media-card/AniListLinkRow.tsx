import React from 'react';
import type { AniListData } from '../../types';
import type { AiringLoadState } from '../../hooks/useAiringSnapshot';

interface AniListLinkRowProps {
  /** Persisted identity, when the item is already linked. */
  identity?: AniListData;
  /** Load state, used only for the text while there is no identity yet. */
  state: AiringLoadState;
  onLink: () => void;
}

const describeStatus = (identity: AniListData | undefined, state: AiringLoadState): string => {
  if (identity) {
    const title = identity.matchedTitle || `ID ${identity.id}`;
    return identity.season !== undefined ? `T${identity.season} · ${title}` : title;
  }

  if (state === 'loading') return 'Buscando…';
  if (state === 'error') return 'No disponible';
  return 'Sin vínculo';
};

/**
 * Always-visible entry point to the manual AniList picker.
 *
 * It deliberately does NOT live inside `AiringBlock`: the action must not depend
 * on whether the airing data loaded, otherwise a failed or finished lookup
 * leaves the user with no way to link or correct the work.
 */
export const AniListLinkRow: React.FC<AniListLinkRowProps> = ({ identity, state, onLink }) => (
  <div className="flex items-center justify-between gap-3 px-1">
    <span className="flex min-w-0 items-center gap-2 text-[10px]">
      <span className="shrink-0 font-bold uppercase tracking-widest text-zinc-600">AniList</span>
      <span className="truncate text-zinc-500">{describeStatus(identity, state)}</span>
    </span>
    <button
      type="button"
      onClick={onLink}
      className="-my-2 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-end px-1 text-[10px] font-bold uppercase tracking-widest text-violet-400 transition-colors hover:text-violet-300"
    >
      {identity ? 'Cambiar' : 'Vincular'}
    </button>
  </div>
);
