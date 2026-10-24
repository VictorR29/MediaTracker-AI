import React from 'react';

interface TvmazeLinkRowProps {
  hasLink: boolean;
  /** Spanish broadcast status when linked, e.g. "En emisión". */
  status?: string;
  onOpen: () => void;
}

/**
 * Always-visible entry point to the manual TVmaze picker.
 *
 * Series have no airing block to hang the action from, and a wrong automatic
 * match must stay correctable, so the row renders for every live Serie item.
 */
export const TvmazeLinkRow: React.FC<TvmazeLinkRowProps> = ({ hasLink, status, onOpen }) => {
  const label = hasLink ? (status && status.trim().length > 0 ? status : 'Vinculado') : 'Sin vínculo';

  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <span className="flex min-w-0 items-center gap-2 text-[10px]">
        <span className="shrink-0 font-bold uppercase tracking-widest text-zinc-600">TVmaze</span>
        <span className="truncate text-zinc-500">{label}</span>
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
