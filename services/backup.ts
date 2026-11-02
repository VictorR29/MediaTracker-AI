import { UserProfile, MediaItem, UserTrackingData } from '../types';

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

/**
 * Reads a counter that came from a file, not from this app.
 *
 * JSON has no `NaN` or `Infinity` (both serialise to `null`), so the shapes that
 * actually arrive are strings, `null`, negatives and fractions. A string is not
 * rejected outright: `"12"` is a number someone wrote by hand, and turning it
 * into 12 keeps their data. Anything unparseable falls back.
 */
const countOr = (value: unknown, fallback: number): number => {
  const numeric = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
};

/**
 * Repairs the numeric tracking fields of an imported item.
 *
 * `isValidMediaItem` only proves the item is addressable and renderable, which
 * is all a gate should do — rejecting an entry over one bad counter would throw
 * the whole work away on restore. But letting the bad value through is not
 * harmless either: the stats screen totals consumption with
 * `watchedEpisodes + accumulated_consumption`, so a string turns that sum into
 * concatenation (`"12" + 3 === "123"`) and a `null` turns it into `NaN`. Both
 * poison every total silently, long after the import finished.
 *
 * So the shape gate stays strict about identity and this normalises what it let
 * through. Nothing is clamped to a plausible maximum: a 1200-chapter manhwa is
 * real, and a ceiling here would corrupt it.
 */
export const normalizeTrackingNumbers = (item: MediaItem): MediaItem => {
  const raw = item.trackingData as unknown as Record<string, unknown>;
  const accumulated = raw.accumulated_consumption;

  const trackingData: UserTrackingData = {
    ...item.trackingData,
    // A 1-based season index: a stored 0 or a missing value lands on season 1.
    currentSeason: countOr(raw.currentSeason, 1),
    // 0 is a legitimate value here — movies use it, and the progress logic reads
    // it as "length unknown" rather than "no seasons".
    totalSeasons: countOr(raw.totalSeasons, 0),
    watchedEpisodes: countOr(raw.watchedEpisodes, 0),
    totalEpisodesInSeason: countOr(raw.totalEpisodesInSeason, 0),
  };

  // Optional field: absent means "no archived history", and writing 0 there
  // would claim a value the item never had.
  if (accumulated !== undefined) {
    trackingData.accumulated_consumption = countOr(accumulated, 0);
  }

  return { ...item, trackingData };
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
        library.push(normalizeTrackingNumbers(entry));
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

export interface ParsedCatalog {
  items: MediaItem[];
  /** Entries dropped because they did not satisfy the minimum item shape. */
  skippedCount: number;
}

/** Parse a catalog JSON string (array of MediaItem). Returns null if invalid format. */
export const parseCatalogFile = (content: string): ParsedCatalog | null => {
  try {
    const json = JSON.parse(content);
    if (!Array.isArray(json)) return null;

    // Same gate as a backup restore: a catalog is a plain array, so a single
    // malformed entry would otherwise be persisted verbatim and crash the stats
    // screen the moment it reads trackingData.
    const items: MediaItem[] = [];
    let skippedCount = 0;
    for (const entry of json) {
      if (isValidMediaItem(entry)) {
        items.push(normalizeTrackingNumbers(entry));
      } else {
        skippedCount++;
      }
    }

    return { items, skippedCount };
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
