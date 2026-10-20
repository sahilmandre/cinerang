// Central sub-category registry: genre -> /browse/<slug>.
// IDs are TMDB genre ids. Movie and TV genre lists differ
// (TV has no Romance/Thriller/Horror ids), hence two tables.

export interface GenreEntry {
  id: number;
  name: string;
  /** Browse slug — only set for genres that have a dedicated /browse page. */
  slug?: string;
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

/**
 * Full TMDB TV genre list — used by the series taste quiz and the series
 * recommendation scorer. TV_GENRES above stays the curated shortlist that has
 * /browse pages.
 */
export const TMDB_TV_GENRES: GenreEntry[] = [
  { id: 10759, name: 'Action & Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 10762, name: 'Kids' },
  { id: 9648, name: 'Mystery' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10766, name: 'Soap' },
  { id: 10767, name: 'Talk' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
];

/**
 * Full TMDB movie genre list — used by the taste quiz (picking any genre)
 * and by the recommendation scorer (labeling reason strings).
 * MOVIE_GENRES above stays the curated shortlist that has /browse pages.
 */
export const TMDB_MOVIE_GENRES: GenreEntry[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];

/** Browse slug for a TMDB genre id, or null when it has no sub-category page. */
export function genreSlug(type: 'movie' | 'tv', id: number): string | null {
  const list = type === 'movie' ? MOVIE_GENRES : TV_GENRES;
  return list.find((g) => g.id === id)?.slug ?? null;
}

/**
 * Genre crosswalk between the movie and TV taxonomies.
 *
 * TMDB uses different ids for the same idea — films tag "Sci-Fi" (878) and
 * "Fantasy" (14) separately, series tag both as "Sci-Fi & Fantasy" (10765)
 * — so a movie-to-series match has to be translated before the two can be
 * compared. Used by the "More like this" resolver to pick a movie for a
 * series (and the other way round) that actually shares its genre.
 */
export const MOVIE_TO_TV_GENRES: Record<number, number[]> = {
  878: [10765], // Sci-Fi
  14: [10765], // Fantasy
  28: [10759], // Action
  12: [10759], // Adventure
  53: [9648], // Thriller -> Mystery
  9648: [9648], // Mystery
  18: [18], // Drama
  35: [35], // Comedy
  80: [80], // Crime
  16: [16], // Animation
  99: [99], // Documentary
  10751: [10751], // Family
  10749: [18], // Romance -> Drama (TV has no romance genre)
  27: [9648], // Horror -> Mystery
  10752: [10768], // War -> War & Politics
  37: [37], // Western (same id on both)
};

export const TV_TO_MOVIE_GENRES: Record<number, number[]> = {
  10765: [878, 14], // Sci-Fi & Fantasy
  10759: [28, 12], // Action & Adventure
  9648: [9648, 53], // Mystery
  18: [18], // Drama
  35: [35], // Comedy
  80: [80], // Crime
  16: [16], // Animation
  99: [99], // Documentary
  10751: [10751], // Family
  37: [37], // Western
  10768: [10752, 36], // War & Politics -> War, History
  10762: [10751, 16], // Kids -> Family, Animation
};
