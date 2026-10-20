import { NextResponse } from 'next/server';
import { tmdb, hindiOtt } from '@/lib/tmdb';
import {
  scoreTitles,
  diversifyTitles,
  CandidateTitle,
  RecommendationMedia,
} from '@/lib/recommendations';
import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES } from '@/lib/categories';

const MOVIE_LOOKUP = new Map(TMDB_MOVIE_GENRES.map((g) => [g.id, g.name]));
const TV_LOOKUP = new Map(TMDB_TV_GENRES.map((g) => [g.id, g.name]));

/** FNV-1a hash: turns a date/taste/shuffle seed into a stable RNG seed. */
function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic PRNG so the same day/taste/shuffle key returns the same mix. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle driven by the supplied RNG. */
function shuffleWith<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function fetchCandidates(
  media: RecommendationMedia,
  favoriteGenres: number[],
  languageScores: Record<string, number>,
  random: () => number
): Promise<CandidateTitle[]> {
  // Pull candidates around the user's actual favorite genres instead of fixed
  // editorial pools. The RNG is seeded by day/taste/shuffle, so each calendar
  // day gets a stable rotation while Shuffle still changes the candidate mix.
  const quiet = async (p: Promise<any>) => {
    try {
      return await p;
    } catch {
      return { results: [] };
    }
  };

  const shuffledFavorites = shuffleWith(
    Array.from(new Set(favoriteGenres)),
    random
  );
  const drawGenres = shuffledFavorites.slice(0, 5);
  const randomPage = () => 1 + Math.floor(random() * 3);

  const tasks: Promise<any>[] = [];
  if (media === 'movie') {
    for (const genre of drawGenres) {
      tasks.push(quiet(tmdb.genreMovies(genre, randomPage())));
    }
    // Bollywood/Hindi and Korean movies are first-class candidates. They are
    // ranked by the scorer, so they surface when taste supports them and stay
    // out of the way when it does not.
    tasks.push(
      quiet(tmdb.bollywood(randomPage())),
      quiet(tmdb.moviesByLang('ko', randomPage())),
      quiet(tmdb.popularMovies(randomPage())),
      quiet(tmdb.trending('movie', randomPage()))
    );
    if ((languageScores.hi ?? 0) > 0) {
      tasks.push(quiet(tmdb.moviesByLang('hi', randomPage())));
    }
  } else {
    for (const genre of drawGenres) {
      tasks.push(quiet(tmdb.genreTV(genre, randomPage())));
    }
    tasks.push(
      // Hindi series candidates come from the OTT-only source so the
      // recommender never suggests legacy linear-TV serials.
      quiet(hindiOtt.page(randomPage())),
      quiet(tmdb.tvByLang('ko', randomPage())),
      quiet(tmdb.popularTV(randomPage())),
      quiet(tmdb.trending('tv', randomPage()))
    );
  }

  const pools = await Promise.all(tasks);
  const seen = new Set<string>();
  const candidates: CandidateTitle[] = [];

  for (const pool of pools) {
    for (const item of pool?.results ?? []) {
      if (!item.poster_path) continue;
      const key = `${media}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        id: item.id,
        title: item.title ?? item.name ?? 'Unknown',
        poster_path: item.poster_path,
        vote_average: item.vote_average,
        vote_count: item.vote_count,
        popularity: item.popularity,
        genre_ids: item.genre_ids ?? [],
        release_date: item.release_date ?? item.first_air_date,
        original_language: item.original_language,
        media_type: media,
      });
    }
  }

  return candidates;
}

// Bounds query parsing — real profiles stay far below this.
const MAX_IDS = 1000;

function parseIds(value: string | null): number[] {
  return (value ?? '')
    .split(',', MAX_IDS)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * Parses compact learned weights such as "28:3,35:1" or "hi:2,ko:1".
 * Malformed entries are ignored so old/simple query strings keep working.
 */
function parseScores(value: string | null): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const entry of (value ?? '').split(',', MAX_IDS)) {
    const [rawKey, rawScore] = entry.split(':').map((part) => part.trim());
    if (!rawKey) continue;
    const score = Number(rawScore);
    if (Number.isFinite(score) && score > 0) {
      scores[rawKey.toLowerCase()] = score;
    }
  }
  return scores;
}

function parseDay(value: string | null): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const media: RecommendationMedia =
    searchParams.get('media') === 'tv' ? 'tv' : 'movie';
  const lookup = media === 'movie' ? MOVIE_LOOKUP : TV_LOOKUP;
  // Movie-only ids (Horror, Thriller, …) never tag a series and vice versa.
  // Left in, they inflate the scorer's total weight and deflate every match;
  // unknown ids would also fan out into wasted TMDB discover calls.
  const favoriteGenres = parseIds(searchParams.get('favoriteGenres')).filter((id) =>
    lookup.has(id)
  );
  const watchedIds = parseIds(searchParams.get('watchedIds'));
  const likedIds = parseIds(searchParams.get('likedIds'));
  const dislikedIds = parseIds(searchParams.get('dislikedIds'));
  const genreWeights = Object.fromEntries(
    Object.entries(parseScores(searchParams.get('genreWeights'))).filter(([id]) =>
      lookup.has(Number(id))
    )
  );
  const languageScores = parseScores(searchParams.get('languageScores'));
  const day = parseDay(searchParams.get('date'));
  const shuffle = searchParams.get('shuffle') ?? '0';
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 48);

  // Daily rotation key: the same taste returns the same list all day, a new
  // calendar day rotates candidates, and Shuffle explicitly changes the mix.
  const seedInput = [
    media,
    day,
    shuffle,
    [...favoriteGenres].sort((a, b) => a - b).join(','),
    Object.keys(languageScores).sort().join(','),
  ].join('|');
  const random = mulberry32(hashSeed(seedInput));

  try {
    const candidates = await fetchCandidates(
      media,
      favoriteGenres,
      languageScores,
      random
    );
    const profile = {
      favoriteGenres,
      watchedIds,
      likedIds,
      dislikedIds,
      genreWeights,
      languageScores,
    };
    const scored = scoreTitles(candidates, profile, lookup, media);
    // Genre weights drive the primary-genre choice in the diversity pass.
    const weights = new Map(
      Object.entries(genreWeights).map(([k, v]) => [Number(k), v])
    );
    for (const id of favoriteGenres) {
      if (!weights.has(id)) weights.set(id, 1);
    }
    const diversified = diversifyTitles(scored, limit, weights);
    return NextResponse.json({
      media,
      day,
      shuffle,
      count: Math.min(scored.length, limit),
      results: diversified,
    });
  } catch {
    return NextResponse.json({
      media,
      day,
      shuffle,
      count: 0,
      results: [],
    });
  }
}
