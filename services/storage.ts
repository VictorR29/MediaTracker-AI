import { MediaItem, UserProfile } from '../types';

const DB_NAME = 'MediaTrackerDB';
const DB_VERSION = 1;
const STORE_LIBRARY = 'library';
const STORE_SETTINGS = 'settings';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = (event) => {
      resolve(request.result);
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

export const getLibrary = async (): Promise<MediaItem[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_LIBRARY], 'readonly');
    const store = transaction.objectStore(STORE_LIBRARY);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by createdAt desc by default
      const items = (request.result as MediaItem[]).sort((a, b) => b.createdAt - a.createdAt);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
};