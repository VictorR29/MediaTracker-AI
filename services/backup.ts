import { UserProfile, MediaItem } from '../types';

export interface ParsedBackup {
  profile: UserProfile;
  library: MediaItem[];
}

/** Parse a full backup JSON string (profile + library). Returns null if invalid format. */
export const parseBackupFile = (content: string): ParsedBackup | null => {
  try {
    const json = JSON.parse(content);
    if (Array.isArray(json)) return null; // That's a catalog, not a backup

    const profileData = json.profile || json.userProfile;
    if (!profileData) return null;
    if (json.library !== undefined && !Array.isArray(json.library)) return null;

    return {
      profile: profileData as UserProfile,
      library: Array.isArray(json.library) ? (json.library as MediaItem[]) : [],
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
  const data = { profile, library, exportedAt: new Date().toISOString(), version: 1 };
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
