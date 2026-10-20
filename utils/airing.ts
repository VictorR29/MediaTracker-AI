export interface FormatAiringDateOptions {
  locale?: string;
  timeZone?: string;
}

const DEFAULT_LOCALE = 'es-ES';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * "vie, 25 dic · 14:16". Local device time by default; tests pass timeZone.
 * Returns an empty string instead of throwing on invalid input.
 */
export function formatAiringDate(airingAt: number, options: FormatAiringDateOptions = {}): string {
  if (!isFiniteNumber(airingAt)) return '';

  const date = new Date(airingAt * 1000);
  if (Number.isNaN(date.getTime())) return '';

  const locale = options.locale ?? DEFAULT_LOCALE;
  const timeZone = options.timeZone;

  try {
    const dateFormatter = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(timeZone ? { timeZone } : {}),
    });
    const timeFormatter = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      ...(timeZone ? { timeZone } : {}),
    });

    const datePart = dateFormatter.format(date);
    const timePart = timeFormatter.format(date);
    if (!datePart || !timePart) return '';

    return `${datePart} · ${timePart}`;
  } catch {
    return '';
  }
}

/** Mirrors the existing card countdown wording exactly. */
export function formatRelativeAiring(airingAt: number, now: number = Date.now()): string {
  if (!isFiniteNumber(airingAt) || !isFiniteNumber(now)) return '';

  const target = new Date(airingAt * 1000);
  if (Number.isNaN(target.getTime())) return '';

  // Compare calendar days in local time so a late-night episode still reads "today".
  target.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Rounded so DST transitions (23h/25h days) do not drift the day count.
  const diffDays = Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);

  if (diffDays < 0) return 'Ya disponible';
  if (diffDays === 0) return '¡Es Hoy!';
  if (diffDays === 1) return 'Mañana';
  return `En ${diffDays} días`;
}

/** Unwatched released episodes before the next one; null when it cannot be known. */
export function getRemainingEpisodes(nextEpisode?: number, watchedEpisodes?: number): number | null {
  if (!isFiniteNumber(nextEpisode) || !isFiniteNumber(watchedEpisodes)) return null;
  if (nextEpisode <= 1) return null;

  return Math.max(0, nextEpisode - 1 - watchedEpisodes);
}
