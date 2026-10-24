import type { RecommendationResult } from '../../services/geminiService';

/**
 * A deck card produced by Gemini. Keeps the legacy shape so the existing
 * Frost path — and everything downstream of it — stays byte-for-byte identical.
 */
export interface AiDeckCard extends RecommendationResult {
  kind: 'ai';
}

/** A deck card produced by AniList. Anime or Manhwa: both come from the same engine. */
export interface AniListDeckCard {
  kind: 'anilist';
  anilistId: number;
  title: string;
  alternateTitle?: string;
  mediaType: 'Anime' | 'Manhwa';
  synopsis: string;
  reason: string;
  coverImage?: string;
  color?: string;
  genres: string[];
  format?: string;
  episodes?: number;
  /** Manhwa carries chapters where anime carries episodes. */
  chapters?: number;
  seasonYear?: number;
  status?: string;
}

export type DeckCard = AiDeckCard | AniListDeckCard;
