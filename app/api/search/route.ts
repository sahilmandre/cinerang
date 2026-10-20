import { NextResponse } from 'next/server';
import { tmdb } from '@/lib/tmdb';

/**
 * As-you-type search suggestions, proxied so the browser never talks to
 * TMDB directly:
 *   - the TMDB credential stays server-side (no NEXT_PUBLIC_* key needed),
 *   - viewers whose network blocks TMDB (e.g. DNS-level ISP blocks) still
 *     get suggestions, because only this server reaches TMDB.
 *
 * Query params:
 *   q - search text (2–100 chars)
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ results: [] });
  try {
    const data = await tmdb.search(q);
    const results = (data.results ?? [])
      .filter((r: any) => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path)
      .slice(0, 8)
      .map((r: any) => ({
        id: r.id,
        title: r.title,
        name: r.name,
        poster_path: r.poster_path,
        media_type: r.media_type,
        vote_average: r.vote_average,
        release_date: r.release_date,
        first_air_date: r.first_air_date,
      }));
    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': 'public, max-age=300' } }
    );
  } catch {
    return NextResponse.json({ error: 'search unavailable' }, { status: 502 });
  }
}
