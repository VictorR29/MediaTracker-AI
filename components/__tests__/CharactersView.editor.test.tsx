import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast }),
}));

// The device boundary, not the logic under test: keep compression and the
// IndexedDB write out of jsdom so the test can assert which character was written.
vi.mock('../../utils/imageCompression', () => ({
  compressImage: async (image: string) => image,
}));

vi.mock('../../services/storage', () => ({
  saveMediaItem: vi.fn().mockResolvedValue(undefined),
  deleteMediaItem: vi.fn().mockResolvedValue(undefined),
  getLibrary: vi.fn().mockResolvedValue([]),
  getUserProfile: vi.fn().mockResolvedValue(null),
  saveUserProfile: vi.fn().mockResolvedValue(undefined),
  clearLibrary: vi.fn().mockResolvedValue(undefined),
  initDB: vi.fn().mockResolvedValue(undefined),
}));

import { CharactersView } from '../CharactersView';
import { useLibraryStore } from '../../stores/useLibraryStore';
import type { MediaItem } from '../../types';

const work: MediaItem = {
  id: 'work-1',
  aiData: {
    title: 'Solo Leveling',
    mediaType: 'Manhwa',
    synopsis: '',
    genres: ['Action'],
    status: 'Finalizado',
    totalContent: '179 capítulos',
    coverDescription: '',
    coverImage: '',
    sourceUrls: [],
    primaryColor: '#c084fc',
  },
  trackingData: {
    status: 'Completado',
    currentSeason: 1,
    totalSeasons: 1,
    watchedEpisodes: 179,
    totalEpisodesInSeason: 179,
    is_favorite: false,
    rating: '',
    emotionalTags: [],
    comment: '',
    customLinks: [],
    favoriteCharacters: [{ name: 'Jinwoo' }, { name: 'Cha Hae-In' }],
    recommendedBy: '',
  },
  createdAt: 1_000,
  lastInteraction: 2_000,
};

const renderView = () =>
  render(
    <MemoryRouter>
      <CharactersView library={[work]} />
    </MemoryRouter>,
  );

describe('CharactersView character editor', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    useLibraryStore.setState({ library: [work] });
  });

  it('opens the editor for the character whose card was clicked', () => {
    renderView();

    fireEvent.click(screen.getByLabelText('Cambiar imagen de Cha Hae-In'));

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Cha Hae-In');
    // The work title travels with it, so the dialog says which work it edits.
    expect(dialog.textContent).toContain('Solo Leveling');
  });

  it('writes the photo to the clicked character and not to the first one', async () => {
    renderView();

    fireEvent.click(screen.getByLabelText('Cambiar imagen de Cha Hae-In'));

    const save = screen.getByRole('button', { name: 'Guardar' });
    fireEvent.change(screen.getByLabelText('URL de la imagen'), {
      target: { value: 'data:image/webp;base64,AAA' },
    });
    fireEvent.click(save);

    await vi.waitFor(() =>
      expect(useLibraryStore.getState().library[0].trackingData.favoriteCharacters)
        .toEqual([
          { name: 'Jinwoo' },
          { name: 'Cha Hae-In', image: 'data:image/webp;base64,AAA' },
        ]),
    );
    expect(showToast).toHaveBeenCalledWith('Imagen del personaje actualizada', 'success');

    const written = useLibraryStore.getState().library[0].trackingData.favoriteCharacters;
    expect(written?.find((c) => c.name === 'Cha Hae-In')?.image).toBeTruthy();
    expect(written?.find((c) => c.name === 'Jinwoo')?.image).toBeUndefined();
  });
});
