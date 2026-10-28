import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { useFocusTrap } from '../useFocusTrap';

const Harness: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const ref = useFocusTrap<HTMLDivElement>(true, onClose);
  return (
    <div ref={ref}>
      <button type="button">first</button>
      <input aria-label="field" />
    </div>
  );
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 80));

describe('useFocusTrap', () => {
  it('keeps focus where the user put it when the parent re-renders', async () => {
    // Call sites pass an inline arrow, so onClose is a new function on every
    // render. Treating that identity as a reason to rebuild the trap re-focused
    // the first element 50 ms later, which made typing inside a dialog lose the
    // field on each keystroke.
    const { rerender, getByLabelText, getByText } = render(<Harness onClose={() => {}} />);
    await act(settle);

    const input = getByLabelText('field') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    rerender(<Harness onClose={() => {}} />);
    await act(settle);

    expect(document.activeElement).toBe(input);
    expect(document.activeElement).not.toBe(getByText('first'));
  });

  it('calls the most recent onClose on Escape', async () => {
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = render(<Harness onClose={first} />);
    await act(settle);

    rerender(<Harness onClose={second} />);
    await act(settle);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
