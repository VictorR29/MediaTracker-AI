

export interface AIWorkData {
  title: string;
  originalTitle?: string;
  mediaType: 'Anime' | 'Serie' | 'Pelicula' | 'Manhwa' | 'Manga' | 'Comic' | 'Libro' | 'Otro';
  synopsis: string;
  genres: string[];
  status: string;
  totalContent: string; // e.g. "2 Temporadas, 24 Caps" or "150 Caps"
  coverDescription: string;
  coverImage?: string; // New field for the image URL
  sourceUrls?: { title: string; uri: string }[];
  primaryColor?: string; // Hex code for dynamic theming
  releaseDate?: string; // New: Release year or date
  endDate?: string; // New: End year or date
  franchise_link?: string; // New: Internal Linked Franchise Identifier (e.g. "Demon Slayer" for the movie)
}

export interface UserTrackingData {
  status: 'Sin empezar' | 'Viendo/Leyendo' | 'Completado' | 'En Pausa' | 'Descartado' | 'Planeado / Pendiente';
  currentSeason: number;
  totalSeasons: number; // User defined total seasons
  watchedEpisodes: number;
  totalEpisodesInSeason: number;
  accumulated_consumption?: number; // New: Stores history (e.g., eps from prev seasons)
  emotionalTags: string[];
  favoriteCharacters: string[]; // Changed to array of strings for tags
  rating: string; // e.g., "God Tier", "Bueno", etc.
  comment: string;
  recommendedBy?: string; // New field for social aspect
  isSaga?: boolean; // New: For books that are part of a series
  finishedAt?: string; // New: Date string (ISO) for when a movie was watched
  customLinks?: { id: string; url: string; title?: string }[]; // New: User added links
  scheduledReturnDate?: string; // New: Scheduled return date for "En Pausa" items
  nextReleaseDate?: string; // New: User specific release date for "Planeado" items
  is_favorite?: boolean; // New: Favorite toggle
}

export interface MediaItem {
  id: string;
  aiData: AIWorkData;
  trackingData: UserTrackingData;
  createdAt: number;
  lastInteraction?: number; // New: Timestamp for the last user interaction (progress, edit, etc.)
}

export interface UserPreferences {
  animeEpisodeDuration: number; // in minutes
  seriesEpisodeDuration: number; // in minutes
  movieDuration: number; // in minutes
  mangaChapterDuration: number; // in minutes
  bookChapterDuration: number; // in minutes
}

export interface UserProfile {
  username: string;
  avatarUrl?: string; // URL for profile picture
  accentColor: string; // e.g. 'indigo', 'purple', 'emerald'
  apiKey: string; // User provided API Key
  password?: string; // Optional access password (simple hash or plain for this demo)
  preferences?: UserPreferences;
}

