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
  // Retry with backoff: TMDB resets TLS connections intermittently on some
  // networks (ECONNRESET). TV pages make 2 calls, doubling the flake chance.
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(finalUrl, { headers, next: { revalidate: 3600 } });
      if (!res.ok) throw new Error(`TMDB error ${res.status} for ${path}`);
      return res.json();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export const tmdb = {
  trending: (type: 'movie' | 'tv' | 'all' = 'all', page = 1) =>
    tmdbFetch(`/trending/${type}/week?page=${page}`),
  popularMovies: (page = 1) => tmdbFetch(`/movie/popular?page=${page}`),
  popularTV: (page = 1) => tmdbFetch(`/tv/popular?page=${page}`),
  topRatedMovies: (page = 1) => tmdbFetch(`/movie/top_rated?page=${page}`),
  anime: (page = 1) =>
    tmdbFetch(`/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=${page}`),
  bollywood: (page = 1) =>
    tmdbFetch(`/discover/movie?with_original_language=hi&region=IN&sort_by=popularity.desc&page=${page}`),
  southTamil: (page = 1) =>
    tmdbFetch(`/discover/movie?with_original_language=ta&region=IN&sort_by=popularity.desc&page=${page}`),
  southTelugu: (page = 1) =>
    tmdbFetch(`/discover/movie?with_original_language=te&region=IN&sort_by=popularity.desc&page=${page}`),
  search: (q: string, page = 1) =>
    tmdbFetch(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false&page=${page}`),
  movieDetails: (id: string) => tmdbFetch(`/movie/${id}?append_to_response=videos,credits,similar,keywords`),
  tvDetails: (id: string) => tmdbFetch(`/tv/${id}?append_to_response=videos,credits,similar,keywords`),
  seasonDetails: (id: string, s: number) => tmdbFetch(`/tv/${id}/season/${s}`),
  moviesByLang: (lang: string, page = 1) =>
    tmdbFetch(`/discover/movie?with_original_language=${lang}&sort_by=popularity.desc&page=${page}`),
  tvByLang: (lang: string, page = 1) =>
    tmdbFetch(`/discover/tv?with_original_language=${lang}&sort_by=popularity.desc&page=${page}`),
  genreMovies: (genreId: number, page = 1) =>
    tmdbFetch(`/discover/movie?with_genres=${genreId}&sort_by=popularity.desc&page=${page}`),
  genreTV: (genreId: number, page = 1) =>
    tmdbFetch(`/discover/tv?with_genres=${genreId}&sort_by=popularity.desc&page=${page}`),
  // 18+ / mature discovery. Verified Oct 2026 against the live API:
  // popularity-sorted discover with include_adult=true returns 0/20
  // `adult`-flagged items (TMDB barely uses the flag), so these lists
  // are curated by brand/keyword instead — every item is mature by
  // construction, like FlixSix's editorial "18+ Adult" genre tag.
  // Vivamax erotic films (19 pages of pure Vivamax): company 149142.
  vivamax: (page = 1) =>
    tmdbFetch(
      `/discover/movie?with_companies=149142&include_adult=true&sort_by=popularity.desc&page=${page}`
    ),
  // Ullu Originals adult series (6 pages of pure Ullu): company 134066.
  ullu: (page = 1) =>
    tmdbFetch(
      `/discover/tv?with_companies=134066&include_adult=true&sort_by=popularity.desc&page=${page}`
    ),
  // Erotic cinema (13 pages): TMDB "erotic" keyword 256466.
  eroticMovies: (page = 1) =>
    tmdbFetch(
      `/discover/movie?with_keywords=256466&include_adult=true&sort_by=popularity.desc&page=${page}`
    ),
  // Erotic series (6 pages): same keyword for TV.
  eroticTV: (page = 1) =>
    tmdbFetch(
      `/discover/tv?with_keywords=256466&include_adult=true&sort_by=popularity.desc&page=${page}`
    ),
  searchAdult: (q: string, page = 1) =>
    tmdbFetch(`/search/multi?query=${encodeURIComponent(q)}&include_adult=true&page=${page}`),
};

export const poster = (path: string | null, size = 'w500') =>
  path ? `${TMDB_IMAGE}/${size}${path}` : '/placeholder.png';

// 18+ producers whose catalogs are mature by brand (verified Oct 2026).
const ADULT_COMPANIES = new Set([149142, 173083, 134066]); // Vivamax, Vivamax Original Series, Ullu
// TMDB "erotic" keyword used for the 18+ movie/series rows.
const ADULT_KEYWORDS = new Set([256466]);

/**
 * True when a details object is an 18+ title. TMDB's `adult` flag alone
 * is not enough — Vivamax/Ullu-style titles carry `adult: false` — so
 * production company and keywords are checked too.
 */
export function isAdultTitle(d: any): boolean {
  if (!d) return false;
  if (d.adult) return true;
  if ((d.production_companies ?? []).some((c: any) => ADULT_COMPANIES.has(c.id))) return true;
  // Movies: { keywords: [...] }, TV: { results: [...] }.
  const kw = d.keywords?.keywords ?? d.keywords?.results ?? [];
  if (kw.some((k: any) => ADULT_KEYWORDS.has(k.id))) return true;
  return false;
}
