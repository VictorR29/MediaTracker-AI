import { describe, it, expect } from 'vitest';
import { getTopBanner } from '../topBanner';
import type { TopBannerInput } from '../topBanner';
import type { AniListAiringSnapshot, AniListData, AniListSequel } from '../../types';
import { formatPremiereDate } from '../airing';

// Fixed local reference instant: 2026-01-15 12:00 local time, so calendar-day
// math is deterministic regardless of the machine time zone.
const NOW = new Date(2026, 0, 15, 12, 0, 0, 0).getTime();

// Local-midnight datetimes: unlike "YYYY-MM-DD", these parse as local time in
// every time zone, so the expected day counts hold everywhere.
const TODAY = '2026-01-15T00:00:00';
const TOMORROW = '2026-01-16T00:00:00';
const IN_42_DAYS = '2026-02-26T00:00:00';
const PAST = '2026-01-10T00:00:00';

/** Unix seconds for `offsetDays` away from NOW, at local noon. */
const airingAt = (offsetDays: number): number => {
  const date = new Date(NOW);
  date.setDate(date.getDate() + offsetDays);
  return Math.floor(date.getTime() / 1000);
};

const buildAiring = (
  overrides: Partial<AniListAiringSnapshot> = {}
): AniListAiringSnapshot => ({
  status: 'RELEASING',
  isAiring: true,
  fetchedAt: NOW,
  ...overrides,
});

const buildSequel = (overrides: Partial<AniListSequel> = {}): AniListSequel => ({
  id: 200,
  title: 'Sequel',
  status: 'RELEASING',
  ...overrides,
});

const buildAniList = (overrides: Partial<AniListData> = {}): AniListData => ({
  id: 100,
  matchedTitle: 'Test Anime',
  matchedBy: 'title',
  confidence: 'exact',
  resolvedAt: NOW,
  ...overrides,
});

const buildInput = (overrides: Partial<TopBannerInput> = {}): TopBannerInput => ({
  mediaType: 'Anime',
  status: 'Completado',
  currentSeason: 1,
  now: NOW,
  ...overrides,
});

