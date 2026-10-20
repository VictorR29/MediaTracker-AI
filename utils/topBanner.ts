import type { AniListData, MediaItem } from '../types';
import { formatPremiereDate, formatRelativeAiring } from './airing';

export type TopBannerKind = 'return' | 'manual' | 'airing' | 'premiere';

export interface TopBanner {
  kind: TopBannerKind;
  text: string;
}

export interface TopBannerInput {
  mediaType: MediaItem['aiData']['mediaType'];
  status: MediaItem['trackingData']['status'];
  currentSeason: number;
  nextReleaseDate?: string;
  scheduledReturnDate?: string;
  anilist?: AniListData;
  /** Unix ms. Injectable so the whole chain is testable. Defaults to Date.now(). */
  now?: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parses "YYYY-MM-DD" as a LOCAL calendar date.
 *
 * `new Date('2026-11-19')` is UTC midnight, which in a negative-offset zone is
 * still the 18th locally: every manual countdown ran one day short and "¡Es Hoy!"
 * arrived a day late. Building the date from its parts has no timezone at all.
 */
const parseLocalDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value.trim());
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    // Reject rolled-over values such as 2026-13-45.
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** Local calendar day as "YYYY-MM-DD", so "today" matches what the user sees. */
const toLocalDateKey = (ms: number): string => {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Whole calendar days from `now` to `nextReleaseDate`, floored at the day boundary. */
const getManualDiffDays = (nextReleaseDate: string, now: number): number => {
  const target = parseLocalDate(nextReleaseDate);
  if (!target) return Number.NaN;

  const today = new Date(now);
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / MS_PER_DAY);
};

/** "T2 " when the entry belongs to another season, "" otherwise. */
const seasonPrefix = (season: number | undefined, currentSeason: number): string =>
  season !== undefined && season !== currentSeason ? `T${season} ` : '';

/** "T2 EP 4 · En 3 días" / "EP 1181 · Ya disponible" / "En emisión". */
const buildAiringText = (
  prefix: string,
  nextEpisode: number | undefined,
  nextAiringAt: number | undefined,
  now: number
): string => {
  const episodePart = nextEpisode !== undefined ? `EP ${nextEpisode}` : 'En emisión';
  const relative = nextAiringAt !== undefined ? formatRelativeAiring(nextAiringAt, now) : '';
  return prefix + episodePart + (relative ? ` · ${relative}` : '');
};

/** Exactly one banner wins: return due > future manual countdown > AniList > manual fallback. */
export function getTopBanner(input: TopBannerInput): TopBanner | null {
  const {
    mediaType,
    status,
    currentSeason,
    nextReleaseDate,
    scheduledReturnDate,
    anilist,
    now = Date.now(),
  } = input;

  // 1. Return due — a paused item whose scheduled return day has arrived.
  if (status === 'En Pausa' && scheduledReturnDate) {
    if (toLocalDateKey(now) >= scheduledReturnDate) {
      return { kind: 'return', text: '¡Hora de Volver!' };
    }
  }

  // 2. Manual countdown — only while the date is still ahead.
  let manualFallback: string | null = null;
  if (status === 'Planeado / Pendiente' && nextReleaseDate) {
    const diffDays = getManualDiffDays(nextReleaseDate, now);

    if (!Number.isFinite(diffDays)) {
      // Unparseable date: say nothing rather than rendering "En NaN días".
      return null;
    }

    if (diffDays > 1) return { kind: 'manual', text: `En ${diffDays} días` };
    if (diffDays === 1) return { kind: 'manual', text: 'Mañana' };
    manualFallback = diffDays === 0 ? '¡Es Hoy!' : 'Estrenado';
  }

  // 3. AniList — anime only, and never for discarded items.
  if (mediaType === 'Anime' && status !== 'Descartado' && anilist) {
    // 3a. The matched entry is currently airing.
    if (anilist.airing?.isAiring === true) {
      const text = buildAiringText(
        seasonPrefix(anilist.season, currentSeason),
        anilist.airing.nextEpisode,
        anilist.airing.nextAiringAt,
        now
      );
      return { kind: 'airing', text };
    }

    // 3b. A directly-related sequel is airing.
    if (anilist.sequel?.status === 'RELEASING') {
      const text = buildAiringText(
        seasonPrefix(anilist.sequel.season, currentSeason),
        anilist.sequel.nextEpisode,
        anilist.sequel.nextAiringAt,
        now
      );
      return { kind: 'airing', text };
    }

    // 3c. A sequel exists but has not premiered yet.
    if (anilist.sequel?.status === 'NOT_YET_RELEASED') {
      const date = formatPremiereDate(anilist.sequel.startDate);
      // Without a date there is nothing new to say: fall through, so a planned
      // item still shows its own "¡Es Hoy!" / "Estrenado" instead of going blank.
      if (date) {
        const prefix = seasonPrefix(anilist.sequel.season, currentSeason);
        const text = prefix ? `${prefix}estrena ${date}` : `Estrena ${date}`;
        return { kind: 'premiere', text };
      }
    }
  }

  // 4. Manual fallback — today or already released, with nothing better to show.
  if (manualFallback) return { kind: 'manual', text: manualFallback };

  return null;
}
