

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
  emoji: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export const EMOTIONAL_TAGS_OPTIONS: EmotionalTagOption[] = [
  // Existing / Positive / Neutral
  { label: "Me rompió el corazón", emoji: "💔", sentiment: 'positive' },
  { label: "Siento que es perfecto", emoji: "✨", sentiment: 'positive' },
  { label: "Personajes entrañables", emoji: "🫂", sentiment: 'positive' },
  { label: "Adictivo", emoji: "💉", sentiment: 'positive' },
  { label: "Arte/Visuales increíbles", emoji: "🎨", sentiment: 'positive' },
  { label: "Soundtrack memorable", emoji: "🎵", sentiment: 'positive' },
  { label: "Me hizo reír mucho", emoji: "🤣", sentiment: 'positive' },
  { label: "Me dio miedo/ansiedad", emoji: "😨", sentiment: 'neutral' },
  
  // New Positive / Neutral (Quality Focus)
  { label: "Giro de trama impactante", emoji: "🤯", sentiment: 'positive' },
  { label: "Ritmo impecable", emoji: "⚡", sentiment: 'positive' },
  { label: "Construcción de mundo épica", emoji: "🌍", sentiment: 'positive' },
  { label: "Me hizo reflexionar", emoji: "🤔", sentiment: 'positive' },
  { label: "Desafiante / Complejo", emoji: "🧩", sentiment: 'neutral' },
  { label: "Pura adrenalina", emoji: "🔥", sentiment: 'positive' },
  { label: "Ideal para maratón", emoji: "🍿", sentiment: 'positive' },
  { label: "Cero clichés", emoji: "🦄", sentiment: 'positive' },

  // New Negative / Critical (Deficiency Focus)
  { label: "Trama confusa", emoji: "🌀", sentiment: 'negative' },
  { label: "Me decepcionó el final", emoji: "📉", sentiment: 'negative' },
  { label: "Trama sin rumbo / Lenta", emoji: "🐌", sentiment: 'negative' },
  { label: "Final decepcionante", emoji: "👎", sentiment: 'negative' },
  { label: "Personajes planos/irritantes", emoji: "🙄", sentiment: 'negative' },
  { label: "Contenido de relleno excesivo", emoji: "🧀", sentiment: 'negative' },
  { label: "Inconsistencias en la historia", emoji: "🤨", sentiment: 'negative' },
  { label: "Me costó terminarlo", emoji: "😮‍💨", sentiment: 'negative' }
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