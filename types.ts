
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
}

export interface UserTrackingData {
  status: 'Viendo/Leyendo' | 'Completado' | 'En Pausa' | 'Descartado';
  currentSeason: number;
  totalSeasons: number; // User defined total seasons
  watchedEpisodes: number;
  totalEpisodesInSeason: number;
  emotionalTags: string[];
  favoriteCharacters: string[]; // Changed to array of strings for tags
  rating: string; // e.g., "God Tier", "Bueno", etc.
  comment: string;
}

export interface MediaItem {
  id: string;
  aiData: AIWorkData;
  trackingData: UserTrackingData;
  createdAt: number;
}

export interface UserPreferences {
  animeEpisodeDuration: number; // in minutes
  movieDuration: number; // in minutes
  mangaChapterDuration: number; // in minutes
  bookChapterDuration: number; // in minutes
}

export interface UserProfile {
  username: string;
  accentColor: string; // e.g. 'indigo', 'purple', 'emerald'
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