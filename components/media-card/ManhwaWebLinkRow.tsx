import React from 'react';

interface ManhwaWebLinkRowProps {
  /** True when the item already carries a "Leer en ManhwaWeb" custom link. */
  hasLink: boolean;
  onOpen: () => void;
}

/**
 * Opt-in entry point to the ManhwaWeb link picker, rendered only for manhwas
 * while the setting is on. Mirrors `AniListLinkRow` so both rows read as one
 * pair of external sources.
 */
export const ManhwaWebLinkRow: React.FC<ManhwaWebLinkRowProps> = ({ hasLink, onOpen }) => {
  const status = hasLink ? 'Vinculado' : 'Sin vínculo';

  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <span className="flex min-w-0 items-center gap-2 text-[10px]">
        <span className="shrink-0 font-bold uppercase tracking-widest text-zinc-600">ManhwaWeb</span>
        <span className="truncate text-zinc-500">{status}</span>
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="-my-2 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-end px-1 text-[10px] font-bold uppercase tracking-widest text-violet-400 transition-colors hover:text-violet-300"
      >
        {hasLink ? 'Cambiar' : 'Buscar'}
      </button>
    </div>
  );
};
