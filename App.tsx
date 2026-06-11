import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Bookmark, PlusCircle, Compass, BarChart2,
  Search as SearchIcon, LogOut, Settings, User, ArrowUp, MoreVertical
} from 'lucide-react';
import { useToast } from './context/ToastContext';
import { MediaItem } from './types';
import { saveMediaItem } from './services/storage';
import { searchMediaInfo } from './services/geminiService';

import { useAuthStore } from './stores/useAuthStore';
import { useLibraryStore } from './stores/useLibraryStore';
import { useUIStore } from './stores/useUIStore';
import { incrementProgress, toggleFavorite } from './stores/useActions';
import { useDeleteConfirm } from './hooks/useDeleteConfirm';
import { useDataHandlers } from './hooks/useDataHandlers';

import { AppRouter } from './components/AppRouter';
import { SettingsModal } from './components/SettingsModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MobileMenuSheet } from './components/MobileMenuSheet';

// ─── Inner App (needs router context) ───────────────────────────────

const AppInner: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Stores
  const { userProfile, isAuthenticated, init: initAuth } = useAuthStore();
  const { library, loadLibrary, updateItem, addItem, isRestoring } = useLibraryStore();
const {
  isImmersiveMode, isBottomNavVisible, showScrollTop,
  isSettingsOpen, setSettingsOpen, setImmersiveMode,
  setBottomNavVisible, setShowScrollTop, setLibraryScrollY, setLastOpenedItemId,
  setMobileMenuOpen, lastActiveColor, setLastActiveColor
} = useUIStore();
  const lastScrollYRef = useRef(0);

  // Custom hooks
  const { DeleteModal, requestDelete } = useDeleteConfirm(() => {
    if (location.pathname.startsWith('/item/')) navigate('/');
  });
  const dataHandlers = useDataHandlers();

  // Local state (search-only, doesn't belong in a store)
  const [isSearching, setIsSearching] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  // Init auth + library on mount
  useEffect(() => {
    initAuth().then(() => loadLibrary());
  }, []);

  // Scroll handling for bottom nav + scroll-top + header visibility (ref-based to avoid re-render per pixel)
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setBottomNavVisible(!(currentScrollY > lastScrollYRef.current && currentScrollY > 100));
      setShowScrollTop(currentScrollY > 300);
      // Header: hide on scroll down, show on scroll up (after 100px threshold)
      if (currentScrollY > 100) {
        setIsHeaderVisible(currentScrollY < lastScrollYRef.current);
      } else {
        setIsHeaderVisible(true);
      }
      lastScrollYRef.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ─── Navigation helpers ─────────────────────────────────────────

