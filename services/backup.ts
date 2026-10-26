import { UserProfile, MediaItem } from '../types';

/** Backup envelope version written by `createBackupBlob`. Anything else is refused. */
export const SUPPORTED_BACKUP_VERSION = 1;

export interface ParsedBackup {
  profile: UserProfile;
  library: MediaItem[];
  /** Entries dropped because they did not satisfy the minimum item shape. */
  skippedCount: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Minimum shape a library entry must satisfy before it may reach IndexedDB.
 * This is deliberately shallow: it proves the item is addressable (`id`), that
 * it can be rendered (`aiData.title`, `aiData.mediaType`) and that the tracking
 * fields the UI reads are an object. It is not a full schema validation.
 */
export const isValidMediaItem = (value: unknown): value is MediaItem => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id.trim() === '') return false;

  const aiData = value.aiData;
  if (!isRecord(aiData)) return false;
  if (typeof aiData.title !== 'string') return false;
  if (typeof aiData.mediaType !== 'string' || aiData.mediaType.trim() === '') return false;

  return isRecord(value.trackingData);
};

/** Parse a full backup JSON string (profile + library). Returns null if invalid format. */
export const parseBackupFile = (content: string): ParsedBackup | null => {
  try {
    const json = JSON.parse(content);
    if (Array.isArray(json)) return null; // That's a catalog, not a backup
    if (!isRecord(json)) return null;

    const profileData = json.profile || json.userProfile;
    if (!isRecord(profileData)) return null;
    // `username` is the identity the whole app keys off. A backup whose profile
    // lacks it would silently replace a working profile with a nameless one.
    if (typeof profileData.username !== 'string' || profileData.username.trim() === '') return null;
    if (json.library !== undefined && !Array.isArray(json.library)) return null;

    // A backup written by a newer build may carry fields this build cannot
    // interpret. Refuse it instead of restoring half of it.
    if (json.version !== undefined && json.version !== SUPPORTED_BACKUP_VERSION) return null;

    const rawLibrary: unknown[] = Array.isArray(json.library) ? json.library : [];
    const library: MediaItem[] = [];
    let skippedCount = 0;
    for (const entry of rawLibrary) {
      if (isValidMediaItem(entry)) {
        library.push(entry);
      } else {
        skippedCount++;
      }
    }

    return {
      profile: profileData as unknown as UserProfile,
      library,
      skippedCount,
    };
  } catch {
    return null;
  }
};

/** Parse a catalog JSON string (array of MediaItem). Returns null if invalid format. */
export const parseCatalogFile = (content: string): MediaItem[] | null => {
  try {
    const json = JSON.parse(content);
    if (!Array.isArray(json)) return null;
    return json as MediaItem[];
  } catch {
    return null;
  }
};

/** Create a backup Blob with profile, library, timestamp, and version. */
export const createBackupBlob = (profile: UserProfile | null, library: MediaItem[]): Blob => {
  const data = { profile, library, exportedAt: new Date().toISOString(), version: SUPPORTED_BACKUP_VERSION };
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
};

/** Create a catalog Blob (just the library array). */
export const createCatalogBlob = (library: MediaItem[]): Blob => {
  return new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' });
};

/** Trigger a browser download for the given blob. */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
