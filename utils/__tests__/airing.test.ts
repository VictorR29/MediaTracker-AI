import { describe, it, expect } from 'vitest';
import { formatAiringDate, formatPremiereDate, formatRelativeAiring, getRemainingEpisodes } from '../airing';

// 2026-12-25T14:16:00Z
const AIRING_AT = 1798208160;

// A fixed local reference instant: 2026-06-15 12:00 local time.
const REFERENCE = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();

/** Unix seconds for `offsetDays` away from the reference day, at local noon. */
const dayOffset = (offsetDays: number): number => {
  const date = new Date(REFERENCE);
  date.setDate(date.getDate() + offsetDays);
  return date.getTime() / 1000;
};

describe('formatAiringDate', () => {
  it('formats the AniList timestamp in UTC with weekday, day, month and time', () => {
    // 2026-12-25 is a Friday, so the es-ES short weekday is "vie".
    expect(formatAiringDate(AIRING_AT, { timeZone: 'UTC' })).toBe('vie, 25 dic · 14:16');
  });

  it('shifts the hour for another time zone while keeping the same composed shape', () => {
    const buenosAires = formatAiringDate(AIRING_AT, { timeZone: 'America/Argentina/Buenos_Aires' });
    const utc = formatAiringDate(AIRING_AT, { timeZone: 'UTC' });

    // UTC-3 keeps the same calendar day but three hours earlier.
    expect(buenosAires).toBe('vie, 25 dic · 11:16');
    expect(buenosAires).toContain('·');
    expect(buenosAires).not.toBe(utc);
  });

  it('returns an empty string for invalid input instead of throwing', () => {
    expect(formatAiringDate(Number.NaN)).toBe('');
    expect(formatAiringDate(undefined as any)).toBe('');
    expect(formatAiringDate(Number.POSITIVE_INFINITY)).toBe('');
  });
});

describe('formatRelativeAiring', () => {
  it('reads "¡Es Hoy!" for an episode airing later today', () => {
    expect(formatRelativeAiring(dayOffset(0), REFERENCE)).toBe('¡Es Hoy!');
  });

  it('reads "Mañana" for an episode airing tomorrow', () => {
    expect(formatRelativeAiring(dayOffset(1), REFERENCE)).toBe('Mañana');
  });

  it('reads "En 3 días" for an episode three calendar days ahead', () => {
    expect(formatRelativeAiring(dayOffset(3), REFERENCE)).toBe('En 3 días');
  });

  it('reads "Ya disponible" for an episode in the past', () => {
    expect(formatRelativeAiring(dayOffset(-1), REFERENCE)).toBe('Ya disponible');
  });

  it('compares calendar days, not raw millisecond distance', () => {
    const lateToday = new Date(REFERENCE);
    lateToday.setHours(23, 30, 0, 0);
    expect(formatRelativeAiring(lateToday.getTime() / 1000, REFERENCE)).toBe('¡Es Hoy!');

    const earlyTomorrow = new Date(REFERENCE);
    earlyTomorrow.setDate(earlyTomorrow.getDate() + 1);
    earlyTomorrow.setHours(0, 30, 0, 0);
    expect(formatRelativeAiring(earlyTomorrow.getTime() / 1000, REFERENCE)).toBe('Mañana');
  });

  it('returns an empty string for invalid input', () => {
    expect(formatRelativeAiring(Number.NaN, REFERENCE)).toBe('');
  });
});

describe('getRemainingEpisodes', () => {
  it('counts released episodes the user has not watched yet', () => {
    expect(getRemainingEpisodes(1181, 1178)).toBe(2);
    // Episodes 1..1180 are released, so 1180 remain when nothing was watched.
    expect(getRemainingEpisodes(1181, 0)).toBe(1180);
  });

  it('returns null when the inputs cannot describe a gap', () => {
    expect(getRemainingEpisodes(undefined, 5)).toBeNull();
    expect(getRemainingEpisodes(1, 0)).toBeNull();
    expect(getRemainingEpisodes(12, undefined)).toBeNull();
  });

  it('never returns a negative count', () => {
    expect(getRemainingEpisodes(5, 10)).toBe(0);
  });
});

describe('formatPremiereDate', () => {
  it('renders day, Spanish month and year for a full date', () => {
    expect(formatPremiereDate('2027-01-04')).toBe('4 ene 2027');
  });

  it('renders Spanish month and year when the day is unknown', () => {
    expect(formatPremiereDate('2027-01')).toBe('ene 2027');
  });

  it('renders the year alone when only the year is known', () => {
    expect(formatPremiereDate('2027')).toBe('2027');
  });

  it('returns an empty string for null, undefined and garbage', () => {
    expect(formatPremiereDate(null)).toBe('');
    expect(formatPremiereDate(undefined)).toBe('');
    expect(formatPremiereDate('')).toBe('');
    expect(formatPremiereDate('not-a-date')).toBe('');
    expect(formatPremiereDate('2027-13')).toBe('');
    expect(formatPremiereDate('2027-01-99')).toBe('');
  });

  it('is locale-independent and always uses Spanish month names', () => {
    expect(formatPremiereDate('2027-08-15', 'en-US')).toBe('15 ago 2027');
  });
});
