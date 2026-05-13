import { describe, it, expect } from 'vitest';
import { useUIStore } from '../useUIStore';

describe('useUIStore', () => {
  it('has correct initial state', () => {
    const state = useUIStore.getState();
    expect(state.isImmersiveMode).toBe(false);
    expect(state.isBottomNavVisible).toBe(true);
    expect(state.showScrollTop).toBe(false);
    expect(state.isSettingsOpen).toBe(false);
    expect(state.isManualTypeSelectorOpen).toBe(false);
    expect(state.libraryViewMode).toBe('grid');
  });

  it('setImmersiveMode updates state', () => {
    useUIStore.getState().setImmersiveMode(true);
    expect(useUIStore.getState().isImmersiveMode).toBe(true);

    useUIStore.getState().setImmersiveMode(false);
    expect(useUIStore.getState().isImmersiveMode).toBe(false);
  });

  it('toggleLibraryViewMode toggles between grid and catalog', () => {
    // Reset to grid
    useUIStore.setState({ libraryViewMode: 'grid' });

    useUIStore.getState().toggleLibraryViewMode();
    expect(useUIStore.getState().libraryViewMode).toBe('catalog');

    useUIStore.getState().toggleLibraryViewMode();
    expect(useUIStore.getState().libraryViewMode).toBe('grid');
  });

  it('setBottomNavVisible updates state', () => {
    useUIStore.getState().setBottomNavVisible(false);
    expect(useUIStore.getState().isBottomNavVisible).toBe(false);

    useUIStore.getState().setBottomNavVisible(true);
    expect(useUIStore.getState().isBottomNavVisible).toBe(true);
  });

  it('setShowScrollTop updates state', () => {
    useUIStore.getState().setShowScrollTop(true);
    expect(useUIStore.getState().showScrollTop).toBe(true);

    useUIStore.getState().setShowScrollTop(false);
    expect(useUIStore.getState().showScrollTop).toBe(false);
  });
});
