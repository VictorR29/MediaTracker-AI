import { create } from 'zustand';

interface UIState {
  isImmersiveMode: boolean;
  isBottomNavVisible: boolean;
  showScrollTop: boolean;
  isSettingsOpen: boolean;
  isManualTypeSelectorOpen: boolean;
  isMobileMenuOpen: boolean;
  libraryViewMode: 'grid' | 'catalog';
  libraryScrollY: number;
  lastOpenedItemId: string | null;
  lastActiveColor: string | null;
  setImmersiveMode: (v: boolean) => void;
  setBottomNavVisible: (v: boolean) => void;
  setShowScrollTop: (v) => void;
  setSettingsOpen: (v) => void;
  setManualTypeSelectorOpen: (v) => void;
  setMobileMenuOpen: (v) => void;
  setLibraryScrollY: (y) => void;
  setLastOpenedItemId: (id) => void;
  setLastActiveColor: (color) => void;
  toggleLibraryViewMode: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isImmersiveMode: false,
  isBottomNavVisible: true,
  showScrollTop: false,
  isSettingsOpen: false,
  isManualTypeSelectorOpen: false,
  isMobileMenuOpen: false,
  libraryViewMode: 'grid',
  libraryScrollY: 0,
  lastOpenedItemId: null,
  lastActiveColor: null,

  setImmersiveMode: (v) => set({ isImmersiveMode: v }),
  setBottomNavVisible: (v) => set({ isBottomNavVisible: v }),
  setShowScrollTop: (v) => set({ showScrollTop: v }),
  setSettingsOpen: (v) => set({ isSettingsOpen: v }),
  setManualTypeSelectorOpen: (v) => set({ isManualTypeSelectorOpen: v }),
  setMobileMenuOpen: (v) => set({ isMobileMenuOpen: v }),
  setLibraryScrollY: (y) => set({ libraryScrollY: y }),
  setLastOpenedItemId: (id) => set({ lastOpenedItemId: id }),
  setLastActiveColor: (color) => set({ lastActiveColor: color }),
  toggleLibraryViewMode: () => set(state => ({
    libraryViewMode: state.libraryViewMode === 'grid' ? 'catalog' : 'grid'
  })),
}));
