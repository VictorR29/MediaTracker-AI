import { useCallback } from 'react';
import { saveMediaItem, deleteMediaItem, saveUserProfile, getLibrary } from '../services/storage';
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

/** Spanish success copy with singular/plural agreement for both counters. */
const restoredToast = (restored: number, skipped: number): string => {
  const restoredLabel = `${restored === 1 ? 'Restaurada' : 'Restauradas'} ${restored} ${restored === 1 ? 'obra' : 'obras'}`;
  if (skipped === 0) return restoredLabel;
  return `${restoredLabel} (${skipped} ${skipped === 1 ? 'omitida' : 'omitidas'})`;
};

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
          if (!parsed) {
            showToast("Formato de archivo no reconocido. Asegúrate de que es un backup válido.", "error");
            return;
          }

          // Shape validation already ran inside `parseBackupFile`; no storage
          // has been touched yet. From here the previous library is protected
          // by write-first ordering: every incoming item is persisted (upsert)
          // BEFORE anything the backup does not contain is deleted, so a quota
          // or write failure leaves the old data in place.
          //
          // The store is only a cache: after a failed load it is empty while
          // IndexedDB still holds the real library. The prune and the rollback
          // both start from the database, or a restore would merge instead of
          // replace and a rollback would have nothing to put back.
          let previousItems: MediaItem[];
          try {
            previousItems = await getLibrary();
          } catch (readError) {
            console.error('Backup restore aborted: the current library could not be read', readError);
            showToast("No se pudo leer tu biblioteca actual. La restauración se canceló sin modificar nada.", "error");
            return;
          }
          const previousIds = new Set(previousItems.map(i => i.id));
          const incomingIds = new Set(parsed.library.map(i => i.id));
          const writtenIds: string[] = [];

          try {
            for (const item of parsed.library) {
              await saveMediaItem(item);
              writtenIds.push(item.id);
            }
            await saveUserProfile(parsed.profile);
            await useAuthStore.getState().updateProfile(parsed.profile as UserProfile);
          } catch (writeError) {
            console.error("Backup restore failed; previous library preserved", writeError);
            // Roll back only what this import wrote: remove the entries that
            // did not exist before and put back the previous version of the
            // ones it overwrote. No `clear` ever ran, so nothing else is at risk.
            const previousById = new Map(previousItems.map(i => [i.id, i]));
            await Promise.all(
              writtenIds
                .filter(id => !previousIds.has(id))
                .map(id => deleteMediaItem(id).catch(() => undefined))
            );
            await Promise.all(
              writtenIds
                .filter(id => previousIds.has(id))
                .map(id => saveMediaItem(previousById.get(id)!).catch(() => undefined))
            );
            showToast("No se pudo restaurar la copia. Tu biblioteca anterior sigue intacta.", "error");
            return;
          }

          // Every incoming item is durable now: drop what the backup replaced.
          for (const item of previousItems) {
            if (!incomingIds.has(item.id)) {
              await deleteMediaItem(item.id).catch(() => undefined);
            }
          }

          await loadLibrary();
          showToast(restoredToast(parsed.library.length, parsed.skippedCount), "success");
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
            // Read the current library from IndexedDB, not from the store cache:
            // after a failed load the cache is empty while the database still
            // holds the real library, and treating every entry as new would
            // overwrite stored progress.
            let existingItems: MediaItem[];
            try {
              existingItems = await getLibrary();
            } catch {
              showToast("No se pudo leer la biblioteca. Importación cancelada.", "error");
              return;
            }

            const existingIds = new Set(existingItems.map(i => i.id));
            const count = await useLibraryStore.getState().importItems(parsed.items, existingIds);
            showToast(
              parsed.skippedCount > 0
                ? `Importadas ${count} obras nuevas (${parsed.skippedCount} omitidas)`
                : `Importadas ${count} obras nuevas`,
              "success"
            );
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
  }, [showToast, setRestoring]);

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
