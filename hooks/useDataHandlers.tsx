import { useCallback } from 'react';
import { saveMediaItem, clearLibrary as clearLib, saveUserProfile } from '../services/storage';
import { useAuthStore } from '../stores/useAuthStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useToast } from '../context/ToastContext';
import { UserProfile, MediaItem } from '../types';
import {
  parseBackupFile,
  parseCatalogFile,
  createBackupBlob,
  createCatalogBlob,
  downloadBlob,
} from '../services/backup';

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

          // Check if it's a catalog (array) first
          if (parseCatalogFile(content)) {
            showToast("Esto parece un Catálogo. Usa la opción 'Importar Catálogo' en Ajustes.", "warning");
            setRestoring(false);
            return;
          }

          const parsed = parseBackupFile(content);
          if (parsed) {
            await saveUserProfile(parsed.profile);
            await clearLib();
            for (const item of parsed.library) {
              await saveMediaItem(item);
            }
            await useAuthStore.getState().updateProfile(parsed.profile as UserProfile);
            await loadLibrary();
            showToast("Copia de seguridad restaurada exitosamente", "success");
          } else {
            showToast("Formato de archivo no reconocido. Asegúrate de que es un backup válido.", "error");
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
    const blob = createBackupBlob(userProfile, library);
    downloadBlob(blob, `mediatracker_backup_${new Date().toISOString().split('T')[0]}.json`);
  }, [userProfile, library]);

  const handleImportCatalog = useCallback(async (file: File) => {
    setRestoring(true);
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = parseCatalogFile(content);
          if (parsed) {
            const existingIds = new Set(library.map(i => i.id));
            const count = await useLibraryStore.getState().importItems(parsed, existingIds);
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
    const blob = createCatalogBlob(library);
    downloadBlob(blob, `mediatracker_catalog_${new Date().toISOString().split('T')[0]}.json`);
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
