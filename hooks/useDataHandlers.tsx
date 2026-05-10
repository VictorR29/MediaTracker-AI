import { useState, useCallback } from 'react';
import { saveMediaItem, clearLibrary as clearLib, saveUserProfile } from '../services/storage';
import { useAuthStore } from '../stores/useAuthStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useToast } from '../context/ToastContext';
import { UserProfile, MediaItem } from '../types';

export const useDataHandlers = () => {
  const { showToast } = useToast();
  const { setRestoring } = useLibraryStore();
  const loadLibrary = useLibraryStore(s => s.loadLibrary);
  const library = useLibraryStore(s => s.library);
  const userProfile = useAuthStore(s => s.userProfile);

  const handleImportBackup = useCallback(async (file: File) => {
    setRestoring(true);
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          if (!content) throw new Error("Archivo vacío");
          const json = JSON.parse(content);

          if (Array.isArray(json)) {
            showToast("Esto parece un Catálogo. Usa la opción 'Importar Catálogo' en Ajustes.", "warning");
            setRestoring(false);
            return;
          }

          const profileData = json.profile || json.userProfile;
          if (profileData && (Array.isArray(json.library) || !json.library)) {
            const libraryItems = Array.isArray(json.library) ? json.library : [];
            await saveUserProfile(profileData);
            await clearLib();
            for (const item of libraryItems) {
              await saveMediaItem(item as MediaItem);
            }
            await useAuthStore.getState().updateProfile(profileData as UserProfile);
            await loadLibrary();
            showToast("Copia de seguridad restaurada exitosamente", "success");
          } else {
            if (!profileData) showToast("Archivo inválido: No se encontró el perfil de usuario.", "error");
            else showToast("Formato de archivo no reconocido.", "error");
          }
        } catch (err) {
          showToast("Error al leer el archivo. Asegúrate de que es un JSON válido.", "error");
        } finally {
          setRestoring(false);
        }
      };
      reader.onerror = () => { showToast("Error al leer el archivo", "error"); setRestoring(false); };
      reader.readAsText(file);
    }, 100);
  }, [showToast, setRestoring, loadLibrary]);

  const handleExportBackup = useCallback(() => {
    const data = { profile: userProfile, library, exportedAt: new Date().toISOString(), version: 1 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediatracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  }, [userProfile, library]);

  const handleImportCatalog = useCallback(async (file: File) => {
    setRestoring(true);
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (Array.isArray(json)) {
            const existingIds = new Set(library.map(i => i.id));
            const count = await useLibraryStore.getState().importItems(json as MediaItem[], existingIds);
            showToast(`Importadas ${count} obras nuevas`, "success");
          } else {
            showToast("Formato inválido. Se esperaba una lista (Array) de obras.", "error");
          }
        } catch (err) {
          showToast("Error al importar catálogo", "error");
        } finally {
          setRestoring(false);
        }
      };
      reader.readAsText(file);
    }, 100);
  }, [showToast, setRestoring, library]);

  const handleExportCatalog = useCallback(() => {
    const blob = new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediatracker_catalog_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  }, [library]);

  const handleClearLibrary = useCallback(async () => {
    await useLibraryStore.getState().clearLibrary();
  }, []);

  return {
    handleImportBackup,
    handleExportBackup,
    handleImportCatalog,
    handleExportCatalog,
    handleClearLibrary,
  };
};
