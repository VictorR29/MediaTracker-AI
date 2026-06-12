import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Traps keyboard focus inside a container element.
 * - Focuses the first focusable element on mount
 * - Tab / Shift+Tab cycles through focusable elements
 * - Escape key calls onClose (if provided)
 * - Restores previous focus on unmount
 */
export function useFocusTrap<T extends HTMLElement>(
  isActive: boolean,
  onClose?: () => void
) {
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!containerRef.current) return;

      // Escape to close
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
        return;
      }

      // Tab trapping
      if (e.key !== 'Tab') return;

      const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if at first, go to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if at last, go to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isActive) return;

    // Save currently focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element in container (next frame to ensure DOM is ready)
    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }, 50);

    // Add keydown listener
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      // Restore previous focus
      if (previousFocusRef.current && previousFocusRef.current.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive, handleKeyDown]);

  return containerRef;
}
