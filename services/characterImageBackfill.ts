import type { MediaItem } from '../types';
import { fetchMediaCharacters } from './anilistService';
import type { AniListCharacter } from './anilistService';

export interface CharacterImageMatchReport {
  /** New array, same order: names are never touched, only `image` may be filled. */
  characters: { name: string; image?: string }[];
  filled: number;
  ambiguous: number;
  notFound: number;
}

export interface CharacterImageBackfillSummary {
  /** Linked works with at least one character missing an image. */
  worksConsidered: number;
  /** Works actually fetched. A failed fetch still consumed a request. */
  requests: number;
  filled: number;
  ambiguous: number;
  notFound: number;
  failed: number;
  cancelled: boolean;
}

export interface CharacterImageBackfillOptions {
  items: MediaItem[];
  fetchCharacters?: (mediaId: number) => Promise<AniListCharacter[]>;
  persist?: (item: MediaItem) => Promise<void> | void;
  read?: (id: string) => MediaItem | undefined;
  shouldStop?: () => boolean;
  onProgress?: (summary: CharacterImageBackfillSummary, current?: string) => void;
}

/** Containment below this length is noise: `"a"` would match half the cast. */
const MIN_CONTAINMENT_LENGTH = 3;

/**
 * Lowercase, strip diacritics, collapse every non-alphanumeric run into a
 * single space, then trim. Mirrors the normalization used by the title matcher.
 */
const normalizeName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const hasImage = (character: { image?: string }): boolean =>
  typeof character.image === 'string' && character.image.trim().length > 0;

const matchesName = (typed: string, candidate: string): boolean => {
  if (!typed || !candidate) return false;
  if (typed === candidate) return true;
  if (typed.length < MIN_CONTAINMENT_LENGTH) return false;
  return candidate.includes(typed) || typed.includes(candidate);
};

/**
 * Fills the missing photos of the characters the user typed, without ever
 * renaming them. Pure: the input entries are copied, never mutated.
 *
 * A typed name is resolved only when exactly one distinct candidate matches;
 * anything else is reported and left alone so the user can decide.
 */
export const matchCharacterImages = (
  characters: { name: string; image?: string }[],
  candidates: AniListCharacter[],
): CharacterImageMatchReport => {
  // The same character can arrive twice through different pagination windows.
  const distinct = new Map<number, AniListCharacter>();
  for (const candidate of candidates) {
    if (!distinct.has(candidate.id)) distinct.set(candidate.id, candidate);
  }
  const pool = [...distinct.values()];

  let filled = 0;
  let ambiguous = 0;
  let notFound = 0;

  const result = characters.map(character => {
    // An existing photo is untouchable: not matched, not counted, not replaced.
    if (hasImage(character)) return { ...character };

    const typed = normalizeName(character.name);
    const matches = pool.filter(candidate => matchesName(typed, normalizeName(candidate.name)));

    if (matches.length === 0) {
      notFound += 1;
      return { ...character };
    }

    // Several characters answer to the same short name: guessing would be wrong.
    if (matches.length > 1) {
      ambiguous += 1;
      return { ...character };
    }

    const match = matches[0];
    // AniList knows the character but carries no portrait for it.
    if (!hasImage(match)) {
      notFound += 1;
      return { ...character };
    }

    filled += 1;
    return { ...character, image: match.image };
  });

  return { characters: result, filled, ambiguous, notFound };
};

/** Only linked anime works can be asked for characters at all. */
const hasLinkedAnime = (item: MediaItem): boolean =>
  item.aiData.mediaType === 'Anime' && Number.isFinite(item.aiData.anilist?.id);

const needsCharacterImages = (item: MediaItem): boolean =>
  hasLinkedAnime(item) &&
  (item.trackingData.favoriteCharacters ?? []).some(character => !hasImage(character));

/**
 * Fills missing character photos for the whole library, one work at a time.
 *
 * Every work is re-read through `read` after its request, so a run that lasts
 * seconds can never overwrite an edit made meanwhile nor resurrect a work the
 * user deleted. Never throws: a single bad work is counted and skipped.
 */
export async function runCharacterImageBackfill(
  options: CharacterImageBackfillOptions,
): Promise<CharacterImageBackfillSummary> {
  const { items, onProgress, shouldStop } = options;
  const fetchCharacters = options.fetchCharacters ?? fetchMediaCharacters;
  const persist = options.persist ?? (() => undefined);
  const read = options.read ?? ((id: string) => items.find(item => item.id === id));

  const summary: CharacterImageBackfillSummary = {
    worksConsidered: 0,
    requests: 0,
    filled: 0,
    ambiguous: 0,
    notFound: 0,
    failed: 0,
    cancelled: false,
  };

  const notify = (current?: string): void => {
    // A copy is mandatory: React/Zustand compare references on every update.
    onProgress?.({ ...summary }, current);
  };

  try {
    const works = items.filter(needsCharacterImages);
    summary.worksConsidered = works.length;

    // Nothing to ask for: no request, no progress spam.
    if (works.length === 0) return summary;

    notify();

    for (const snapshot of works) {
      if (shouldStop?.()) {
        summary.cancelled = true;
        break;
      }

      const mediaId = snapshot.aiData.anilist?.id;
      if (typeof mediaId !== 'number' || !Number.isFinite(mediaId)) {
        notify(snapshot.aiData.title);
        continue;
      }

      summary.requests += 1;

      let candidates: AniListCharacter[];
      try {
        candidates = await fetchCharacters(mediaId);
      } catch {
        // One unreachable work must not abort the rest of the run.
        summary.failed += 1;
        notify(snapshot.aiData.title);
        continue;
      }

      // Re-read AFTER the request: the snapshot taken when the run started is
      // stale by now, and writing it back would discard edits or revive a
      // deleted work.
      const live = read(snapshot.id);
      if (!live) {
        notify(snapshot.aiData.title);
        continue;
      }

      const report = matchCharacterImages(live.trackingData.favoriteCharacters ?? [], candidates);
      const title = live.aiData.title || snapshot.aiData.title;

      summary.filled += report.filled;
      summary.ambiguous += report.ambiguous;
      summary.notFound += report.notFound;

      // Untouched works are never written: no redundant save on the whole library.
      if (report.filled > 0) {
        try {
          await persist({
            ...live,
            trackingData: { ...live.trackingData, favoriteCharacters: report.characters },
          });
        } catch {
          summary.failed += 1;
        }
      }

      notify(title);
    }

    return summary;
  } catch {
    // Defensive: the contract is "never throws", whatever the caller injects.
    return summary;
  }
}