const handleOpenDetail = useCallback((item: MediaItem) => {
  setLibraryScrollY(window.scrollY);
  setLastOpenedItemId(item.id);
  // Update last active color for bottom nav tint
  if (item.aiData?.primaryColor) {
    setLastActiveColor(item.aiData.primaryColor);
  }
  navigate(`/item/${item.id}`);
  window.scrollTo({ top: 0, behavior: 'instant' });
}, [navigate, setLibraryScrollY, setLastOpenedItemId, setLastActiveColor]);

  const handleNavClick = (targetPath: string) => {
    if (targetPath === '/') {
      // LibraryView will restore its saved scroll position on mount
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    navigate(targetPath);
  };

  // ─── CRUD / Actions ────────────────────────────────────────────

  const handleUpdateItem = async (updated: MediaItem) => {
    await saveMediaItem(updated);
    const exists = library.find(i => i.id === updated.id);
    if (!exists) addItem(updated); else updateItem(updated);
  };

  const handleIncrementProgress = useCallback((item: MediaItem) => {
    return incrementProgress(item, showToast, showToast);
  }, [showToast]);

  const handleToggleFavorite = useCallback((item: MediaItem) => {
    return toggleFavorite(item);
  }, []);

  const handleRecommendationSelect = async (title: string, type: string) => {
    navigate('/add');
    if (!userProfile?.apiKey) return;
    setIsSearching(true);
    try {
      const data = await searchMediaInfo(title, userProfile.apiKey, type);
      if (!data) {
        showToast(`Sin resultados para "${title}". Probá con el título original o agregalo manualmente.`, "error");
      }
      navigate('/add', { state: { searchQuery: title, searchType: type, searchData: data } });
    } catch (e) {
      showToast("Error buscando recomendación", "error");
    } finally {
      setIsSearching(false);
    }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const currentPath = location.pathname;

  // Convert lastActiveColor to rgb for inline styles
  const activeColorRgb = lastActiveColor ? lastActiveColor.replace('#', '').match(/.{2}/g)?.map(c => parseInt(c, 16)).join(',') : undefined;
  const activeColorHex = lastActiveColor || '#10B981'; // fallback to emerald

  // Check if we're on a detail view for dynamic tint
  const isDetailView = currentPath.startsWith('/item/');
  const detailItem = isDetailView ? library.find(i => i.id === currentPath.split('/')[2]) : null;
  const detailColor = detailItem?.aiData?.primaryColor;
  const detailRgb = detailColor ? detailColor.replace('#', '').match(/.{2}/g)?.map(c => parseInt(c, 16)).join(',') : undefined;

  // Desktop Nav Link
  const DesktopNavLink = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${active ? 'bg-white/[0.08] text-white' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'}`}>
      <Icon className={`w-4 h-4 ${active ? 'text-white' : ''}`} />{label}
    </button>
  );

  // Not authenticated → full-screen lock, no app chrome
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <AppRouter
          onOpenDetail={handleOpenDetail}
          onIncrementProgress={handleIncrementProgress}
          onToggleFavorite={handleToggleFavorite}
          onRequestDelete={requestDelete}
          onUpdateItem={handleUpdateItem}
          onRecommendationSelect={handleRecommendationSelect}
          onImportBackup={dataHandlers.handleImportBackup}
          isRestoring={isRestoring}
          onToggleImmersive={setImmersiveMode}
          onSearchingChange={setIsSearching}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-violet-500/30">
      <LoadingOverlay isVisible={isRestoring} type="restore" />
      <LoadingOverlay isVisible={isSearching} type="search" />

      {/* Header — Floating Glass Pill (auto-hide on scroll down) */}
      {!isImmersiveMode && (
        <div className="mt-4 flex justify-center px-4 md:px-6">
          <header
            className={`w-auto max-w-5xl z-40 rounded-full px-5 py-2.5 flex items-center justify-between gap-6 relative transition-transform duration-200 ease-spring ${isHeaderVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}`}
            style={{
              background: `linear-gradient(135deg, rgba(24,24,27,0.75) 0%, rgba(9,9,11,0.82) 100%)`,
              backdropFilter: 'blur(40px) saturate(1.8)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
              boxShadow: detailRgb
                ? `0 4px 24px rgba(0,0,0,0.35), inset 0 -1px 0 rgba(${detailRgb}, 0.18), 0 0 0 1px rgba(255,255,255,0.06)`
                : `0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)`,
            }}
          >
          {/* LEFT: Avatar + username */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 md:w-10 md:h-10 flex-shrink-0 rounded-full bg-gradient-to-tr from-violet-500 to-purple-500 p-0.5" style={{ boxShadow: '0 0 16px rgba(139,92,246,0.40)' }}>
              <div className="w-full h-full rounded-full bg-zinc-900 overflow-hidden">
                {userProfile?.avatarUrl ? <img src={userProfile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5" /></div>}
              </div>
            </div>
            <h1 className="font-bold text-white text-sm md:text-base truncate min-w-0">{userProfile?.username}</h1>
          </div>

          {/* CENTER (desktop only): Nav pills */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            <DesktopNavLink icon={LayoutGrid} label="Biblioteca" active={currentPath === '/' || currentPath.startsWith('/item/')} onClick={() => handleNavClick('/')} />
            <DesktopNavLink icon={Bookmark} label="Deseos" active={currentPath === '/wishlist'} onClick={() => handleNavClick('/wishlist')} />
            <DesktopNavLink icon={PlusCircle} label="Añadir" active={currentPath === '/add'} onClick={() => handleNavClick('/add')} />
            <DesktopNavLink icon={Compass} label="Descubrir" active={currentPath === '/discover'} onClick={() => handleNavClick('/discover')} />
            <DesktopNavLink icon={BarChart2} label="Stats" active={currentPath === '/stats'} onClick={() => handleNavClick('/stats')} />
          </nav>

          {/* RIGHT: Settings + Logout (desktop) / More (mobile) */}
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <button
              onClick={() => setSettingsOpen(true)}
              className="hidden md:flex p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-full transition-colors"
              title="Configuración"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => useAuthStore.getState().logout()}
              className="hidden md:flex p-2 text-zinc-400 hover:text-red-400 hover:bg-white/[0.06] rounded-full transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
            {/* Mobile: single "more" button that opens the menu sheet */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-full transition-colors"
              title="Menú"
              aria-label="Abrir menú"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </header>
        </div>
      )}

      {/* Main */}
      <main className={`pt-4 pb-24 px-4 md:px-8 max-w-7xl mx-auto min-h-screen ${isImmersiveMode ? 'pt-0 px-0 max-w-none' : ''}`}>
        <AppRouter
          onOpenDetail={handleOpenDetail}
          onIncrementProgress={handleIncrementProgress}
          onToggleFavorite={handleToggleFavorite}
          onRequestDelete={requestDelete}
          onUpdateItem={handleUpdateItem}
          onRecommendationSelect={handleRecommendationSelect}
          onImportBackup={dataHandlers.handleImportBackup}
          isRestoring={isRestoring}
          onToggleImmersive={setImmersiveMode}
          onSearchingChange={setIsSearching}
        />
      </main>

      <DeleteModal />
      <MobileMenuSheet />

      {/* Scroll To Top */}
      <button onClick={scrollToTop}
	className={`fixed right-4 md:right-8 z-40 bg-white text-zinc-900 p-3 rounded-full shadow-lg shadow-white/[0.15] ring-1 ring-white/[0.10] transition-transform duration-200 transform hover:scale-110 active:scale-95 flex items-center justify-center ${showScrollTop ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'} ${isBottomNavVisible && !isImmersiveMode ? 'bottom-20 md:bottom-8' : 'bottom-4 md:bottom-8'}`}
        aria-label="Volver arriba">
        <ArrowUp className="w-6 h-6" />
      </button>

      {/* Mobile Bottom Nav — Frosted Glass + Dynamic Tint */}
      <nav
        className={`md:hidden fixed bottom-0 w-full pb-safe pt-2 px-1 flex justify-around items-center z-40 transition-transform duration-200 ${isImmersiveMode || !isBottomNavVisible ? 'translate-y-full' : 'translate-y-0'}`}
        style={{
          background: `linear-gradient(to top, rgba(9,9,11,0.92) 0%, rgba(24,24,27,0.78) 100%)`,
          backdropFilter: 'blur(40px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
          borderTop: `1px solid rgba(${activeColorRgb || '16,185,129'},0.12)`,
          boxShadow: `0 -4px 24px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        {/* Biblioteca */}
        <button onClick={() => handleNavClick('/')} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${currentPath === '/' || currentPath.startsWith('/item/') ? 'text-white' : 'text-zinc-500'} transition-colors duration-300 ease-spring`}>
          <LayoutGrid
            className="w-5 h-5"
            style={currentPath === '/' || currentPath.startsWith('/item/')
              ? { filter: `drop-shadow(0 0 6px rgba(${activeColorRgb || '16,185,129'},0.50))` }
              : undefined}
          />
          <span className="text-[9px] font-bold">Biblio</span>
        </button>

        {/* Deseos */}
        <button onClick={() => handleNavClick('/wishlist')} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${currentPath === '/wishlist' ? 'text-white' : 'text-zinc-500'} transition-colors duration-300 ease-spring`}>
          <Bookmark
            className="w-5 h-5"
            style={currentPath === '/wishlist'
              ? { filter: `drop-shadow(0 0 6px rgba(${activeColorRgb || '16,185,129'},0.50))` }
              : undefined}
          />
          <span className="text-[9px] font-bold">Deseos</span>
        </button>

        {/* Añadir (+) */}
        <button onClick={() => handleNavClick('/add')} className="flex flex-col items-center gap-1 p-2 min-w-[60px]">
          <div
            className={`bg-white text-zinc-900 p-3 rounded-full -mt-8 ring-4 ring-[#09090B] transition-transform active:scale-95 ${currentPath === '/add' ? 'ring-white/50' : ''}`}
            style={{
              boxShadow: `0 0 20px rgba(${activeColorRgb || '16,185,129'},0.35), 0 0 40px rgba(${activeColorRgb || '16,185,129'},0.15), 0 8px 24px rgba(0,0,0,0.50)`
            }}>
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className="text-[9px] font-bold opacity-0">Nuevo</span>
        </button>

        {/* Descubrir */}
        <button onClick={() => handleNavClick('/discover')} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${currentPath === '/discover' ? 'text-white' : 'text-zinc-500'} transition-colors duration-300 ease-spring`}>
          <Compass
            className="w-5 h-5"
            style={currentPath === '/discover'
              ? { filter: `drop-shadow(0 0 6px rgba(${activeColorRgb || '16,185,129'},0.50))` }
              : undefined}
          />
          <span className="text-[9px] font-bold">Descubrir</span>
        </button>

        {/* Stats */}
        <button onClick={() => handleNavClick('/stats')} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${currentPath === '/stats' ? 'text-white' : 'text-zinc-500'} transition-colors duration-300 ease-spring`}>
          <BarChart2
            className="w-5 h-5"
            style={currentPath === '/stats'
              ? { filter: `drop-shadow(0 0 6px rgba(${activeColorRgb || '16,185,129'},0.50))` }
              : undefined}
          />
          <span className="text-[9px] font-bold">Stats</span>
        </button>
      </nav>

      {/* Settings */}
      {userProfile && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setSettingsOpen(false)}
          userProfile={userProfile}
          onUpdateProfile={async (p) => { await useAuthStore.getState().updateProfile(p); }}
          onImportBackup={dataHandlers.handleImportBackup}
          onExportBackup={dataHandlers.handleExportBackup}
          onImportCatalog={dataHandlers.handleImportCatalog}
          onExportCatalog={dataHandlers.handleExportCatalog}
          onClearLibrary={dataHandlers.handleClearLibrary}
          library={library}
          onLibraryUpdate={(newLib) => useLibraryStore.setState({ library: newLib })}
        />
      )}
    </div>
  );
};

// ─── Root App with providers ───────────────────────────────────────

const App: React.FC = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  </ErrorBoundary>
);

export default App;
