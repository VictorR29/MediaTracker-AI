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

// Fixed Spanish short month names. Deliberately not Intl: the output must be
// identical on every device regardless of the runtime locale.
const PREMIERE_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const DATE_PATTERN = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/;

const isValidMonth = (month: number): boolean => month >= 1 && month <= 12;
const isValidDay = (day: number): boolean => day >= 1 && day <= 31;

/**
 * "4 ene 2027" / "ene 2027" / "2027" / '' for "YYYY-MM-DD" | "YYYY-MM" | "YYYY" | null.
 * Month names are hardcoded so the result is locale-independent; `locale` is
 * accepted for call-site symmetry and intentionally does not affect the output.
 */
export function formatPremiereDate(startDate?: string | null, _locale?: string): string {
  if (typeof startDate !== 'string') return '';

  const match = DATE_PATTERN.exec(startDate.trim());
  if (!match) return '';

  const [, yearPart, monthPart, dayPart] = match;
  if (monthPart === undefined) return yearPart;

  const month = Number.parseInt(monthPart, 10);
  if (!isValidMonth(month)) return '';

  if (dayPart === undefined) return `${PREMIERE_MONTHS[month - 1]} ${yearPart}`;

  const day = Number.parseInt(dayPart, 10);
  if (!isValidDay(day)) return '';

  return `${day} ${PREMIERE_MONTHS[month - 1]} ${yearPart}`;
}
