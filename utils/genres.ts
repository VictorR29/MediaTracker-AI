import type { MediaItem } from '../types';
import { normalizeGenre } from '../types';

/**
 * Resolves the genres shown by read-only surfaces (filters, stats, catalog
 * grouping, characters, taste profile and greetings).
 *
 * Precedence:
 * 1. A work linked to AniList uses `aiData.anilist.genres`, because AniList
 *    returns a fixed enum that is consistent across every work. Those values are
 *    English enum strings, so they are mapped through `normalizeGenre` and
 *    deduplicated; non-strings and blank entries are dropped.
 * 2. Otherwise the AI-generated `aiData.genres` are returned VERBATIM (never
 *    normalized), which keeps existing unlinked works behaving exactly as they
 *    did before AniList genres existed. Legacy values stay inconsistent between
 *    works, but any consumer that normalizes again is unaffected because
 *    `normalizeGenre` is idempotent.
 *
 * `MediaCard` intentionally does not use this accessor: its chips edit
 * `aiData.genres` directly, so showing AniList values there would turn its
 * delete button into a no-op.
 *
 * Always returns a fresh array, so callers can mutate or sort it safely.
 */
export const getGenres = (item: MediaItem): string[] => {
  const anilistGenres = item.aiData?.anilist?.genres;

  if (Array.isArray(anilistGenres) && anilistGenres.length > 0) {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const genre of anilistGenres) {
      if (typeof genre !== 'string') continue;
      if (!genre.trim()) continue;

      const value = normalizeGenre(genre);
      if (!value || seen.has(value)) continue;

      seen.add(value);
      normalized.push(value);
    }

    return normalized;
  }

  return (item.aiData?.genres ?? []).slice();
};
