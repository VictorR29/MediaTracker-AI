import { describe, it, expect, vi } from 'vitest';
import type { MediaItem } from '../../types';
import { runTvmazeBackfill } from '../tvmazeBackfill';
import { TvmazeError } from '../tvmazeService';
import type { TvmazeMatch } from '../tvmazeService';

// --- Fixtures -----------------------------------------------------------------

interface ItemFixture {
  id: string;
  title: string;
  mediaType?: MediaItem['aiData']['mediaType'];
  status?: MediaItem['trackingData']['status'];
  coverImage?: string;
  tvmazeId?: number;
}

const makeItem = (fixture: ItemFixture): MediaItem => ({
  id: fixture.id,
  createdAt: 0,
  aiData: {
    title: fixture.title,
    mediaType: fixture.mediaType ?? 'Serie',
    synopsis: 'Sinopsis no disponible.',
    genres: [],
    status: 'Desconocido',
    totalContent: 'inventado por gemini',
    coverDescription: '',
    coverImage: fixture.coverImage ?? '',
    tvmaze: fixture.tvmazeId !== undefined ? { id: fixture.tvmazeId } : undefined,
  },
  trackingData: {
    status: fixture.status ?? 'Viendo/Leyendo',
    currentSeason: 1,
    totalSeasons: 1,
    watchedEpisodes: 0,
    totalEpisodesInSeason: 10,
    emotionalTags: [],
    favoriteCharacters: [],
    rating: '',
    comment: '',
  },
});

const makeMatch = (id: number, name = 'El Marginal'): TvmazeMatch => ({
  id,
  name,
  genres: ['Drama'],
  image: `https://static.tvmaze.com/${id}.jpg`,
  status: 'En emisión',
  premiered: '2016-06-02',
  totalEpisodes: 43,
  seasons: 5,
});

/** Minimal in-memory library so the run can be repeated exactly like the store. */
const makeStore = (items: MediaItem[]) => {
  const store = new Map(items.map(item => [item.id, item]));
  return {
    items: () => [...store.values()],
    persist: async (item: MediaItem) => {
      store.set(item.id, item);
    },
    read: (id: string) => store.get(id),
  };
};

// --- Selection ----------------------------------------------------------------

describe('runTvmazeBackfill selection', () => {
  it('hydrates Series without a TVmaze id regardless of an existing cover', async () => {
    const store = makeStore([
      makeItem({ id: 'candidate', title: 'El Marginal' }),
      makeItem({ id: 'covered', title: 'Okupas', coverImage: 'https://user.example/cover.jpg' }),
      makeItem({ id: 'linked', title: 'Los Simuladores', tvmazeId: 99 }),
      makeItem({ id: 'dropped', title: 'División Palermo', status: 'Descartado' }),
      makeItem({ id: 'movie', title: 'El Aura', mediaType: 'Pelicula' }),
    ]);

    const resolve = vi.fn(async (title: string) => makeMatch(22557, title));

    const summary = await runTvmazeBackfill({
      items: store.items(),
      persist: store.persist,
      read: store.read,
      deps: { resolve },
    });

    expect(summary.total).toBe(2);
    expect(summary.matched).toBe(2);
    expect(summary.failed).toBe(0);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenCalledWith('El Marginal');
    expect(resolve).toHaveBeenCalledWith('Okupas');

    const hydrated = store.read('candidate');
    expect(hydrated?.aiData.tvmaze).toEqual({ id: 22557 });
    expect(hydrated?.aiData.coverImage).toBe('https://static.tvmaze.com/22557.jpg');
    expect(hydrated?.aiData.status).toBe('En emisión');

    // A user cover survives, but the identity and status are still filled.
    const covered = store.read('covered');
    expect(covered?.aiData.coverImage).toBe('https://user.example/cover.jpg');
    expect(covered?.aiData.tvmaze).toEqual({ id: 22557 });
    expect(covered?.aiData.status).toBe('En emisión');

    // Nothing else was touched.
    expect(store.read('linked')?.aiData.coverImage).toBe('');
    expect(store.read('dropped')?.aiData.tvmaze).toBeUndefined();
    expect(store.read('movie')?.aiData.tvmaze).toBeUndefined();
  });

  it('performs exactly one request per item and needs no detail dependency', async () => {
    const store = makeStore([
      makeItem({ id: 'a', title: 'El Marginal' }),
      makeItem({ id: 'b', title: 'Okupas', coverImage: 'https://user.example/cover.jpg' }),
    ]);

    const resolve = vi.fn(async (title: string) => makeMatch(title === 'Okupas' ? 2 : 1, title));

    const summary = await runTvmazeBackfill({
      items: store.items(),
      persist: store.persist,
      read: store.read,
      // No `fetchDetail` is accepted anymore: the type only allows `resolve`.
      deps: { resolve },
    });

    expect(summary.matched).toBe(2);
    expect(resolve).toHaveBeenCalledTimes(2);
  });
});

