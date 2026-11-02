import type { MediaItem } from '../types';

/**
 * Resolves the TROPE axis of a work.
 *
 * Genres and tropes are two different axes on purpose. A genre is a broad shelf
 * ("fantasía", "comedia"); a trope is a recognizable premise or relationship
 * pattern ("isekai", "bucle temporal", "harem"). AniList only publishes the
 * first as a fixed enum, so the second lives in its community tags. That is why
 * a linked work used to lose "Isekai" entirely: it is a tag, never a genre, and
 * `getGenres` only reads AniList's genre enum.
 *
 * The map below is a CURATED vocabulary, not a pass-through. Unknown tag names
 * are dropped on the floor. Passing community tags through as-is would
 * reintroduce the free-text problem the genre axis already has: the same idea
 * spelled three ways across works, impossible to filter or count. Adding a
 * trope is therefore a one-line decision here, never an automatic behaviour.
 * Keys are lowercase AniList tag names exactly as the API returns them; values
 * are the canonical Spanish label shown to the user.
 *
 * Precedence mirrors `getGenres`:
 * 1. When the work carries a non-empty `aiData.anilist.tags` list, that list is
 *    the ONLY source. AniList tags are authoritative once present, so mixing
 *    them with legacy free text would resurrect values the user cannot see.
 * 2. Otherwise the legacy free-text fields (`aiData.genres` and the stored
 *    `anilist.genres`) are tried, so unlinked works can still surface a trope
 *    the AI happened to write.
 *
 * Always returns a fresh, deduplicated array; callers may sort or mutate it.
 */
export const TROPE_MAP: Record<string, string> = {
  // Premise / world
  'isekai': 'isekai',
  'time loop': 'bucle temporal',
  'time manipulation': 'manipulación del tiempo',
  'time skip': 'salto temporal',
  'alternate universe': 'universo alternativo',
  'virtual world': 'mundo virtual',
  'reincarnation': 'reencarnación',
  'cultivation': 'cultivación',
  'dungeon': 'mazmorra',
  'guilds': 'gremios',
  'space opera': 'space opera',

  // Conflict / tone
  'battle royale': 'battle royale',
  'survival': 'supervivencia',
  'espionage': 'espionaje',
  'military': 'militar',
  'war': 'guerra',
  'politics': 'política',
  'crime': 'crimen',
  'mafia': 'mafia',
  'yakuza': 'yakuza',
  'bounty hunters': 'cazarrecompensas',
  'detective': 'detective',
  'anti-hero': 'antihéroe',
  'tragedy': 'tragedia',
  'satire': 'sátira',
  'parody': 'parodia',
  'slapstick': 'slapstick',
  'surreal comedy': 'comedia surrealista',
  'episodic': 'episódico',
  'denpa': 'denpa',
  'iyashikei': 'iyashikei',

  // Relationships
  'harem': 'harem',
  'reverse harem': 'harem inverso',
  'love triangle': 'triángulo amoroso',
  'fake relationship': 'relación falsa',
  'arranged marriage': 'matrimonio arreglado',
  'unrequited love': 'amor no correspondido',
  'childhood friends': 'amigos de la infancia',
  'found family': 'familia encontrada',
  'coming of age': 'coming of age',
  'family life': 'vida familiar',

  // Characters
  'female protagonist': 'protagonista femenina',
  'male protagonist': 'protagonista masculino',
  'ensemble cast': 'elenco coral',
  'tsundere': 'tsundere',
  'yandere': 'yandere',
  'kuudere': 'kuudere',
  'monster girl': 'chica monstruo',
  'gender bender': 'cambio de género',
  'crossdressing': 'crossdressing',
  'super power': 'superpoderes',
  'delinquents': 'delincuentes',
  'otaku culture': 'cultura otaku',

  // Fantasy / myth
  'fairy tale': 'cuento de hadas',
  'mythology': 'mitología',
  'gods': 'dioses',
  'demons': 'demonios',
  'ghosts': 'fantasmas',
  'youkai': 'youkai',
  'dragons': 'dragones',
  'ninja': 'ninja',
  'samurai': 'samurái',
  'swordplay': 'esgrima',
  'guns': 'armas de fuego',

  // Sci-fi
  'robots': 'robots',
  'artificial intelligence': 'inteligencia artificial',
  'memory manipulation': 'manipulación de la memoria',
  'dissociative identities': 'identidades disociativas',

  // Slice of life / hobby
  'idol': 'idol',
  'band': 'banda',
  'cooking': 'cocina',
  'medical': 'médico',
  'philosophy': 'filosofía',
  'educational': 'educativo',
  'religion': 'religión',
};

/**
 * Canonical labels, so an already-normalized value is accepted as input. The
 * function must be idempotent: `getGenreFacet` feeds it values that other
 * surfaces may have normalized already.
 */
const CANONICAL_TROPES = new Set(Object.values(TROPE_MAP));

/**
 * Maps one candidate value onto the curated vocabulary, or null when it does
 * not belong to it. Case-insensitive and trimmed; non-strings, blanks and
 * unknown values are rejected instead of passed through.
 */
export const normalizeTrope = (value: string): string | null => {
  if (typeof value !== 'string') return null;

  const key = value.trim().toLowerCase();
  if (!key) return null;

  const mapped = TROPE_MAP[key];
  if (mapped) return mapped;

  // Idempotency: a canonical label maps to itself.
  return CANONICAL_TROPES.has(key) ? key : null;
};

/**
 * Trope labels for one work, following the precedence documented above.
 * Every candidate is normalized, unknown values are dropped and duplicates
 * collapse; the returned array is always new.
 */
export const getTropes = (item: MediaItem): string[] => {
  const tags = item.aiData?.anilist?.tags;

  const candidates: string[] =
    Array.isArray(tags) && tags.length > 0
      ? tags.map(tag => tag?.name ?? '')
      : [...(item.aiData?.genres ?? []), ...(item.aiData?.anilist?.genres ?? [])];

  const seen = new Set<string>();
  const tropes: string[] = [];

  for (const candidate of candidates) {
    const trope = normalizeTrope(candidate);
    if (!trope || seen.has(trope)) continue;

    seen.add(trope);
    tropes.push(trope);
  }

  return tropes;
};
