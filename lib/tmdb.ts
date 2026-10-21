import { fetchHindiOttPage } from './hindiOtt';

export { TMDB_IMAGE, poster } from './tmdb-image';
// Prefer server-only secrets (never bundled to the browser); fall back
// to the NEXT_PUBLIC_* values for backwards compatibility. `||`, not `??`:
// a blank `TMDB_API_KEY=` line (as in .env.example) loads as "" and must
// still fall through to the public value.
const API_KEY =
  process.env.TMDB_API_KEY?.trim() || process.env.NEXT_PUBLIC_TMDB_API_KEY?.trim();
const TOKEN =
  process.env.TMDB_ACCESS_TOKEN?.trim() || process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN?.trim();

/** True when server-side TMDB calls have a credential to send. */
export const hasTmdbCredentials = Boolean(API_KEY || TOKEN);

/** True for TMDB's "this id doesn't exist" — a 404, not a network failure. */
export const isTmdbNotFound = (e: unknown) =>
  e instanceof Error && e.message.startsWith('TMDB error 404');

// 18+ producers whose catalogs are mature by brand (verified Oct 2026).
const ADULT_COMPANIES = new Set([149142, 173083, 134066]); // Vivamax, Vivamax Original Series, Ullu
// One brand can span films and series (Vivamax films + Vivamax Original Series).
const ADULT_BRANDS = [[149142, 173083], [134066]];
// TMDB "erotic" keyword used for the 18+ movie/series rows.
export const EROTIC_KEYWORD = 256466;
const ADULT_KEYWORDS = new Set([EROTIC_KEYWORD]);
// Keeps those titles out of the main catalog's discover lists (TMDB flags
// them `adult: false`, so include_adult=false alone lets them through).
// Verified Oct 2026: removes all Vivamax/Ullu/erotic-keyword results.
const NOT_ADULT = `without_keywords=${Array.from(ADULT_KEYWORDS).join(',')}&without_companies=${Array.from(
  ADULT_COMPANIES
).join(',')}`;

const FETCH_TIMEOUT_MS = 12000;
const MAX_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cache budgets (seconds) — the main lever against TMDB rate limits.
// Slow-moving catalog rows and details get long TTLs; only
// rapidly-changing data (trending, airing-season episodes) revalidates
// often. Served stale-while-revalidate: users never wait on TMDB.
const TTL = {
  trending: 6 * 3600, // popular / top-rated / trending lists
  catalog: 12 * 3600, // genre, language, regional, 18+ rows
  search: 30 * 60, // per-query results
  details: 24 * 3600, // movie / TV metadata rarely changes
  season: 6 * 3600, // episode lists of airing shows change
} as const;