// --- Outcomes -----------------------------------------------------------------

describe('runTvmazeBackfill outcomes', () => {
  it('counts a miss as failed and leaves the item untouched', async () => {
    const store = makeStore([makeItem({ id: 'miss', title: 'Serie Inexistente' })]);

    const summary = await runTvmazeBackfill({
      items: store.items(),
      persist: store.persist,
      read: store.read,
      deps: { resolve: async () => null },
    });

    expect(summary.total).toBe(1);
    expect(summary.matched).toBe(0);
    expect(summary.unmatched).toBe(0);
    expect(summary.failed).toBe(1);
    expect(summary.aborted).toBe(false);
    expect(store.read('miss')?.aiData.tvmaze).toBeUndefined();
  });

  it('is idempotent: a second run has nothing left to do', async () => {
    const store = makeStore([makeItem({ id: 'a', title: 'El Marginal' }), makeItem({ id: 'b', title: 'Okupas' })]);

    const resolve = vi.fn(async (title: string) => makeMatch(title === 'Okupas' ? 2 : 1, title));
    const deps = { resolve };

    const first = await runTvmazeBackfill({ items: store.items(), persist: store.persist, read: store.read, deps });
    expect(first.total).toBe(2);
    expect(first.matched).toBe(2);
    expect(resolve).toHaveBeenCalledTimes(2);

    const second = await runTvmazeBackfill({ items: store.items(), persist: store.persist, read: store.read, deps });
    expect(second.total).toBe(0);
    expect(second.matched).toBe(0);
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('aborts on a 429 without hammering the API', async () => {
    const store = makeStore([
      makeItem({ id: 'a', title: 'El Marginal' }),
      makeItem({ id: 'b', title: 'Okupas' }),
    ]);

    const summary = await runTvmazeBackfill({
      items: store.items(),
      persist: store.persist,
      read: store.read,
      deps: {
        resolve: async () => {
          throw new TvmazeError('rate limited', 429);
        },
      },
    });

    expect(summary.aborted).toBe(true);
    expect(summary.abortReason).toBe('rate_limit');
    // The aborted item is not counted as failed: the run stops before writing.
    expect(summary.failed).toBe(0);
    expect(summary.done).toBe(0);
  });

  it('stops when the caller cancels', async () => {
    const store = makeStore([makeItem({ id: 'a', title: 'El Marginal' })]);

    const summary = await runTvmazeBackfill({
      items: store.items(),
      persist: store.persist,
      read: store.read,
      shouldStop: () => true,
      deps: { resolve: async () => makeMatch(1) },
    });

    expect(summary.aborted).toBe(true);
    expect(summary.abortReason).toBe('cancelled');
    expect(summary.done).toBe(0);
  });

  it('never writes an item deleted while the run was in flight', async () => {
    const persist = vi.fn(async () => undefined);

    const summary = await runTvmazeBackfill({
      items: [makeItem({ id: 'gone', title: 'El Marginal' })],
      persist,
      read: () => undefined,
      deps: { resolve: async () => makeMatch(1) },
    });

    expect(persist).not.toHaveBeenCalled();
    expect(summary.matched).toBe(0);
  });
});
