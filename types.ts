

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
}

export interface UserTrackingData {
  status: 'Viendo/Leyendo' | 'Completado' | 'En Pausa' | 'Descartado' | 'Planeado / Pendiente';
  currentSeason: number;
  totalSeasons: number; // User defined total seasons
  watchedEpisodes: number;
  totalEpisodesInSeason: number;
  emotionalTags: string[];
  favoriteCharacters: string[]; // Changed to array of strings for tags
  rating: string; // e.g., "God Tier", "Bueno", etc.
  comment: string;
  recommendedBy?: string; // New field for social aspect
  isSaga?: boolean; // New: For books that are part of a series
  finishedAt?: string; // New: Date string (ISO) for when a movie was watched
  customLinks?: { id: string; url: string; title?: string }[]; // New: User added links
  scheduledReturnDate?: string; // New: Scheduled return date for "En Pausa" items
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

export const EMOTIONAL_TAGS_OPTIONS = [
  { label: "Me rompió el corazón", emoji: "💔" },
  { label: "Siento que es perfecto", emoji: "✨" },
  { label: "Me decepcionó el final", emoji: "📉" },
  { label: "Personajes entrañables", emoji: "🫂" },
  { label: "Trama confusa", emoji: "🌀" },
  { label: "Adictivo", emoji: "💉" },
  { label: "Arte/Visuales increíbles", emoji: "🎨" },
  { label: "Soundtrack memorable", emoji: "🎵" },
  { label: "Me hizo reír mucho", emoji: "🤣" },
  { label: "Me dio miedo/ansiedad", emoji: "😨" }
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
  { name: 'Indigo', value: '99 102 241', hex: '#6366f1' },
  { name: 'Purple', value: '168 85 247', hex: '#a855f7' },
  { name: 'Pink', value: '236 72 153', hex: '#ec4899' },
  { name: 'Emerald', value: '16 185 129', hex: '#10b981' },
  { name: 'Orange', value: '249 115 22', hex: '#f97316' },
  { name: 'Sky', value: '14 165 233', hex: '#0ea5e9' },
];