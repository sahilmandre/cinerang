// Image URL helpers, split from lib/tmdb.ts so client components can build
// poster URLs without bundling the server-side TMDB fetch layer.
export const TMDB_IMAGE = 'https://image.tmdb.org/t/p';

export const poster = (path: string | null, size = 'w500') =>
  path ? `${TMDB_IMAGE}/${size}${path}` : '/placeholder.svg';
