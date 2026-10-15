// Central sub-category registry: genre -> /browse/<slug>.
// IDs are TMDB genre ids. Movie and TV genre lists differ
// (TV has no Romance/Thriller/Horror ids), hence two tables.

export interface GenreEntry {
  id: number;
  name: string;
  slug: string;
}

export const MOVIE_GENRES: GenreEntry[] = [
  { id: 28, name: 'Action', slug: 'movie-action' },
  { id: 35, name: 'Comedy', slug: 'movie-comedy' },
  { id: 80, name: 'Crime', slug: 'movie-crime' },
  { id: 53, name: 'Thriller', slug: 'movie-thriller' },
  { id: 27, name: 'Horror', slug: 'movie-horror' },
  { id: 10749, name: 'Romance', slug: 'movie-romance' },
];

export const TV_GENRES: GenreEntry[] = [
  { id: 10759, name: 'Action & Adventure', slug: 'tv-action' },
  { id: 35, name: 'Comedy', slug: 'tv-comedy' },
  { id: 80, name: 'Crime', slug: 'tv-crime' },
  { id: 18, name: 'Drama', slug: 'tv-drama' },
  { id: 9648, name: 'Mystery', slug: 'tv-mystery' },
  { id: 10765, name: 'Sci-Fi & Fantasy', slug: 'tv-scifi' },
  { id: 10764, name: 'Reality', slug: 'tv-reality' },
];

/** Browse slug for a TMDB genre id, or null when it has no sub-category page. */
export function genreSlug(type: 'movie' | 'tv', id: number): string | null {
  const list = type === 'movie' ? MOVIE_GENRES : TV_GENRES;
  return list.find((g) => g.id === id)?.slug ?? null;
}
