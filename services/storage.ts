
import { MediaItem, UserProfile } from '../types';

const DB_NAME = 'MediaTrackerDB';
const DB_VERSION = 1;
const STORE_LIBRARY = 'library';
const STORE_SETTINGS = 'settings';

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  // Return existing connection if still open
  if (dbInstance && !dbInstance.closed) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = (event) => {
      dbInstance = request.result;
      // Clean up reference if the connection closes unexpectedly
      dbInstance.onclose = () => { dbInstance = null; };
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_LIBRARY)) {
        db.createObjectStore(STORE_LIBRARY, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS); // Key-value store
      }
    };
  });
};

export const closeDB = (): void => {
  if (dbInstance && !dbInstance.closed) {
    dbInstance.close();
    dbInstance = null;
  }
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SETTINGS], 'readwrite');
    const store = transaction.objectStore(STORE_SETTINGS);
    const request = store.put(profile, 'profile');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getUserProfile = async (): Promise<UserProfile | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SETTINGS], 'readonly');
    const store = transaction.objectStore(STORE_SETTINGS);
    const request = store.get('profile');

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const saveMediaItem = async (item: MediaItem): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_LIBRARY], 'readwrite');
    const store = transaction.objectStore(STORE_LIBRARY);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteMediaItem = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_LIBRARY], 'readwrite');
    const store = transaction.objectStore(STORE_LIBRARY);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearLibrary = async (): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_LIBRARY], 'readwrite');
    const store = transaction.objectStore(STORE_LIBRARY);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getLibrary = async (): Promise<MediaItem[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_LIBRARY], 'readonly');
    const store = transaction.objectStore(STORE_LIBRARY);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = (request.result as MediaItem[]).sort((a, b) => b.createdAt - a.createdAt);
      
      // Migration: Convert old string[] favoriteCharacters to new object[] format
      const migratedItems = items.map(item => {
        if (item.trackingData?.favoriteCharacters) {
          const chars = item.trackingData.favoriteCharacters;
          // Check if it's the old string format
          if (chars.length > 0 && typeof chars[0] === 'string') {
            return {
              ...item,
              trackingData: {
                ...item.trackingData,
                favoriteCharacters: (chars as any[]).map(name => ({ name, image: undefined })),
              },
            };
          }
        }
        return item;
      });
      
      resolve(migratedItems);
    };
    request.onerror = () => reject(request.error);
  });
};
