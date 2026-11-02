import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CharacterImageModal } from '../CharacterImageModal';

const setup = (overrides: Partial<React.ComponentProps<typeof CharacterImageModal>> = {}) => {
  const props = {
    characterName: 'Jinwoo',
    workTitle: 'Solo Leveling',
    onClose: vi.fn(),
    onSaveUrl: vi.fn(),
    onPickFile: vi.fn(),
    ...overrides,
  };
  const utils = render(<CharacterImageModal {...props} />);
  return { ...utils, props };
};

describe('CharacterImageModal', () => {
  it('renders nothing while no character is selected', () => {
    setup({ characterName: null });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('names the character and the work it belongs to', () => {
    setup();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Jinwoo/)).toBeTruthy();
    expect(screen.getByText(/Solo Leveling/)).toBeTruthy();
  });

  it('keeps Guardar disabled until a URL is typed, then trims it', () => {
    const { props } = setup();
    const save = screen.getByRole('button', { name: 'Guardar' });

    expect((save as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('URL de la imagen'), {
      target: { value: '  https://img.example/a.png  ' },
    });
    expect((save as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(save);
    expect(props.onSaveUrl).toHaveBeenCalledWith('https://img.example/a.png');
  });

  it('submits on Enter in the URL field', () => {
    const { props } = setup();
    const input = screen.getByLabelText('URL de la imagen');

    fireEvent.change(input, { target: { value: 'https://img.example/a.png' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onSaveUrl).toHaveBeenCalledWith('https://img.example/a.png');
  });

  it('starts the file picker before closing, so the caller still knows the target', () => {
    const order: string[] = [];
    const props = {
      onClose: vi.fn(() => order.push('close')),
      onPickFile: vi.fn(() => order.push('pick')),
    };
    render(<CharacterImageModal characterName="Jinwoo" {...props} />);

    fireEvent.click(screen.getByText('Subir archivo'));

    expect(order).toEqual(['pick', 'close']);
  });

  it('closes on Escape', () => {
    const { props } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not carry a half-typed URL into the next character', () => {
    const props = {
      onClose: vi.fn(),
      onSaveUrl: vi.fn(),
      onPickFile: vi.fn(),
    };
    const { rerender } = render(<CharacterImageModal characterName="Jinwoo" {...props} />);

    fireEvent.change(screen.getByLabelText('URL de la imagen'), {
      target: { value: 'https://img.example/jinwoo.png' },
    });

    rerender(<CharacterImageModal characterName="Cha Hae-In" {...props} />);

    expect((screen.getByLabelText('URL de la imagen') as HTMLInputElement).value).toBe('');
  });
});