describe('getTopBanner', () => {
  it('returns the return banner when a paused item is due, even with an airing AniList entry', () => {
    const banner = getTopBanner(
      buildInput({
        status: 'En Pausa',
        scheduledReturnDate: '2026-01-10',
        anilist: buildAniList({ airing: buildAiring({ nextEpisode: 5, nextAiringAt: airingAt(3) }) }),
      })
    );

    expect(banner).toEqual({ kind: 'return', text: '¡Hora de Volver!' });
  });

  it('returns the return banner on the scheduled day itself', () => {
    const banner = getTopBanner(
      buildInput({ status: 'En Pausa', scheduledReturnDate: '2026-01-15' })
    );

    expect(banner).toEqual({ kind: 'return', text: '¡Hora de Volver!' });
  });

  it('keeps the manual countdown when a planned item has a future date and AniList is airing', () => {
    const banner = getTopBanner(
      buildInput({
        status: 'Planeado / Pendiente',
        nextReleaseDate: IN_42_DAYS,
        anilist: buildAniList({ airing: buildAiring({ nextEpisode: 4, nextAiringAt: airingAt(3) }) }),
      })
    );

    expect(banner).toEqual({ kind: 'manual', text: 'En 42 días' });
  });

  it('reads "Mañana" when a planned item releases tomorrow', () => {
    const banner = getTopBanner(
      buildInput({ status: 'Planeado / Pendiente', nextReleaseDate: TOMORROW })
    );

    expect(banner).toEqual({ kind: 'manual', text: 'Mañana' });
  });

  it('cedes to the airing banner on the planned release day when AniList is airing', () => {
    const banner = getTopBanner(
      buildInput({
        status: 'Planeado / Pendiente',
        nextReleaseDate: TODAY,
        anilist: buildAniList({ airing: buildAiring({ nextEpisode: 5, nextAiringAt: airingAt(3) }) }),
      })
    );

    expect(banner).toEqual({ kind: 'airing', text: 'EP 5 · En 3 días' });
  });

  it('keeps "¡Es Hoy!" for a planned item releasing today without AniList data', () => {
    const banner = getTopBanner(
      buildInput({ status: 'Planeado / Pendiente', nextReleaseDate: TODAY })
    );

    expect(banner).toEqual({ kind: 'manual', text: '¡Es Hoy!' });
  });

  it('keeps "Estrenado" for a planned item whose date already passed', () => {
    const banner = getTopBanner(
      buildInput({ status: 'Planeado / Pendiente', nextReleaseDate: PAST })
    );

    expect(banner).toEqual({ kind: 'manual', text: 'Estrenado' });
  });

  it('returns the airing banner for a planned item without a date', () => {
    const banner = getTopBanner(
      buildInput({
        status: 'Planeado / Pendiente',
        anilist: buildAniList({ airing: buildAiring({ nextEpisode: 8, nextAiringAt: airingAt(2) }) }),
      })
    );

    expect(banner).toEqual({ kind: 'airing', text: 'EP 8 · En 2 días' });
  });

  it('prefers the future manual countdown over an announced sequel', () => {
    const banner = getTopBanner(
      buildInput({
        status: 'Planeado / Pendiente',
        nextReleaseDate: IN_42_DAYS,
        anilist: buildAniList({
          sequel: buildSequel({ status: 'NOT_YET_RELEASED', season: 2, startDate: '2026-11-12' }),
        }),
      })
    );

    expect(banner).toEqual({ kind: 'manual', text: 'En 42 días' });
  });

  it('reports the season prefix and episode for an airing sequel', () => {
    const banner = getTopBanner(
      buildInput({
        anilist: buildAniList({
          sequel: buildSequel({ season: 2, nextEpisode: 4, nextAiringAt: airingAt(3) }),
        }),
      })
    );

    expect(banner?.kind).toBe('airing');
    expect(banner?.text).toContain('T2 EP 4');
    expect(banner?.text).toBe('T2 EP 4 · En 3 días');
  });

  it('announces an upcoming sequel with its premiere date', () => {
    const banner = getTopBanner(
      buildInput({
        anilist: buildAniList({
          sequel: buildSequel({ status: 'NOT_YET_RELEASED', season: 2, startDate: '2026-11-12' }),
        }),
      })
    );

    expect(formatPremiereDate('2026-11-12')).toBe('12 nov 2026');
    expect(banner).toEqual({ kind: 'premiere', text: 'T2 estrena 12 nov 2026' });
  });

  it('capitalizes the premiere text when there is no season prefix', () => {
    const banner = getTopBanner(
      buildInput({
        anilist: buildAniList({
          season: 1,
          sequel: buildSequel({ status: 'NOT_YET_RELEASED', season: 1, startDate: '2026-11-12' }),
        }),
      })
    );

    expect(banner).toEqual({ kind: 'premiere', text: 'Estrena 12 nov 2026' });
  });

  it('returns null when an announced sequel has no premiere date', () => {
    const banner = getTopBanner(
      buildInput({
        anilist: buildAniList({ sequel: buildSequel({ status: 'NOT_YET_RELEASED', startDate: null }) }),
      })
    );

    expect(banner).toBeNull();
  });

  it('never returns an AniList banner for a discarded item', () => {
    const banner = getTopBanner(
      buildInput({
        status: 'Descartado',
        anilist: buildAniList({ airing: buildAiring({ nextEpisode: 5, nextAiringAt: airingAt(3) }) }),
      })
    );

    expect(banner).toBeNull();
  });

  it('never returns an AniList banner for a non-anime media type', () => {
    const banner = getTopBanner(
      buildInput({
        mediaType: 'Serie',
        anilist: buildAniList({ airing: buildAiring({ nextEpisode: 5, nextAiringAt: airingAt(3) }) }),
      })
    );

    expect(banner).toBeNull();
  });

  it('omits the season prefix when the entry season matches the current season', () => {
    const banner = getTopBanner(
      buildInput({
        currentSeason: 2,
        anilist: buildAniList({
          season: 2,
          airing: buildAiring({ nextEpisode: 3, nextAiringAt: airingAt(4) }),
        }),
      })
    );

    expect(banner?.text.startsWith('EP')).toBe(true);
    expect(banner?.text).toBe('EP 3 · En 4 días');
  });

  it('reads "Ya disponible" when the next airing timestamp is in the past', () => {
    const banner = getTopBanner(
      buildInput({
        anilist: buildAniList({ airing: buildAiring({ nextEpisode: 9, nextAiringAt: airingAt(-1) }) }),
      })
    );

    expect(banner?.kind).toBe('airing');
    expect(banner?.text).toBe('EP 9 · Ya disponible');
  });

  it('falls back to "En emisión" when an airing entry has no next episode', () => {
    const banner = getTopBanner(buildInput({ anilist: buildAniList({ airing: buildAiring() }) }));

    expect(banner).toEqual({ kind: 'airing', text: 'En emisión' });
  });

  it('reads a plain "YYYY-MM-DD" date input as a local day, not UTC midnight', () => {
    // Regression: `new Date('2026-02-26')` is UTC midnight, which in a
    // negative-offset zone snapped to the 25th and reported one day less.
    const banner = getTopBanner(
      buildInput({ status: 'Planeado / Pendiente', nextReleaseDate: '2026-02-26' })
    );

    expect(banner).toEqual({ kind: 'manual', text: 'En 42 días' });
  });

  it('keeps the manual fallback when an announced sequel has no date', () => {
    const banner = getTopBanner(
      buildInput({
        status: 'Planeado / Pendiente',
        nextReleaseDate: PAST,
        anilist: buildAniList({ sequel: buildSequel({ status: 'NOT_YET_RELEASED', startDate: null }) }),
      })
    );

    expect(banner).toEqual({ kind: 'manual', text: 'Estrenado' });
  });

  it('lets an announced sequel take the slot on the planned day itself', () => {
    const banner = getTopBanner(
      buildInput({
        status: 'Planeado / Pendiente',
        nextReleaseDate: TODAY,
        anilist: buildAniList({
          sequel: buildSequel({ status: 'NOT_YET_RELEASED', startDate: '2026-11-12' }),
        }),
      })
    );

    expect(banner?.kind).toBe('premiere');
    expect(banner?.text).toBe(`Estrena ${formatPremiereDate('2026-11-12')}`);
  });

  it('ignores an unparseable manual date instead of rendering NaN', () => {
    const banner = getTopBanner(
      buildInput({ status: 'Planeado / Pendiente', nextReleaseDate: 'not-a-date' })
    );

    expect(banner).toBeNull();
  });
});
