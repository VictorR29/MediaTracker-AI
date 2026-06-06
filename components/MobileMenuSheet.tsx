
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Bookmark, PlusCircle, Compass, BarChart2,
  LogOut, Settings, X
} from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useAuthStore } from '../stores/useAuthStore';

const NAV_ITEMS = [
  { icon: LayoutGrid, label: 'Biblioteca', path: '/' },
  { icon: Bookmark, label: 'Deseos', path: '/wishlist' },
  { icon: PlusCircle, label: 'Añadir', path: '/add' },
  { icon: Compass, label: 'Descubrir', path: '/discover' },
  { icon: BarChart2, label: 'Stats', path: '/stats' },
] as const;

export const MobileMenuSheet: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobileMenuOpen, setMobileMenuOpen, setSettingsOpen } = useUIStore();
  const username = useAuthStore(s => s.userProfile?.username);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isMobileMenuOpen, setMobileMenuOpen]);

  if (!isMobileMenuOpen) return null;

  const handleNav = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
    if (path !== '/') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleSettings = () => {
    setMobileMenuOpen(false);
    setSettingsOpen(true);
  };

  const handleLogout = () => {
    setMobileMenuOpen(false);
    useAuthStore.getState().logout();
  };

  return createPortal(
    <div className="md:hidden fixed inset-0 z-[100] animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Sheet slides up from top */}
      <div className="absolute top-0 left-0 right-0 bg-[#111113] ring-1 ring-white/[0.10] rounded-b-3xl shadow-2xl animate-slide-down p-6 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">{username}'s Library</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Menú de navegación</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-full transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path ||
              (item.path === '/' && location.pathname.startsWith('/item/'));
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={`flex items-center gap-4 p-4 rounded-2xl font-bold text-base transition-all ${
                  active
                    ? 'bg-white/[0.08] text-white ring-1 ring-white/[0.10]'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-zinc-500'}`} />
                <span className="uppercase tracking-wider text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-6 pt-6 border-t border-white/[0.06] flex flex-col gap-1.5">
          <button
            onClick={handleSettings}
            className="flex items-center gap-4 p-4 rounded-2xl font-bold text-base text-zinc-400 hover:bg-white/[0.04] hover:text-white transition-all"
          >
            <Settings className="w-5 h-5 text-zinc-500" />
            <span className="uppercase tracking-wider text-sm">Configuración</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 p-4 rounded-2xl font-bold text-base text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="uppercase tracking-wider text-sm">Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
