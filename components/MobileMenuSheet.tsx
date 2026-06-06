
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  LogOut, Settings, X
} from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useAuthStore } from '../stores/useAuthStore';

export const MobileMenuSheet: React.FC = () => {
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

      {/* Sheet slides down from top */}
      <div className="absolute top-4 left-3 right-3 bg-[#111113] ring-1 ring-white/[0.10] rounded-3xl shadow-2xl animate-slide-down p-3">
        <div className="flex items-center justify-between px-3 py-2">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{username}</h2>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/[0.06] rounded-full transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1 mt-1">
          <button
            onClick={handleSettings}
            className="flex items-center gap-3 p-3 rounded-2xl font-bold text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <Settings className="w-5 h-5 text-zinc-500" />
            <span className="uppercase tracking-wider">Configuración</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-3 rounded-2xl font-bold text-sm text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="uppercase tracking-wider">Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
