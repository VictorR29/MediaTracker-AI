import type { MediaItem } from '../types';

/** Opens the OS file picker and hands the chosen image to `onFile`. */
export function pickImageFile(onFile: (file: File) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) onFile(file);
  };
  input.click();
}

/**
 * Reads a file as a data URL.
 *
 * Rejects instead of resolving on a read error: the old callers used
 * `reader.onload` only, so a failed read left the card spinning with no toast.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('The file could not be read as a data URL.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Writes a character photo into the work that owns it.
 *
 * `characterName` identifies the character inside the work. The editor is opened
 * from one specific card, and a work may hold several favourites — but each view
 * used to guess the target instead: one took the first character without an
 * image, the other always index 0. Editing the second character therefore
 * overwrote the first one's photo.
 *
 * Returns null when the character is no longer in the work, so the caller can
 * report it rather than write somewhere arbitrary.
 */
export function applyCharacterImage(
  item: MediaItem,
  characterName: string,
  image: string,
): MediaItem | null {
  const current = item.trackingData.favoriteCharacters ?? [];
  const index = current.findIndex((character) => character.name === characterName);
  if (index < 0) return null;

  const next = [...current];
  next[index] = { ...next[index], image };
  return { ...item, trackingData: { ...item.trackingData, favoriteCharacters: next } };
}
