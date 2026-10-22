import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSynopsisTranslation } from '../useSynopsisTranslation';
import type { DeckCard } from '../types';

// The test lives one level deeper than the hook, hence the extra `../`.
// `vi.mock` paths resolve relative to this file, not to the hook.
vi.mock('../../../services/synopsisTranslation', () => ({
  translateSynopsis: vi.fn(),
}));

import { translateSynopsis } from '../../../services/synopsisTranslation';

const mockedTranslate = vi.mocked(translateSynopsis);

const ENGLISH =
  'A young ninja seeks recognition from his peers and dreams of becoming the Hokage.';

const anilistCard = (anilistId: number, synopsis = ENGLISH): DeckCard => ({
  kind: 'anilist',
  anilistId,
  title: `Anime ${anilistId}`,
  mediaType: 'Anime',
  synopsis,
  reason: 'Recommended by fans',
  genres: ['Action'],
});

const aiCard = (title: string): DeckCard => ({
  kind: 'ai',
  title,
  mediaType: 'Anime',
  synopsis: 'An AI synopsis that is long enough to be translated.',
  reason: 'Because you like it',
});

/** Lets resolved promises and effects settle without asserting anything. */
const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  window.localStorage.clear();
  mockedTranslate.mockReset();
});

describe('useSynopsisTranslation', () => {
  it('translates the visible AniList card and exposes the Spanish text by id', async () => {
    mockedTranslate.mockResolvedValue('Un joven ninja busca el reconocimiento de sus pares.');

    const cards = [anilistCard(16498)];
    const { result } = renderHook(() => useSynopsisTranslation(cards, 0, 'test-key'));

    await waitFor(() => {
      expect(result.current[16498]).toBe('Un joven ninja busca el reconocimiento de sus pares.');
    });
    expect(mockedTranslate).toHaveBeenCalledWith(ENGLISH, 'test-key');
  });

  it('leaves the English text when the service resolves null', async () => {
    mockedTranslate.mockResolvedValue(null);

    const cards = [anilistCard(16498)];
    const { result } = renderHook(() => useSynopsisTranslation(cards, 0, 'test-key'));

    await waitFor(() => {
      expect(mockedTranslate).toHaveBeenCalledTimes(1);
    });
    await flush();

    expect(result.current[16498]).toBeUndefined();
  });

  it('does not call the service for AI cards', async () => {
    const cards = [aiCard('Some Anime'), aiCard('Another Anime')];
    renderHook(() => useSynopsisTranslation(cards, 0, 'test-key'));

    await flush();

    expect(mockedTranslate).not.toHaveBeenCalled();
  });

  it('does not call the service when the api key is blank', async () => {
    const cards = [anilistCard(16498)];
    renderHook(() => useSynopsisTranslation(cards, 0, '   '));

    await flush();

    expect(mockedTranslate).not.toHaveBeenCalled();
  });

  it('skips cards that are already cached', async () => {
    window.localStorage.setItem(
      'mediatracker:synopsis-es:v1',
      JSON.stringify([[16498, 'Sinopsis ya traducida']]),
    );

    const cards = [anilistCard(16498)];
    const { result } = renderHook(() => useSynopsisTranslation(cards, 0, 'test-key'));

    await waitFor(() => {
      expect(result.current[16498]).toBe('Sinopsis ya traducida');
    });
    await flush();

    expect(mockedTranslate).not.toHaveBeenCalled();
  });

  it('shows a cached translation even when there is no api key', () => {
    window.localStorage.setItem(
      'mediatracker:synopsis-es:v1',
      JSON.stringify([[16498, 'Sinopsis ya traducida']]),
    );

    const cards = [anilistCard(16498)];
    const { result } = renderHook(() => useSynopsisTranslation(cards, 0, ''));

    expect(result.current[16498]).toBe('Sinopsis ya traducida');
    expect(mockedTranslate).not.toHaveBeenCalled();
  });

  it('ignores a malformed cache instead of throwing', () => {
    window.localStorage.setItem('mediatracker:synopsis-es:v1', '{"16498":"no es un array"}');
    mockedTranslate.mockResolvedValue('Traducción nueva');

    const cards = [anilistCard(16498)];
    const { result } = renderHook(() => useSynopsisTranslation(cards, 0, 'test-key'));

    expect(result.current).toEqual({});

    return waitFor(() => {
      expect(result.current[16498]).toBe('Traducción nueva');
    });
  });

  it('persists new translations as an array of id/text pairs', async () => {
    mockedTranslate.mockResolvedValue('Sinopsis traducida');

    const cards = [anilistCard(16498)];
    const { result } = renderHook(() => useSynopsisTranslation(cards, 0, 'test-key'));

    await waitFor(() => {
      expect(result.current[16498]).toBe('Sinopsis traducida');
    });

    const raw = window.localStorage.getItem('mediatracker:synopsis-es:v1');
    expect(JSON.parse(raw ?? 'null')).toEqual([[16498, 'Sinopsis traducida']]);
  });

  it('keeps the translation in memory when writing to localStorage throws', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    mockedTranslate.mockResolvedValue('Sinopsis en memoria');

    const cards = [anilistCard(16498)];
    const { result } = renderHook(() => useSynopsisTranslation(cards, 0, 'test-key'));

    await waitFor(() => {
      expect(result.current[16498]).toBe('Sinopsis en memoria');
    });

    setItem.mockRestore();
  });
});
