import { describe, it, expect } from 'vitest';
import { computeTasteProfile } from '../tasteProfile';
import { MediaItem } from '../../types';

const makeItem = (title: string, mediaType: string, rating: string, genres: string[]): MediaItem => ({
  id: title.toLowerCase().replace(/\s/g, '-'),
  aiData: { title, mediaType, synopsis: '', genres, status: 'Finalizado', totalContent: '', coverDescription: '', coverImage: '', sourceUrls: [], primaryColor: '#6366f1' },
  trackingData: { status: 'Completado', currentSeason: 1, totalSeasons: 1, watchedEpisodes: 12, totalEpisodesInSeason: 12, is_favorite: false, rating, emotionalTags: [], comment: '', customLinks: [], favoriteCharacters: [], recommendedBy: '' },
  createdAt: 1000,
  lastInteraction: 2000,
});

describe('computeTasteProfile', () => {
  const library = [
    makeItem('Naruto', 'Anime', 'Obra Maestra', ['Acción', 'Shōnen']),
    makeItem('Berserk', 'Manga', 'Obra Maestra', ['Acción', 'Seinen']),
    makeItem('Solo Leveling', 'Manhwa', 'Muy Buena', ['Acción', 'Fantasía']),
    makeItem('Inception', 'Pelicula', 'Buena', ['Ciencia Ficción']),
  ];

  it('computes top genres from selected seeds', () => {
    const { topGenres } = computeTasteProfile(library, 'Anime', ['naruto', 'berserk']);
    expect(topGenres).toContain('Acción');
  });

  it('computes liked titles from selected seeds', () => {
    const { likedTitles } = computeTasteProfile(library, 'Anime', ['naruto']);
    expect(likedTitles).toContain('Naruto');
  });

  it('computes liked titles from high-rated items when no seeds', () => {
    const { likedTitles } = computeTasteProfile(library, 'Anime', []);
    expect(likedTitles).toContain('Naruto');
  });

  it('excludes all library titles from excludedTitles', () => {
    const { excludedTitles } = computeTasteProfile(library, 'Anime', []);
    expect(excludedTitles).toHaveLength(4);
    expect(excludedTitles).toContain('Naruto');
  });

  it('includes Manhwa/Manga/Comic when type is Manhwa', () => {
    const { likedTitles } = computeTasteProfile(library, 'Manhwa', []);
    expect(likedTitles).toContain('Solo Leveling');
  });
});
