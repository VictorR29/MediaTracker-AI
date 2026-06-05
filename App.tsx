import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Bookmark, PlusCircle, Compass, BarChart2,
  Search as SearchIcon, LogOut, Settings, User, ArrowUp
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
    setBottomNavVisible, setShowScrollTop, setLibraryScrollY
  } = useUIStore();
  const lastScrollYRef = useRef(0);

  // Custom hooks
  const { DeleteModal, requestDelete } = useDeleteConfirm(() => {
    if (location.pathname.startsWith('/item/')) navigate('/');
  });
  const dataHandlers = useDataHandlers();

  // Local state (search-only, doesn't belong in a store)
  const [isSearching, setIsSearching] = useState(false);

  // Init auth + library on mount
  useEffect(() => {
    initAuth().then(() => loadLibrary());
  }, []);

  // Scroll handling for bottom nav + scroll-top (ref-based to avoid re-render per pixel)
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setBottomNavVisible(!(currentScrollY > lastScrollYRef.current && currentScrollY > 100));
      setShowScrollTop(currentScrollY > 300);
      lastScrollYRef.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ─── Navigation helpers ─────────────────────────────────────────

  const handleOpenDetail = useCallback((item: MediaItem) => {
    setLibraryScrollY(window.scrollY);
    navigate(`/item/${item.id}`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [navigate, setLibraryScrollY]);

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
      navigate('/add', { state: { searchQuery: title, searchType: type, searchData: data } });
    } catch (e) {
      showToast("Error buscando recomendación", "error");
    } finally {
      setIsSearching(false);
    }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const currentPath = location.pathname;

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
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-violet-500/30">
      <LoadingOverlay isVisible={isRestoring} type="restore" />
      <LoadingOverlay isVisible={isSearching} type="search" />

      {/* Header */}
      {!isImmersiveMode && (
	<header className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] md:w-auto md:max-w-2xl z-40 bg-[#111113]/80 backdrop-blur-xl rounded-full ring-1 ring-white/[0.10] px-4 py-2 flex items-center justify-between shadow-[0_0_24px_rgba(139,92,246,0.08)]">
        <div className="flex items-center gap-3">
	<div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-tr from-violet-500 to-purple-500 p-0.5" style={{ boxShadow: '0 0 16px rgba(139,92,246,0.40)' }}>
            <div className="w-full h-full rounded-full bg-zinc-900 overflow-hidden">
              {userProfile?.avatarUrl ? <img src={userProfile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5" /></div>}
            </div>
          </div>
          <h1 className="font-bold text-white text-lg hidden lg:block">{userProfile?.username}'s Library</h1>
        </div>
        <nav className="hidden md:flex items-center gap-1">
          <DesktopNavLink icon={LayoutGrid} label="Biblioteca" active={currentPath === '/' || currentPath.startsWith('/item/')} onClick={() => handleNavClick('/')} />
          <DesktopNavLink icon={Bookmark} label="Deseos" active={currentPath === '/wishlist'} onClick={() => handleNavClick('/wishlist')} />
          <DesktopNavLink icon={PlusCircle} label="Añadir" active={currentPath === '/add'} onClick={() => handleNavClick('/add')} />
          <DesktopNavLink icon={Compass} label="Descubrir" active={currentPath === '/discover'} onClick={() => handleNavClick('/discover')} />
          <DesktopNavLink icon={BarChart2} label="Stats" active={currentPath === '/stats'} onClick={() => handleNavClick('/stats')} />
        </nav>
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={() => setSettingsOpen(true)} className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-full transition-colors"><Settings className="w-5 h-5" /></button>
          <button onClick={() => useAuthStore.getState().logout()} className="p-2 text-zinc-400 hover:text-red-400 hover:bg-white/[0.04] rounded-full transition-colors"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>
      )}

      {/* Main */}
      <main className={`pt-24 md:pt-24 pb-24 px-4 md:px-8 max-w-7xl mx-auto min-h-screen ${isImmersiveMode ? 'pt-0 px-0 max-w-none' : ''}`}>
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
        />
      </main>

      <DeleteModal />

      {/* Scroll To Top */}
      <button onClick={scrollToTop}
	className={`fixed right-4 md:right-8 z-40 bg-white text-zinc-900 p-3 rounded-full shadow-lg shadow-white/[0.15] ring-1 ring-white/[0.10] transition-transform duration-200 transform hover:scale-110 active:scale-95 flex items-center justify-center ${showScrollTop ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'} ${isBottomNavVisible && !isImmersiveMode ? 'bottom-20 md:bottom-8' : 'bottom-4 md:bottom-8'}`}
        aria-label="Volver arriba">
        <ArrowUp className="w-6 h-6" />
      </button>

      {/* Mobile Bottom Nav */}
      <nav className={`md:hidden fixed bottom-0 w-full bg-[#111113]/95 backdrop-blur-xl border-t border-white/[0.06] pb-safe pt-2 px-1 flex justify-around items-center z-40 transition-transform duration-200 ${isImmersiveMode || !isBottomNavVisible ? 'translate-y-full' : 'translate-y-0'}`}>
	<button onClick={() => handleNavClick('/')} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${currentPath === '/' || currentPath.startsWith('/item/') ? 'text-white' : 'text-zinc-500'} transition-colors duration-300 ease-spring`}><LayoutGrid className={`w-5 h-5 ${currentPath === '/' || currentPath.startsWith('/item/') ? 'drop-shadow-[0_0_6px_rgba(255,255,255,0.30)]' : ''}`} /><span className="text-[9px] font-bold">Biblio</span></button>
	<button onClick={() => handleNavClick('/wishlist')} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${currentPath === '/wishlist' ? 'text-white' : 'text-zinc-500'} transition-colors duration-300 ease-spring`}><Bookmark className={`w-5 h-5 ${currentPath === '/wishlist' ? 'drop-shadow-[0_0_6px_rgba(255,255,255,0.30)]' : ''}`} /><span className="text-[9px] font-bold">Deseos</span></button>
        <button onClick={() => handleNavClick('/add')} className="flex flex-col items-center gap-1 p-2 min-w-[60px]">
	<div className={`bg-white text-zinc-900 p-3 rounded-full -mt-8 shadow-lg ring-4 ring-[#09090B] shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-transform active:scale-95 ${currentPath === '/add' ? 'ring-2 ring-white/50' : ''}`}><PlusCircle className="w-6 h-6" /></div>
          <span className="text-[9px] font-bold opacity-0">Nuevo</span>
        </button>
	<button onClick={() => handleNavClick('/discover')} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${currentPath === '/discover' ? 'text-white' : 'text-zinc-500'} transition-colors duration-300 ease-spring`}><Compass className={`w-5 h-5 ${currentPath === '/discover' ? 'drop-shadow-[0_0_6px_rgba(255,255,255,0.30)]' : ''}`} /><span className="text-[9px] font-bold">Descubrir</span></button>
	<button onClick={() => handleNavClick('/stats')} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${currentPath === '/stats' ? 'text-white' : 'text-zinc-500'} transition-colors duration-300 ease-spring`}><BarChart2 className={`w-5 h-5 ${currentPath === '/stats' ? 'drop-shadow-[0_0_6px_rgba(255,255,255,0.30)]' : ''}`} /><span className="text-[9px] font-bold">Stats</span></button>
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
