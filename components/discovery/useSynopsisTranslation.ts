import { useEffect, useRef, useState } from 'react';
import type { DeckCard } from './types';
import { translateSynopsis } from '../../services/synopsisTranslation';

/** Versioned key: bump it when the translation prompt changes meaningfully. */
export const SYNOPSIS_CACHE_KEY = 'mediatracker:synopsis-es:v1';

/** How many cards ahead of the visible one get translated. */
export const PREFETCH_AHEAD = 3;

/** Cap on persisted pairs, so the cache cannot grow forever. */
const MAX_CACHE_ENTRIES = 400;

export type SynopsisCache = Record<number, string>;

/**
 * Disk format is an array of [anilistId, translatedText] pairs, never an object:
 * JavaScript reorders integer-like object keys, so an object cannot preserve
 * age order and the 400-entry cap could not drop the oldest entries.
 */
type CachePair = [number, string];

/**
 * Chronological order of cached ids. `Record<number, string>` cannot carry
 * insertion order (numeric keys are sorted by the engine), so the order that
 * makes age-based pruning possible lives here and is rehydrated by reads.
 */
let cacheOrder: number[] = [];

const isCachePair = (value: unknown): value is CachePair => {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [id, text] = value;
  return typeof id === 'number' && Number.isFinite(id) && typeof text === 'string' && text.trim().length > 0;
};

const storage = (): Storage | null => {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    // Accessing localStorage itself throws in some privacy modes.
    return null;
  }
};

/**
 * Reads the persisted cache. Anything unreadable, unparsable, or shaped wrong
 * degrades to an empty cache instead of breaking the deck.
 */
export const readSynopsisCache = (): SynopsisCache => {
  const empty: SynopsisCache = {};
  try {
    const raw = storage()?.getItem(SYNOPSIS_CACHE_KEY);
    if (!raw) return empty;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return empty;

    const pairs = parsed.filter(isCachePair).slice(-MAX_CACHE_ENTRIES);
    const cache: SynopsisCache = {};
    cacheOrder = [];
    for (const [id, text] of pairs) {
      cache[id] = text;
      if (!cacheOrder.includes(id)) cacheOrder.push(id);
    }
    return cache;
  } catch {
    return empty;
  }
};

/**
 * Persists the cache, keeping the newest {@link MAX_CACHE_ENTRIES} entries.
 * A full quota or a blocked storage silently leaves the state in memory only.
 */
export const writeSynopsisCache = (cache: SynopsisCache): void => {
  try {
    const target = storage();
    if (!target) return;

    const ids = Object.keys(cache)
      .map(Number)
      .filter(id => Number.isFinite(id) && typeof cache[id] === 'string' && cache[id].trim().length > 0);

    // Known ids keep their age order; ids seen for the first time go last.
    const ordered = cacheOrder.filter(id => ids.includes(id));
    for (const id of ids) {
      if (!ordered.includes(id)) ordered.push(id);
    }

    // Keep the full order in memory: pruning it here would make the next write
    // re-append the dropped (oldest) ids at the tail and evict the newest ones.
    cacheOrder = ordered;

    const pruned = ordered.slice(-MAX_CACHE_ENTRIES).map((id): CachePair => [id, cache[id]]);
    target.setItem(SYNOPSIS_CACHE_KEY, JSON.stringify(pruned));
  } catch {
    // Private mode, quota exceeded, or a serialization failure: in-memory only.
  }
};

/**
 * Lazily translates the synopses of the cards around the visible one.
 *
 * Returns a map of `anilistId -> Spanish synopsis`. A missing id means "keep the
 * English text": the hook never surfaces loading or error states, so the card
 * is never blocked by a translation request.
 */
export const useSynopsisTranslation = (
  cards: DeckCard[],
  currentIndex: number,
  apiKey: string,
): SynopsisCache => {
  // Previous sessions may have translations cached: show those even without a key.
  const [translations, setTranslations] = useState<SynopsisCache>(() => readSynopsisCache());
  const translationsRef = useRef<SynopsisCache>(translations);
  const inFlight = useRef<Set<number>>(new Set());
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const key = typeof apiKey === 'string' ? apiKey.trim() : '';
    if (!key) return;

    const visible = cards.slice(currentIndex, currentIndex + PREFETCH_AHEAD);

    for (const card of visible) {
      if (card.kind !== 'anilist') continue;

      const source = typeof card.synopsis === 'string' ? card.synopsis.trim() : '';
      if (!source) continue;

      const id = card.anilistId;
      if (translationsRef.current[id] !== undefined) continue;
      if (inFlight.current.has(id)) continue;

      inFlight.current.add(id);

      translateSynopsis(source, key)
        .then(translated => {
          // `null` (unavailable, failed, or identical to the source) means English stays.
          if (!translated || !isMounted.current) return;
          if (translationsRef.current[id] !== undefined) return;

          const next: SynopsisCache = { ...translationsRef.current, [id]: translated };
          translationsRef.current = next;
          writeSynopsisCache(next);
          setTranslations(next);
        })
        .catch(() => {
          // The service never throws, but a rejected promise must not escape either.
        })
        .finally(() => {
          inFlight.current.delete(id);
        });
    }
  }, [cards, currentIndex, apiKey, translations]);

  return translations;
};
