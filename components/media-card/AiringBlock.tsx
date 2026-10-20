import React from 'react';
import { CalendarClock } from 'lucide-react';
import type { AniListAiringSnapshot, AniListMediaStatus, AniListSequel } from '../../types';
import type { AiringLoadState } from '../../hooks/useAiringSnapshot';
import { formatAiringDate, formatPremiereDate, formatRelativeAiring, getRemainingEpisodes } from '../../utils/airing';

interface AiringBlockProps {
  state: AiringLoadState;
  snapshot?: AniListAiringSnapshot;
  /** Directly-related season that is airing or announced. */
  sequel?: AniListSequel;
  /** Season the AniList entry represents, when known. */
  season?: number;
  currentSeason: number;
  watchedEpisodes: number;
  totalSeasons: number;
  onRetry: () => void;
}

const FINAL_STATUS_COPY: Record<AniListMediaStatus, string> = {
  FINISHED: 'Emisión finalizada',
  NOT_YET_RELEASED: 'Aún no estrena',
  HIATUS: 'En pausa',
  CANCELLED: 'Cancelada',
  RELEASING: 'Emisión finalizada',
};

const CARD_CLASS =
  'bg-zinc-900/50 rounded-xl px-4 py-3 ring-1 ring-white/[0.06] animate-fade-in';

const SEQUEL_CARD_CLASS = `${CARD_CLASS} space-y-2`;

export const AiringBlock: React.FC<AiringBlockProps> = ({
  state,
  snapshot,
  sequel,
  season,
  currentSeason,
  watchedEpisodes,
  totalSeasons,
  onRetry,
}) => {
  const stopPropagation = (event: React.MouseEvent) => event.stopPropagation();

  if (state === 'idle') return null;

  if (state === 'loading') {
    return (
      <div className={CARD_CLASS} onClick={stopPropagation} role="status" aria-live="polite">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 animate-pulse">
          Consultando AniList…
        </span>
      </div>
    );
  }

  if (state === 'unmatched') return null;

  if (state === 'error') {
    return (
      <div className={CARD_CLASS} onClick={stopPropagation}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-600">No se pudo consultar AniList</span>
          <button
            type="button"
            onClick={onRetry}
            className="min-w-[44px] min-h-[44px] -my-2 -mr-2 px-2 inline-flex items-center justify-end text-xs font-bold text-zinc-400 hover:text-white transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  if (snapshot.isAiring) {
    const { nextEpisode, nextAiringAt } = snapshot;

    // Season alignment: never guess. A mismatch wins over the remaining-episodes hint.
    let alignment: string | null = null;
    if (season !== undefined && season !== currentSeason) {
      alignment = `Vas por T${currentSeason} · la emisión es de T${season}`;
    } else if (watchedEpisodes > 0) {
      // Without a known season we cannot tell which entry the snapshot describes.
      const seasonKnown = season !== undefined || totalSeasons <= 1;
      if (seasonKnown) {
        const remaining = getRemainingEpisodes(nextEpisode, watchedEpisodes);
        if (remaining === 0) alignment = 'Estás al día';
        else if (remaining !== null && remaining > 0) alignment = `Te faltan ${remaining} para estar al día`;
      }
    }

    return (
      <div className="bg-zinc-900/50 rounded-xl px-4 py-4 ring-1 ring-white/[0.06] animate-fade-in space-y-2" onClick={stopPropagation}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
              {season !== undefined ? `T${season} EN EMISIÓN` : 'EN EMISIÓN'}
            </span>
          </span>
        </div>

        {nextEpisode !== undefined && (
          <div className="text-2xl font-black text-white">EP {nextEpisode}</div>
        )}

        {nextAiringAt !== undefined && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
            <CalendarClock className="w-3.5 h-3.5 text-zinc-500" />
            <span>{formatAiringDate(nextAiringAt)}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-300 font-bold">{formatRelativeAiring(nextAiringAt)}</span>
          </div>
        )}

        {alignment && <p className="text-[10px] text-zinc-500">{alignment}</p>}
      </div>
    );
  }

  // The matched entry is not airing, but a directly-related season is.
  if (sequel?.status === 'RELEASING') {
    const sequelSeason = sequel.season;

    // Same alignment rules as the main block, described by the sequel's season.
    let alignment: string | null = null;
    if (sequelSeason !== undefined && sequelSeason !== currentSeason) {
      alignment = `Vas por T${currentSeason} · la emisión es de T${sequelSeason}`;
    } else if (watchedEpisodes > 0) {
      const seasonKnown = sequelSeason !== undefined || totalSeasons <= 1;
      if (seasonKnown) {
        const remaining = getRemainingEpisodes(sequel.nextEpisode, watchedEpisodes);
        if (remaining === 0) alignment = 'Estás al día';
        else if (remaining !== null && remaining > 0) alignment = `Te faltan ${remaining} para estar al día`;
      }
    }

    return (
      <div className={SEQUEL_CARD_CLASS} onClick={stopPropagation}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
              {sequelSeason !== undefined ? `T${sequelSeason} EN EMISIÓN` : 'EN EMISIÓN'}
            </span>
          </span>
        </div>

        {sequelSeason === undefined && sequel.title && (
          <p className="text-[10px] text-zinc-600 truncate">{sequel.title}</p>
        )}

        {sequel.nextEpisode !== undefined && (
          <div className="text-2xl font-black text-white">EP {sequel.nextEpisode}</div>
        )}

        {sequel.nextAiringAt !== undefined && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
            <CalendarClock className="w-3.5 h-3.5 text-zinc-500" />
            <span>{formatAiringDate(sequel.nextAiringAt)}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-300 font-bold">{formatRelativeAiring(sequel.nextAiringAt)}</span>
          </div>
        )}

        {alignment && <p className="text-[10px] text-zinc-500">{alignment}</p>}
      </div>
    );
  }

  if (sequel?.status === 'NOT_YET_RELEASED') {
    const sequelSeason = sequel.season;
    const premiere = sequel.startDate ? formatPremiereDate(sequel.startDate) : '';

    return (
      <div className={SEQUEL_CARD_CLASS} onClick={stopPropagation}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-amber-400 text-[10px] font-bold uppercase tracking-widest">
              {sequelSeason !== undefined ? `T${sequelSeason} ANUNCIADA` : 'NUEVA TEMPORADA ANUNCIADA'}
            </span>
          </span>
        </div>

        {sequelSeason === undefined && sequel.title && (
          <p className="text-[10px] text-zinc-600 truncate">{sequel.title}</p>
        )}

        {premiere && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
            <CalendarClock className="w-3.5 h-3.5 text-zinc-500" />
            <span>Estrena el {premiere}</span>
          </div>
        )}
      </div>
    );
  }

  // A finished series has nothing to add here: the block is about what is coming.
  if (snapshot.status === 'FINISHED') return null;

  return (
    <div className={CARD_CLASS} onClick={stopPropagation}>
      <span className="text-xs text-zinc-600">
        {FINAL_STATUS_COPY[snapshot.status] ?? 'Emisión finalizada'}
      </span>
    </div>
  );
};
