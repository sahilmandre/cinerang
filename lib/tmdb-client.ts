// Client-side TMDB search for live as-you-type results.
// Uses the same public key/token as the server lib (NEXT_PUBLIC_* is
// bundled to the browser, so this exposes nothing new).
//
// React Query-style behavior without the dependency: short-TTL in-memory
// cache + in-flight request dedup. Repeated keystrokes, re-renders and
// back/forward revisits share one network request per query.
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

const CACHE_TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, { at: number; data: SearchResult[] }>();
const inflight = new Map<string, Promise<SearchResult[]>>();

/** Test seam / manual invalidation for the suggestion cache. */
export function clearSearchCache() {
  cache.clear();
}

async function runQuery(query: string): Promise<SearchResult[]> {
  const token = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
  const key = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  let url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(
    query
  )}&include_adult=false&language=en-US&page=1`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  else if (key) url += `&api_key=${key}`;
  else throw new Error('Missing TMDB key');
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const json = await res.json();
  const data = ((json.results ?? []) as SearchResult[])
    .filter((r) => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path)
    .slice(0, 8);
  cache.set(query.toLowerCase(), { at: Date.now(), data });
  return data;
}

export async function searchTitles(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const cacheKey = query.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  let p = inflight.get(cacheKey);
  if (!p) {
    // Shared fetch uses no caller signal: one caller's abort must not
    // cancel the request other callers are awaiting.
    p = runQuery(query).finally(() => {
      if (inflight.get(cacheKey) === p) inflight.delete(cacheKey);
    });
    inflight.set(cacheKey, p);
  }
  if (!signal) return p;
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  // Reject this caller on abort without cancelling the shared request.
  return new Promise<SearchResult[]>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    (p as Promise<SearchResult[]>).then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      }
    );
  });
}
