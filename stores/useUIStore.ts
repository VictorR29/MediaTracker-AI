import { create } from 'zustand';

interface UIState {
  isImmersiveMode: boolean;
  isBottomNavVisible: boolean;
  showScrollTop: boolean;
  isSettingsOpen: boolean;
  isManualTypeSelectorOpen: boolean;
  libraryViewMode: 'grid' | 'catalog';
  libraryScrollY: number;
  lastOpenedItemId: string | null;
  setImmersiveMode: (v: boolean) => void;
  setBottomNavVisible: (v: boolean) => void;
  setShowScrollTop: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setManualTypeSelectorOpen: (v: boolean) => void;
  setLibraryScrollY: (y: number) => void;
  setLastOpenedItemId: (id: string | null) => void;
  toggleLibraryViewMode: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isImmersiveMode: false,
  isBottomNavVisible: true,
  showScrollTop: false,
  isSettingsOpen: false,
  isManualTypeSelectorOpen: false,
  libraryViewMode: 'grid',
  libraryScrollY: 0,
  lastOpenedItemId: null,

  setImmersiveMode: (v) => set({ isImmersiveMode: v }),
  setBottomNavVisible: (v) => set({ isBottomNavVisible: v }),
  setShowScrollTop: (v) => set({ showScrollTop: v }),
  setSettingsOpen: (v) => set({ isSettingsOpen: v }),
  setManualTypeSelectorOpen: (v) => set({ isManualTypeSelectorOpen: v }),
  setLibraryScrollY: (y) => set({ libraryScrollY: y }),
  setLastOpenedItemId: (id) => set({ lastOpenedItemId: id }),
  toggleLibraryViewMode: () => set(state => ({
    libraryViewMode: state.libraryViewMode === 'grid' ? 'catalog' : 'grid'
  })),
}));
