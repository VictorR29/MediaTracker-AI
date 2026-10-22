import type { MediaItem } from '../types';

export type DuplicateReason = 'anilist-id' | 'title';

export interface DuplicateGroup {
  /** The normalized value the members share. */
  key: string;
  reason: DuplicateReason;
  /**
   * Media type the members share. Only populated by the title pass: an
   * AniList id is a firm fact on its own and does not need the type.
   */
  mediaType?: string;
  /** Members, in library order. */
  items: MediaItem[];
}

export interface LibraryAuditReport {
  byAniListId: DuplicateGroup[];
  byTitle: DuplicateGroup[];
}

/**
 * Duplicate audit for the local library.
 *
 * Local-only by design: it reads the array it is handed and issues no request,
 * reads no store and wires no state. It exists because identical AniList ids
 * and identical titles are already available in memory, so no remote check is
 * needed to surface the obvious cases.
 *
 * Title matches are ADVISORY, not proof: legitimate entries such as different
 * seasons of the same show routinely share a title. Nothing is deleted
 * automatically; every finding is a hint for the user to review by hand.
 *
 * A shared title alone does not make two entries duplicates. An anime and the
 * manhwa it adapts share a title and are distinct works with distinct progress,
 * so the title pass also requires the same media type: the same title under a
 * different type is not a duplicate. AniList ids are exempt from that rule,
 * because a shared id is a firm fact regardless of the type an item claims.
 */

const EMPTY_REPORT: LibraryAuditReport = { byAniListId: [], byTitle: [] };

/**
 * Lowercase, strip diacritics, collapse every non-alphanumeric run into a
 * single space, then trim. Local copy on purpose: the AniList service owns a
 * private helper of its own and this module must not depend on it.
 */
const normalizeTitle = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
};

/** AniList id as a group key. Unlinked or malformed entries yield null. */
const anilistKeyOf = (item: MediaItem): string | null => {
  const id = item?.aiData?.anilist?.id;
  return typeof id === 'number' && Number.isFinite(id) ? String(id) : null;
};

/** Normalized title as a group key. Blank and non-string titles yield null. */
const titleKeyOf = (item: MediaItem): string | null => normalizeTitle(item?.aiData?.title) || null;

/**
 * Groups items by a key function in a single pass, keeping groups of two or
 * more members in library order.
 */
const collectGroups = (
  items: MediaItem[],
  keyOf: (item: MediaItem) => string | null,
  reason: DuplicateReason,
): DuplicateGroup[] => {
  const buckets = new Map<string, MediaItem[]>();

  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const groups: DuplicateGroup[] = [];
  buckets.forEach((members, key) => {
    if (members.length >= 2) groups.push({ key, reason, items: members });
  });
  return groups;
};

/**
 * Bigger groups first, ties broken by ascending key so the output is stable.
 */
const bySizeThenKey = (a: DuplicateGroup, b: DuplicateGroup): number => {
  if (a.items.length !== b.items.length) return b.items.length - a.items.length;
  if (a.key === b.key) return 0;
  return a.key < b.key ? -1 : 1;
};

/** Trimmed media type, or an empty string when absent or malformed. */
const mediaTypeOf = (item: MediaItem): string => {
  const type = item?.aiData?.mediaType;
  return typeof type === 'string' ? type.trim() : '';
};

/**
 * Splits every group by media type and keeps only the sub-groups that still
 * have two or more members. A shared title under different types is a false
 * positive: an anime and its source manhwa are distinct works. Groups that
 * cannot be split survive untouched, so a homogeneous group keeps its members
 * and order.
 */
const splitByMediaType = (groups: DuplicateGroup[]): DuplicateGroup[] => {
  const split: DuplicateGroup[] = [];

  for (const group of groups) {
    const buckets = new Map<string, MediaItem[]>();

    for (const item of group.items) {
      const mediaType = mediaTypeOf(item);
      const bucket = buckets.get(mediaType);
      if (bucket) bucket.push(item);
      else buckets.set(mediaType, [item]);
    }

    buckets.forEach((items, mediaType) => {
      if (items.length >= 2) split.push({ ...group, mediaType, items });
    });
  }

  return split;
};

/**
 * Finds duplicate works by AniList id and by normalized title.
 *
 * Pure, synchronous and O(n) over the library, defensive against malformed
 * items: it never throws. An item already reported through an AniList id is
 * not reported again through its title, so a pair that matches on both fields
 * is surfaced once instead of twice. Title groups are further split by media
 * type, since a shared title across different types is not a duplicate.
 */
export const auditLibrary = (items: MediaItem[]): LibraryAuditReport => {
  if (!Array.isArray(items)) return EMPTY_REPORT;

  const source = items.filter((item): item is MediaItem => Boolean(item));
  const byAniListId = collectGroups(source, anilistKeyOf, 'anilist-id');

  // Everything already reported by AniList id is excluded from the title pass.
  const alreadyReported = new Set<string>();
  for (const group of byAniListId) {
    for (const item of group.items) {
      if (typeof item?.id === 'string') alreadyReported.add(item.id);
    }
  }

  const byTitle = splitByMediaType(
    collectGroups(
      source.filter(item => !alreadyReported.has(item?.id)),
      titleKeyOf,
      'title',
    ),
  );

  return {
    byAniListId: byAniListId.sort(bySizeThenKey),
    byTitle: byTitle.sort(bySizeThenKey),
  };
};
