import { NextResponse } from 'next/server';
import { tmdb, hindiOtt } from '@/lib/tmdb';
import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES } from '@/lib/categories';

const MOVIE_IDS = new Set(TMDB_MOVIE_GENRES.map((g) => g.id));
const TV_IDS = new Set(TMDB_TV_GENRES.map((g) => g.id));

/**
 * Returns diverse movie or series candidates for the taste quiz.
 *
 * Query params:
 *   media    - "movie" (default) or "tv"
 *   genres   - comma-separated TMDB genre ids to draw from
 *   exclude  - comma-separated title ids already shown/liked (capped at 600)
 *   count    - how many candidates to return (default 12, max 30)
 *
 * Each response mixes up to 4 shuffled genre pools, mainstream popularity,
 * and regional Bollywood/Hindi plus Korean pools. Round-robin selection keeps
 * one genre or region from dominating a round.
 * Runs server-side so the TMDB key never reaches the browser.
 */

const quiet = async (p: Promise<any>) => {
  try {
    return await p;
  } catch {
    return { results: [] };
  }
};

/** Fisher–Yates shuffle (uniform, unlike sort(() => Math.random() - 0.5)). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface QuizCandidate {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average?: number;
  genre_ids: number[];
  release_date?: string;
  original_language?: string;
  media_type: 'movie' | 'tv';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const media: 'movie' | 'tv' =
    searchParams.get('media') === 'tv' ? 'tv' : 'movie';

  // Only real genre ids for this media type — anything else would fan out
  // into wasted (and separately cached) TMDB discover calls.
  const validGenres = media === 'movie' ? MOVIE_IDS : TV_IDS;
  const genreIds = Array.from(
    new Set(
      (searchParams.get('genres') ?? '')
        .split(',', 50)
        .map(Number)
        .filter((n) => validGenres.has(n))
    )
  );

  // Hard cap — keeps param parsing and the exclude set bounded.
  const exclude = new Set(
    (searchParams.get('exclude') ?? '')
      .split(',', 600)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
  );

  const count = Math.min(
    Math.max(Number(searchParams.get('count')) || 12, 3),
    30
  );

  // Draw from up to 4 genres, shuffled so every selected genre gets a turn
  // across quiz rounds instead of always favoring the first picks.
  const drawGenres = shuffle(genreIds).slice(0, 4);
  // Random pages per pool (1–5): a 20-round quiz shows ~100 titles, so late
  // rounds need fresh candidates — page 1 alone would run dry. Repeated pages
  // are served from the TMDB fetch cache, so this stays cheap.
  const randomPage = () => 1 + Math.floor(Math.random() * 5);

  const genrePools =
    media === 'movie'
      ? drawGenres.map((genre) => quiet(tmdb.genreMovies(genre, randomPage())))
      : drawGenres.map((genre) => quiet(tmdb.genreTV(genre, randomPage())));

  // Regional pools are always present: Bollywood/Hindi and Korean titles must
  // be discoverable even when the user did not preselect their genres.
  const regionalPools =
    media === 'movie'
      ? [
          quiet(tmdb.bollywood(randomPage())),
          quiet(tmdb.moviesByLang('ko', randomPage())),
        ]
      : [
          quiet(hindiOtt.page(randomPage())),
          quiet(tmdb.tvByLang('ko', randomPage())),
        ];

  // Mainstream pool keeps results familiar and rescues thin genre pools. When
  // no genre IDs were supplied, trending is an additional broad fallback.
  const mainstreamPools = [
    quiet(
      media === 'movie'
        ? tmdb.popularMovies(randomPage())
        : tmdb.popularTV(randomPage())
    ),
    ...(genreIds.length === 0
      ? [quiet(tmdb.trending(media, randomPage()))]
      : []),
  ];

  const pools = await Promise.all([
    ...genrePools,
    ...regionalPools,
    ...mainstreamPools,
  ]);

  const seen = new Set<string>();
  const byPool: QuizCandidate[][] = [];

  for (const pool of pools) {
    const items: QuizCandidate[] = [];
    for (const item of pool?.results ?? []) {
      if (!item.poster_path) continue;
      if (exclude.has(item.id)) continue;
      const key = `${media}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: item.id,
        title: item.title ?? item.name ?? 'Unknown',
        poster_path: item.poster_path,
        vote_average: item.vote_average,
        genre_ids: item.genre_ids ?? [],
        release_date: item.release_date ?? item.first_air_date,
        original_language: item.original_language,
        media_type: media,
      });
      if (items.length >= count) break;
    }
    byPool.push(items);
  }

  // Round-robin across pools so candidates mix genres/regions evenly. There
  // are usually more pools (4 genre + 2 regional + mainstream) than slots,
  // so start at a random pool — a fixed start would always stop before the
  // Korean and mainstream pools.
  const merged: QuizCandidate[] = [];
  let idx = Math.floor(Math.random() * byPool.length);
  while (merged.length < count && byPool.some((p) => p.length > 0)) {
    const pool = byPool[idx % byPool.length];
    const next = pool.shift();
    if (next) merged.push(next);
    idx++;
  }

  return NextResponse.json({
    media,
    results: shuffle(merged).slice(0, count),
  });
}
