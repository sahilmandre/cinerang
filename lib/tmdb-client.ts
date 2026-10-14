// Client-side TMDB search for live as-you-type results.
// Uses the same public key/token as the server lib (NEXT_PUBLIC_* is
// bundled to the browser, so this exposes nothing new).
export interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  media_type?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
}

export async function searchTitles(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const token = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
  const key = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  let url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(
    q
  )}&include_adult=false&language=en-US`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  else if (key) url += `&api_key=${key}`;
  else throw new Error('Missing TMDB key');
  const res = await fetch(url, { headers, signal });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const json = await res.json();
  return ((json.results ?? []) as SearchResult[])
    .filter((r) => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path)
    .slice(0, 8);
}
