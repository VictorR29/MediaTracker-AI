import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));
const { refreshSerieFromTvmaze } = vi.hoisted(() => ({ refreshSerieFromTvmaze: vi.fn() }));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('../../services/geminiService', () => ({
  updateMediaInfo: vi.fn(),
  generateReviewSummary: vi.fn(),
}));

// Only the network call is stubbed: the card's own merge is what this covers.
vi.mock('../../services/tvmazeService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/tvmazeService')>();
  return { ...actual, refreshSerieFromTvmaze };
});

import { MediaCard } from '../MediaCard';
import type { MediaItem } from '../../types';

const serie: MediaItem = {
  id: 'serie-1',
  aiData: {
    title: 'El Marginal',
    mediaType: 'Serie',
    synopsis: '',
    genres: ['Drama'],
    status: 'En emisión',
    totalContent: '1 Temporada inventada',
    coverDescription: '',
    coverImage: '',
    sourceUrls: [],
    primaryColor: '#c084fc',
    tvmaze: { id: 22557 },
  },
  trackingData: {
    status: 'Sin empezar',
    currentSeason: 1,
    totalSeasons: 1,
    watchedEpisodes: 0,
    totalEpisodesInSeason: 0,
    is_favorite: false,
    rating: '',
    emotionalTags: [],
    comment: '',
    customLinks: [],
    favoriteCharacters: [],
    recommendedBy: '',
  },
  createdAt: 1_000,
  lastInteraction: 2_000,
};

const renderCard = () => {
  const onUpdate = vi.fn();
  render(<MediaCard item={serie} onUpdate={onUpdate} />);
  return { onUpdate };
};

describe('MediaCard smart update', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('writes the season count the refresh reports into trackingData', async () => {
    // The service reports the structural diff; the card is what merges it into
    // the item. With @types/react absent, nothing but this test proves the merge
    // reaches trackingData and not only aiData.
    refreshSerieFromTvmaze.mockResolvedValueOnce({
      updatedData: { status: 'Finalizado', totalContent: '5 Temporadas · 43 Caps' },
      updatedTracking: { totalSeasons: 5 },
      hasChanges: true,
    });

    const { onUpdate } = renderCard();
    fireEvent.click(screen.getByText('ACTUALIZAR'));

    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));

    const written = onUpdate.mock.calls[0][0] as MediaItem;
    expect(written.trackingData.totalSeasons).toBe(5);
    expect(written.aiData.totalContent).toBe('5 Temporadas · 43 Caps');
    // The rest of the tracking state must survive the merge untouched.
    expect(written.trackingData.status).toBe('Sin empezar');
    expect(written.trackingData.watchedEpisodes).toBe(0);
  });

  it('leaves trackingData alone when the refresh only changed metadata', async () => {
    refreshSerieFromTvmaze.mockResolvedValueOnce({
      updatedData: { status: 'Finalizado' },
      hasChanges: true,
    });

    const { onUpdate } = renderCard();
    fireEvent.click(screen.getByText('ACTUALIZAR'));

    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));

    const written = onUpdate.mock.calls[0][0] as MediaItem;
    expect(written.trackingData).toEqual(serie.trackingData);
    expect(written.aiData.status).toBe('Finalizado');
  });

  it('hands the current progress to the refresh so it can tell a default from a choice', async () => {
    refreshSerieFromTvmaze.mockResolvedValueOnce({ updatedData: {}, hasChanges: false });

    renderCard();
    fireEvent.click(screen.getByText('ACTUALIZAR'));

    await vi.waitFor(() => expect(refreshSerieFromTvmaze).toHaveBeenCalledTimes(1));

    const [, tracking] = refreshSerieFromTvmaze.mock.calls[0];
    expect(tracking).toEqual(serie.trackingData);
  });

  it('reports when there was nothing to update', async () => {
    refreshSerieFromTvmaze.mockResolvedValueOnce({ updatedData: {}, hasChanges: false });

    renderCard();
    fireEvent.click(screen.getByText('ACTUALIZAR'));

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('Ya está actualizado', 'info'));
  });
});
