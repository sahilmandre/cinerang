export const TMDB_IMAGE = 'https://image.tmdb.org/t/p';
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TOKEN = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;

async function tmdbFetch(path: string) {
  const url = `https://api.themoviedb.org/3${path}${path.includes('?') ? '&' : '?'}language=en-US`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let finalUrl = url;
  if (TOKEN) {
    headers['Authorization'] = `Bearer ${TOKEN}`;
  } else if (API_KEY) {
    finalUrl += `&api_key=${API_KEY}`;
  } else {
    throw new Error('Missing NEXT_PUBLIC_TMDB_API_KEY or NEXT_PUBLIC_TMDB_ACCESS_TOKEN in .env.local');
  }
  const res = await fetch(finalUrl, { headers, next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB error ${res.status} for ${path}`);
  return res.json();
}

export const tmdb = {
  trending: (type: 'movie' | 'tv' | 'all' = 'all') => tmdbFetch(`/trending/${type}/week`),
  popularMovies: () => tmdbFetch(`/movie/popular`),
  popularTV: () => tmdbFetch(`/tv/popular`),
  topRatedMovies: () => tmdbFetch(`/movie/top_rated`),
  anime: () => tmdbFetch(`/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc`),
  search: (q: string) => tmdbFetch(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false`),
  movieDetails: (id: string) => tmdbFetch(`/movie/${id}?append_to_response=videos,credits,similar`),
  tvDetails: (id: string) => tmdbFetch(`/tv/${id}?append_to_response=videos,credits,similar`),
  seasonDetails: (id: string, s: number) => tmdbFetch(`/tv/${id}/season/${s}`),
};

export const poster = (path: string | null, size = 'w500') =>
  path ? `${TMDB_IMAGE}/${size}${path}` : '/placeholder.png';