// Burst collapsing: concurrent identical requests (cold cache + many users
// at once) share a single upstream fetch instead of stampeding TMDB.
// Only in-flight requests are shared — errors are never cached.
const inflight = new Map<string, Promise<unknown>>();
function singleflight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = run().finally(() => {
    if (inflight.get(key) === p) inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

async function tmdbFetch(path: string, revalidate = TTL.catalog) {
  const url = `https://api.themoviedb.org/3${path}${path.includes('?') ? '&' : '?'}language=en-US`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let finalUrl = url;
  if (TOKEN) {
    headers['Authorization'] = `Bearer ${TOKEN}`;
  } else if (API_KEY) {
    finalUrl += `&api_key=${API_KEY}`;
  } else {
    throw new Error('Missing TMDB credentials: set TMDB_ACCESS_TOKEN or TMDB_API_KEY');
  }
  // Retry with exponential backoff + jitter: TMDB (or middleboxes/VPNs on
  // some networks) intermittently reset TLS connections (ECONNRESET), and
  // burst-parallel pages (/movies fires ~10 calls at once) multiply the
  // odds. Each attempt also gets its own timeout so a hung socket can't
  // stall the page, and 429s respect Retry-After instead of hammering.
  // Burst collapsing + persistent cache: concurrent identical calls share
  // one upstream request; successes are cached for the endpoint's TTL.
  return singleflight(finalUrl, async () => {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const last = attempt === MAX_ATTEMPTS - 1;
      try {
        const res = await fetch(finalUrl, {
          headers,
          next: { revalidate },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (res.status === 429) {
          lastErr = new Error(`TMDB rate limited (429) for ${path}`);
          if (last) throw lastErr;
          const retryAfterSec = Number(res.headers.get('retry-after')) || 0;
          await sleep(Math.min(retryAfterSec ? retryAfterSec * 1000 : 1500 * (attempt + 1), 10000));
          continue;
        }
        // Deterministic client errors (bad key, unknown id, bad params)
        // never succeed on retry — fail fast instead of stalling ~12s.
        if (!res.ok) throw new Error(`TMDB error ${res.status} for ${path}`);
        // Awaited so a body read/parse failure (mid-body reset) is retried.
        return await res.json();
      } catch (e) {
        if (e instanceof Error && /^TMDB error 4\d\d/.test(e.message)) throw e;
        lastErr = e;
        // ~0.8s → 1.6s → 3.2s (+ jitter), so parallel bursts desync.
        // No sleep after the final attempt — throw immediately.
        if (!last) await sleep(800 * 2 ** attempt + Math.random() * 300);
      }
    }
    throw lastErr;
  });
}

/**
 * Discovers Hindi series made *for* an OTT platform (Netflix, Prime Video,
 * JioHotstar, Zee5, SonyLIV, MX Player, ALTBalaji, ...) instead of the
 * legacy linear-TV serials that dominate a plain `with_original_language=hi`
 * query. See lib/hindiOtt.ts for the network ids and filter rationale.
 */
export const hindiOtt = {
  page: (page = 1, sort: 'popularity' | 'vote_average' = 'popularity') =>
    fetchHindiOttPage((p) => tmdbFetch(p, TTL.catalog), page, sort),
};

export const tmdb = {
  trending: (type: 'movie' | 'tv' | 'all' = 'all', page = 1) =>
    tmdbFetch(`/trending/${type}/week?page=${page}`, TTL.trending),
  popularMovies: (page = 1) => tmdbFetch(`/movie/popular?page=${page}`, TTL.trending),
  popularTV: (page = 1) => tmdbFetch(`/tv/popular?page=${page}`, TTL.trending),
  topRatedMovies: (page = 1) => tmdbFetch(`/movie/top_rated?page=${page}`, TTL.trending),
  anime: (page = 1) =>
    tmdbFetch(`/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&${NOT_ADULT}&page=${page}`, TTL.catalog),
  bollywood: (page = 1) =>
    tmdbFetch(`/discover/movie?with_original_language=hi&region=IN&sort_by=popularity.desc&${NOT_ADULT}&page=${page}`, TTL.catalog),
  southTamil: (page = 1) =>
    tmdbFetch(`/discover/movie?with_original_language=ta&region=IN&sort_by=popularity.desc&${NOT_ADULT}&page=${page}`, TTL.catalog),
  southTelugu: (page = 1) =>
    tmdbFetch(`/discover/movie?with_original_language=te&region=IN&sort_by=popularity.desc&${NOT_ADULT}&page=${page}`, TTL.catalog),
  search: (q: string, page = 1) =>
    tmdbFetch(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false&page=${page}`, TTL.search),
  // `recommendations` is appended next to `similar` because the two are
  // near-orthogonal: `similar` is the tight but obscure cluster (and is
  // empty for ~40% of titles), `recommendations` is the popular, better
  // rated twin. Both ride the one cached details call, so the extra
  // payload is free at request time.
  movieDetails: (id: string) =>
    tmdbFetch(`/movie/${id}?append_to_response=videos,credits,similar,recommendations,keywords`, TTL.details),
  tvDetails: (id: string) =>
    tmdbFetch(`/tv/${id}?append_to_response=videos,credits,similar,recommendations,keywords`, TTL.details),
  movieRecommendations: (id: string) => tmdbFetch(`/movie/${id}/recommendations`, TTL.details),
  tvRecommendations: (id: string) => tmdbFetch(`/tv/${id}/recommendations`, TTL.details),
  // Keyword ids live in one namespace shared by movies and series, so a
  // series' keyword finds films with the same theme and vice versa. One
  // keyword per call: TMDB treats `with_keywords=a,b` as AND, which
  // over-narrows to almost nothing.
  discoverByKeyword: (type: 'movie' | 'tv', keywordId: number, page = 1) =>
    tmdbFetch(
      `/discover/${type}?with_keywords=${keywordId}&sort_by=popularity.desc&include_adult=false&${NOT_ADULT}&page=${page}`,
      TTL.catalog
    ),
  // Single genre id on purpose — a comma list is an AND filter, which
  // over-narrows and degrades the popularity sort.
  discoverByGenre: (type: 'movie' | 'tv', genreId: number, page = 1) =>
    tmdbFetch(
      `/discover/${type}?with_genres=${genreId}&sort_by=popularity.desc&include_adult=false&${NOT_ADULT}&page=${page}`,
      TTL.catalog
    ),
  seasonDetails: (id: string, s: number) => tmdbFetch(`/tv/${id}/season/${s}`, TTL.season),
  tvExternalIds: (id: string) => tmdbFetch(`/tv/${id}/external_ids`, TTL.details),
  moviesByLang: (lang: string, page = 1) =>
    tmdbFetch(`/discover/movie?with_original_language=${lang}&sort_by=popularity.desc&${NOT_ADULT}&page=${page}`, TTL.catalog),
  tvByLang: (lang: string, page = 1) =>
    tmdbFetch(`/discover/tv?with_original_language=${lang}&sort_by=popularity.desc&${NOT_ADULT}&page=${page}`, TTL.catalog),
  genreMovies: (genreId: number, page = 1) =>
    tmdbFetch(`/discover/movie?with_genres=${genreId}&sort_by=popularity.desc&${NOT_ADULT}&page=${page}`, TTL.catalog),
  genreTV: (genreId: number, page = 1) =>
    tmdbFetch(`/discover/tv?with_genres=${genreId}&sort_by=popularity.desc&${NOT_ADULT}&page=${page}`, TTL.catalog),
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
    tmdbFetch(`/search/multi?query=${encodeURIComponent(q)}&include_adult=true&page=${page}`, TTL.search),
  // 18+ related rows: popularity-sorted discovery inside the mature catalog
  // (brand, or the erotic keyword plus a language / genre / theme filter).
  adultDiscover: (type: 'movie' | 'tv', filters: string, page = 1) =>
    tmdbFetch(
      `/discover/${type}?${filters}&include_adult=true&sort_by=popularity.desc&page=${page}`,
      TTL.catalog
    ),
};

/** The 18+ brands a title belongs to, as `with_companies` OR-lists. */
export function adultBrandsOf(d: any): string[] {
  const ids = new Set<number>((d?.production_companies ?? []).map((c: any) => c.id));
  return ADULT_BRANDS.filter((brand) => brand.some((id) => ids.has(id))).map((brand) =>
    brand.join('|')
  );
}


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
