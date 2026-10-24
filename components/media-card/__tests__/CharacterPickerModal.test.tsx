import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CharacterPickerModal } from '../CharacterPickerModal';

// Paths resolve relative to this file, which lives one level below the modal.
vi.mock('../../../services/anilistService', () => ({
  fetchMediaCharacters: vi.fn(),
}));

vi.mock('../../../services/tvmazeService', () => ({
  fetchTvmazeCharacters: vi.fn(),
}));

import { fetchMediaCharacters } from '../../../services/anilistService';
import { fetchTvmazeCharacters } from '../../../services/tvmazeService';

const mockedFetchMediaCharacters = vi.mocked(fetchMediaCharacters);
const mockedFetchTvmazeCharacters = vi.mocked(fetchTvmazeCharacters);

const TVMAZE_CAST = [
  {
    id: 343249,
    name: 'Miguel Palacios / Pastor Peña',
    actor: 'Juan Minujín',
    image: 'https://static.tvmaze.com/uploads/character.jpg',
  },
  {
    id: 343250,
    name: 'Diosito',
    actor: 'Nicolás Furtado',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CharacterPickerModal', () => {
  it('renders the TVmaze source with the actor on the second line', async () => {
    mockedFetchTvmazeCharacters.mockResolvedValue(TVMAZE_CAST);

    render(
      <CharacterPickerModal
        itemId="item-1"
        tvmazeId={22557}
        existing={[]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('Reparto de TVmaze')).toBeTruthy();
    expect(await screen.findByText('Miguel Palacios / Pastor Peña')).toBeTruthy();
    expect(screen.getByText('Juan Minujín')).toBeTruthy();
    expect(screen.getByText('Diosito')).toBeTruthy();
    expect(screen.getByText('Nicolás Furtado')).toBeTruthy();
    expect(mockedFetchTvmazeCharacters).toHaveBeenCalledWith(22557);
    expect(mockedFetchMediaCharacters).not.toHaveBeenCalled();
  });

  it('confirms the selected character with its name and image', async () => {
    mockedFetchTvmazeCharacters.mockResolvedValue(TVMAZE_CAST);
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <CharacterPickerModal
        itemId="item-1"
        tvmazeId={22557}
        existing={[]}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Miguel Palacios / Pastor Peña' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar 1' }));

    expect(onConfirm).toHaveBeenCalledWith([
      {
        name: 'Miguel Palacios / Pastor Peña',
        image: 'https://static.tvmaze.com/uploads/character.jpg',
      },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables a character that is already a favourite and shows the badge', async () => {
    mockedFetchTvmazeCharacters.mockResolvedValue(TVMAZE_CAST);

    render(
      <CharacterPickerModal
        itemId="item-1"
        tvmazeId={22557}
        existing={[{ name: 'Miguel Palacios / Pastor Peña' }]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const alreadyAdded = (await screen.findByRole('button', { name: /Ya agregado/ })) as HTMLButtonElement;

    expect(alreadyAdded.disabled).toBe(true);
    expect(screen.getByText('Ya agregado')).toBeTruthy();
    // The non-added character stays selectable.
    expect((screen.getByRole('button', { name: 'Diosito' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps the AniList source and its native names', async () => {
    mockedFetchMediaCharacters.mockResolvedValue([
      {
        id: 1,
        name: 'Edward Elric',
        nativeName: 'エドワード・エルリック',
        image: 'https://s4.anilist.co/file/anilistcdn/character/large/1.jpg',
      },
    ]);

    render(
      <CharacterPickerModal
        itemId="item-2"
        anilistId={5114}
        existing={[]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('Personajes de AniList')).toBeTruthy();
    expect(await screen.findByText('Edward Elric')).toBeTruthy();
    expect(screen.getByText('エドワード・エルリック')).toBeTruthy();
    expect(mockedFetchMediaCharacters).toHaveBeenCalledWith(5114);
    expect(mockedFetchTvmazeCharacters).not.toHaveBeenCalled();
  });
});