export interface EmotionalTagOption {
  label: string;
  shortLabel: string;
  contextual: string; // Forma gramatical correcta para inserción en oraciones
  emoji: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export const EMOTIONAL_TAGS_OPTIONS: EmotionalTagOption[] = [
// Existing / Positive / Neutral
{ label: "Me rompió el corazón", shortLabel: "Corazón roto", contextual: "una historia que rompe el corazón", emoji: "💔", sentiment: 'positive' },
{ label: "Siento que es perfecto", shortLabel: "Perfecto", contextual: "una obra perfecta", emoji: "✨", sentiment: 'positive' },
{ label: "Personajes entrañables", shortLabel: "Entrañables", contextual: "personajes entrañables", emoji: "🫂", sentiment: 'positive' },
{ label: "Adictivo", shortLabel: "Adictivo", contextual: "algo adictivo", emoji: "💉", sentiment: 'positive' },
{ label: "Arte/Visuales increíbles", shortLabel: "Arte increíble", contextual: "un arte increíble", emoji: "🎨", sentiment: 'positive' },
{ label: "Soundtrack memorable", shortLabel: "Soundtrack", contextual: "una soundtrack memorable", emoji: "🎵", sentiment: 'positive' },
{ label: "Me hizo reír mucho", shortLabel: "Mucha risa", contextual: "algo que me hizo reír mucho", emoji: "🤣", sentiment: 'positive' },
{ label: "Me dio miedo/ansiedad", shortLabel: "Miedo/Ansiedad", contextual: "una sensación de miedo", emoji: "😨", sentiment: 'neutral' },

// New Positive / Neutral (Quality Focus)
{ label: "Giro de trama impactante", shortLabel: "Giro impactante", contextual: "un giro impactante", emoji: "🤯", sentiment: 'positive' },
{ label: "Ritmo impecable", shortLabel: "Ritmo impecable", contextual: "un ritmo impecable", emoji: "⚡", sentiment: 'positive' },
{ label: "Construcción de mundo épica", shortLabel: "Mundo épico", contextual: "un mundo épico", emoji: "🌍", sentiment: 'positive' },
{ label: "Me hizo reflexionar", shortLabel: "Reflexivo", contextual: "algo que me hizo reflexionar", emoji: "🤔", sentiment: 'positive' },
{ label: "Desafiante / Complejo", shortLabel: "Desafiante", contextual: "un desafío complejo", emoji: "🧩", sentiment: 'neutral' },
{ label: "Pura adrenalina", shortLabel: "Adrenalina", contextual: "pura adrenalina", emoji: "🔥", sentiment: 'positive' },
{ label: "Ideal para maratón", shortLabel: "Para maratón", contextual: "algo ideal para maratón", emoji: "🍿", sentiment: 'positive' },
{ label: "Cero clichés", shortLabel: "Sin clichés", contextual: "algo sin clichés", emoji: "🦄", sentiment: 'positive' },

// New Negative / Critical (Deficiency Focus)
{ label: "Trama confusa", shortLabel: "Confusa", contextual: "una trama confusa", emoji: "🌀", sentiment: 'negative' },
{ label: "Me decepcionó el final", shortLabel: "Mal final", contextual: "un final decepcionante", emoji: "📉", sentiment: 'negative' },
{ label: "Trama sin rumbo / Lenta", shortLabel: "Lenta/Sin rumbo", contextual: "una trama lenta", emoji: "🐌", sentiment: 'negative' },
{ label: "Final decepcionante", shortLabel: "Decepcionante", contextual: "un final decepcionante", emoji: "👎", sentiment: 'negative' },
{ label: "Personajes planos/irritantes", shortLabel: "Pjs planos", contextual: "personajes planos", emoji: "🙄", sentiment: 'negative' },
{ label: "Contenido de relleno excesivo", shortLabel: "Mucho relleno", contextual: "mucho relleno", emoji: "🧀", sentiment: 'negative' },
{ label: "Inconsistencias en la historia", shortLabel: "Inconsistencias", contextual: "inconsistencias en la historia", emoji: "🤨", sentiment: 'negative' },
{ label: "Me costó terminarlo", shortLabel: "Costó terminarlo", contextual: "algo que costó terminar", emoji: "😮‍💨", sentiment: 'negative' }
];

export const RATING_OPTIONS = [
  "God Tier (Épico memorable)",
  "Obra Maestra",
  "Excelente",
  "Muy Bueno",
  "Bueno",
  "Regular",
  "Malo",
  "Pérdida de tiempo"
];

export const RATING_TO_SCORE: Record<string, number> = {
  "God Tier (Épico memorable)": 10,
  "Obra Maestra": 9,
  "Excelente": 8,
  "Muy Bueno": 7,
  "Bueno": 6,
  "Regular": 5,
  "Malo": 3,
  "Pérdida de tiempo": 1
};

export const THEME_COLORS = [
  { name: 'Indigo', value: '192 132 252', hex: '#c084fc' },
  { name: 'Purple', value: '168 85 247', hex: '#a855f7' },
  { name: 'Pink', value: '236 72 153', hex: '#ec4899' },
  { name: 'Emerald', value: '16 185 129', hex: '#10b981' },
  { name: 'Orange', value: '249 115 22', hex: '#f97316' },
  { name: 'Sky', value: '14 165 233', hex: '#0ea5e9' },
];

/**
 * Parse an accent color string (hex or 'R G B' format) into a hex color.
 * Falls back to indigo-400 (#c084fc) if invalid or missing.
 */
export const parseAccentToHex = (accentColor: string | undefined): string => {
  if (!accentColor) return '#c084fc';
  if (accentColor.startsWith('#')) return accentColor;
  // Handle '192 132 252' RGB space-separated format
  const parts = accentColor.split(' ').map(Number);
  if (parts.length === 3 && parts.every(n => !isNaN(n))) {
    return '#' + parts.map(c => Math.min(255, Math.max(0, c)).toString(16).padStart(2, '0')).join('');
  }
  return '#c084fc';
};

/**
 * Parse an accent color string (hex or 'R G B' format) into an 'R,G,B' string
 * suitable for inline rgba() styles.
 */
export const parseAccentToRgb = (accentColor: string | undefined): string => {
  if (!accentColor) return '192,132,252';
  if (accentColor.startsWith('#')) {
    const hex = accentColor.replace('#', '');
    if (hex.length !== 6) return '192,132,252';
    return [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)]
      .map(c => parseInt(c, 16)).join(',');
  }
  // Already in 'R G B' format
  return accentColor.replace(/ /g, ',');
};

// --- GENRE NORMALIZATION LOGIC ---

export const GENRE_MAPPING: Record<string, string> = {
  "action": "acción",
  "adventure": "aventura",
  "sci-fi": "ciencia ficción",
  "sci fi": "ciencia ficción",
  "science fiction": "ciencia ficción",
  "science-fiction": "ciencia ficción",
  "fantasy": "fantasía",
  "comedy": "comedia",
  "drama": "drama",
  "suspense": "suspense",
  "thriller": "suspense",
  "horror": "terror",
  "mystery": "misterio",
  "romance": "romance",
  "psychological": "psicológico",
  "supernatural": "sobrenatural",
  "slice of life": "recuentos de la vida",
  "sports": "deportes",
  "martial arts": "artes marciales",
  "historical": "histórico",
  "musical": "musical",
  "school": "escolar",
  "vampire": "vampiros",
  "magic": "magia",
  "space": "espacio",
  "shounen": "shonen",
  "shoujo": "shojo",
  "seinen": "seinen",
  "josei": "josei",
  "isekai": "isekai",
  "mecha": "mecha",
  "music": "música",
  "police": "policial",
  "post-apocalyptic": "post-apocalíptico",
  "gore": "gore",
  "cyberpunk": "cyberpunk",
  "steampunk": "steampunk"
};

export const normalizeGenre = (genre: string): string => {
  if (!genre) return "otros";
  const lower = genre.toLowerCase().trim();
  // Return mapped value or the lowercase original if no mapping exists
  return GENRE_MAPPING[lower] || lower;
};