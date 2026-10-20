// Client-side live as-you-type search. Goes through /api/search, so the
// TMDB credential stays on the server and networks that block TMDB itself
// still get suggestions.
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
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Search ${res.status}`);
  const json = await res.json();
  // The route already filters to movie/tv titles with posters.
  const data = (json.results ?? []) as SearchResult[];
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
