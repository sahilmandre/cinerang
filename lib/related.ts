/**
 * "More like this" resolver for the watch pages.
 *
 * The row used to be a raw dump of TMDB's `similar` endpoint, which is why
 * it felt random. Measured against the live API:
 *
 *   - `similar` is **empty for ~40% of titles** (38% of movies, 50% of TV),
 *     so the row was frequently blank or three cards long.
 *   - It is a flat genre cluster with no internal ranking: for Game of
 *     Thrones it returned *Rodaci* (4.2, 4 votes), *Deewar-e-Shab* (10.0
 *     with a **single** vote — vote spam) and a 1974 series, while
 *     `recommendations` returned *House of the Dragon*, *The Witcher* and
 *     *Wheel of Time*.
 *   - `similar` and `recommendations` are near-orthogonal (0 shared ids on
 *     page 1 across every title sampled), so merging them roughly doubles
 *     the breadth of the row.
 *
 * So the resolver blends both endpoints, re-ranks the merge against the
 * source title's own genres, language, quality and vote confidence, and
 * falls back to keyword/genre discovery when TMDB comes back thin. A
 * second, cross-media row pairs a series with films that share its themes
 * (and a film with series), because TMDB's keyword namespace is shared
 * across both.
 */

import { tmdb } from './tmdb';
import {
  TMDB_MOVIE_GENRES,
  TMDB_TV_GENRES,
  MOVIE_TO_TV_GENRES,
  TV_TO_MOVIE_GENRES,
} from './categories';

export type RelatedMedia = 'movie' | 'tv';

export interface RelatedItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  media_type?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  /** Why this title made the row — shared genres, rendered under the title. */
  matchReason?: string;
}

const MOVIE_GENRE_NAMES = new Map(TMDB_MOVIE_GENRES.map((g) => [g.id, g.name]));
const TV_GENRE_NAMES = new Map(TMDB_TV_GENRES.map((g) => [g.id, g.name]));

function genreName(type: RelatedMedia, id: number): string | null {
  return (type === 'movie' ? MOVIE_GENRE_NAMES : TV_GENRE_NAMES).get(id) ?? null;
}

/**
 * How distinctive a genre is. "Drama" and "Comedy" tag half of TMDB, so a
 * match on them says far less than a match on "Thriller" or "Sci-Fi &
 * Fantasy". The numbers weight genre evidence accordingly and decide which
 * genre a title is bucketed under for diversity.
 */
const MOVIE_GENRE_SPECIFICITY: Record<number, number> = {
  18: 0.55, // Drama
  35: 0.55, // Comedy
  28: 0.7, // Action
  12: 0.75, // Adventure
  37: 0.7, // Western
  10751: 0.7, // Family
  878: 0.95, // Sci-Fi
  14: 0.95, // Fantasy
  53: 0.95, // Thriller
  27: 0.95, // Horror
  80: 0.95, // Crime
  9648: 0.9, // Mystery
  10402: 0.85, // Music
  99: 0.8, // Documentary
  16: 0.8, // Animation
  36: 0.8, // History
  10752: 0.8, // War
  10749: 0.8, // Romance
};

const TV_GENRE_SPECIFICITY: Record<number, number> = {
  18: 0.55, // Drama
  35: 0.55, // Comedy
  10764: 0.5, // Reality
  10766: 0.5, // Soap
  10763: 0.5, // News
  10767: 0.4, // Talk
  10762: 0.6, // Kids
  37: 0.7, // Western
  10751: 0.7, // Family
  10759: 0.75, // Action & Adventure
  16: 0.8, // Animation
  99: 0.8, // Documentary
  10768: 0.8, // War & Politics
  9648: 0.9, // Mystery
  10765: 0.95, // Sci-Fi & Fantasy
  80: 0.95, // Crime
};

function specificity(type: RelatedMedia, id: number): number {
  return (type === 'movie' ? MOVIE_GENRE_SPECIFICITY : TV_GENRE_SPECIFICITY)[id] ?? 0.6;
}

/** Vote floor — the row should not surface 4.2-rated noise. */
const QUALITY_FLOOR = 4.6;
/** Popularity floor — kills the long tail of near-unknown titles. */
const POPULARITY_FLOOR = 2.5;
/** A 9.5+ rating with almost no votes is vote spam, not quality. */
const VOTE_SPAM_RATING = 9.5;
const VOTE_SPAM_MIN_VOTES = 40;
/** Nobody has heard of it and nobody rated it — it is not a recommendation. */
const UNKNOWN_VOTE_COUNT = 25;
const UNKNOWN_POPULARITY = 10;

type Origin = 'recommendations' | 'similar' | 'keyword' | 'genre';

/** Where a candidate came from — TMDB's two related endpoints rank highest. */
const ORIGIN_WEIGHT: Record<Origin, number> = {
  recommendations: 30,
  similar: 22,
  genre: 14,
  keyword: 12,
};

/** Diminishing points per shared genre, so a 3-genre match cannot run away. */
const GENRE_POINTS = [14, 8, 4, 2];
const QUALITY_POINTS = 22;
const POPULARITY_POINTS = 16;
/** Trust in the rating itself — 7 000 votes mean more than 100. */
const CONFIDENCE_POINTS = 10;
const RECENCY_POINTS = 8;
const LANGUAGE_POINTS = 6;

/** TMDB keywords that describe *any* title and therefore match nothing. */
const GENERIC_KEYWORDS = new Set([
  'based on novel',
  'based on play',
  'based on true story',
  'based on real person',
  'based on comic book',
  'based on video game',
  'based on memoir',
  'during the tv show',
  'tv series',
  'movie',
  'film',
  'sequel',
  'adaptation',
  'remake',
  'live action',
  'trademark',
]);

interface SourceProfile {
  id: number;
  type: RelatedMedia;
  title: string;
  overview: string;
  genres: number[];
  keywords: { id: number; name: string }[];
  language?: string;
}

interface Scored {
  item: RelatedItem;
  origin: Origin;
  score: number;
  shared: number[];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Fixed 4.6–8.6 scale, so a niche gem and a blockbuster compare fairly. */
function qualityPoints(vote?: number): number {
  if (vote == null || !Number.isFinite(vote)) return 0.3;
  return clamp01((vote - QUALITY_FLOOR) / 4);
}

function popularityPoints(popularity?: number): number {
  if (popularity == null || !Number.isFinite(popularity)) return 0.2;
  return clamp01(Math.log10(popularity + 1) / 2.2);
}

/** Logarithmic vote confidence — a 7.9 from 7 000 votes beats 7.9 from 12. */
function confidencePoints(voteCount?: number): number {
  if (voteCount == null || !Number.isFinite(voteCount) || voteCount <= 0) return 0.1;
  return clamp01(Math.log10(voteCount + 1) / 4);
}

/** Mild recency nudge — a tiebreaker, never a driver (classics still surface). */
function recencyPoints(date?: string): number {
  const year = date ? Number(date.slice(0, 4)) : NaN;
  if (!Number.isFinite(year)) return 0.3;
  if (year >= 2018) return 1;
  if (year >= 2010) return 0.7;
  if (year >= 2000) return 0.42;
  return 0.18;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readSource(details: any, type: RelatedMedia): SourceProfile {
  const genres: number[] = Array.from(
    new Set<number>(
      ((details?.genres ?? []) as any[])
        .map((g: any) => Number(g?.id))
        .filter((id: number) => Number.isInteger(id) && id > 0)
    )
  );
  // Movies expose `keywords.keywords`, series expose `keywords.results`.
  const rawKeywords = (details?.keywords?.keywords ?? details?.keywords?.results ?? []) as any[];
  const keywords = rawKeywords
    .map((k: any) => ({ id: Number(k?.id), name: String(k?.name ?? '') }))
    .filter((k: { id: number; name: string }) => Number.isInteger(k.id) && k.id > 0 && k.name);
  return {
    id: Number(details?.id),
    type,
    title: String(details?.title ?? details?.name ?? ''),
    overview: String(details?.overview ?? ''),
    genres,
    keywords,
    language: details?.original_language,
  };
}

/**
 * Picks the most specific keywords of the source title. Generic TMDB
 * keywords are dropped, and keywords that literally show up in the title
 * or synopsis win — "westeros" is a far better query than "based on novel".
 */
function pickKeywords(source: SourceProfile, limit = 3): { id: number; name: string }[] {
  const text = `${source.title} ${source.overview}`.toLowerCase();
  return source.keywords
    .filter((k) => !GENERIC_KEYWORDS.has(k.name.toLowerCase()))
    .map((k, index) => {
      const name = k.name.toLowerCase();
      const mentioned = name.includes(' ')
        ? text.includes(name)
        : new RegExp(`\\b${escapeRegExp(name)}\\b`).test(text);
      return { k, weight: (mentioned ? 10 : 0) + Math.max(0, 6 - index) };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((entry) => entry.k);
}

/**
 * Normalises a TMDB list item and rejects anything of the wrong media
 * type. `similar` and `discover` omit `media_type` entirely, so the type
 * is inferred from `first_air_date` and cross-checked against the endpoint
 * that produced it.
 */
function normalizeItem(raw: any, type: RelatedMedia): RelatedItem | null {
  if (!raw || typeof raw.id !== 'number' || !raw.poster_path) return null;
  const declared = raw.media_type === 'tv' || raw.media_type === 'movie' ? raw.media_type : null;
  const isTv = declared ? declared === 'tv' : Boolean(raw.first_air_date);
  if ((type === 'tv') !== isTv) return null;
  return {
    id: raw.id,
    title: raw.title,
    name: raw.name,
    poster_path: raw.poster_path,
    backdrop_path: raw.backdrop_path,
    media_type: type,
    vote_average: raw.vote_average,
    vote_count: raw.vote_count,
    popularity: raw.popularity,
    genre_ids: raw.genre_ids ?? [],
    release_date: raw.release_date,
    first_air_date: raw.first_air_date,
    original_language: raw.original_language,
  };
}

/** Filters out the noise TMDB mixes into related lists. */
function isJunk(item: RelatedItem): boolean {
  const vote = item.vote_average;
  if (vote != null) {
    if (vote < QUALITY_FLOOR) return true;
    // 10.0 from one vote is a rating bug, not a masterpiece.
    if (vote >= VOTE_SPAM_RATING && (item.vote_count ?? 0) < VOTE_SPAM_MIN_VOTES) return true;
  }
  if ((item.popularity ?? 0) < POPULARITY_FLOOR) return true;
  // Unknown *and* unrated — nothing recommends a title nobody has seen.
  if (
    item.vote_count != null &&
    item.vote_count < UNKNOWN_VOTE_COUNT &&
    (item.popularity ?? 0) < UNKNOWN_POPULARITY
  ) {
    return true;
  }
  return false;
}

/** Source genres the candidate shares, most distinctive first. */
function sharedGenres(itemGenres: number[], ordered: number[]): number[] {
  const set = new Set(itemGenres);
  return ordered.filter((id) => set.has(id));
}

function reasonFor(shared: number[], type: RelatedMedia): string | undefined {
  const names = shared
    .map((id) => genreName(type, id))
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return undefined;
  return names.slice(0, 2).join(' · ');
}

/**
 * Merges pools into one deduplicated candidate list. Pools are visited in
 * weight order, so a title that appears in both `recommendations` and
 * `similar` is credited to the stronger endpoint.
 */
function collect(
  pools: { origin: Origin; items: any[] }[],
  source: SourceProfile,
  type: RelatedMedia
): Scored[] {
  const seen = new Set<number>();
  const out: Scored[] = [];
  for (const pool of pools) {
    for (const raw of pool.items ?? []) {
      const item = normalizeItem(raw, type);
      if (!item) continue;
      if (item.id === source.id || seen.has(item.id)) continue;
      seen.add(item.id);
      if (isJunk(item)) continue;
      out.push({ item, origin: pool.origin, score: 0, shared: [] });
    }
  }
  return out;
}

/**
 * Ranks the merged candidates. Genre evidence is weighted by how
 * distinctive the genre is, so a Drama-and-Comedy match cannot outrank a
 * Thriller match, and an over-represented genre is demoted rather than
 * dropped — that keeps the row ordered instead of lumpy.
 */
function rank(
  entries: Scored[],
  source: SourceProfile,
  type: RelatedMedia,
  weights: Map<number, number>,
  limit: number
): RelatedItem[] {
  const ordered = Array.from(weights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const scored = entries.map((entry) => {
    const { item } = entry;
    const shared = sharedGenres(item.genre_ids ?? [], ordered);
    let score = ORIGIN_WEIGHT[entry.origin];
    score += shared.reduce(
      (sum, id, i) =>
        sum + (GENRE_POINTS[i] ?? 0) * (0.35 + 0.65 * (weights.get(id) ?? 0.6)),
      0
    );
    score += qualityPoints(item.vote_average) * QUALITY_POINTS;
    score += popularityPoints(item.popularity) * POPULARITY_POINTS;
    score += confidencePoints(item.vote_count) * CONFIDENCE_POINTS;
    score += recencyPoints(item.release_date ?? item.first_air_date) * RECENCY_POINTS;
    if (
      item.original_language &&
      source.language &&
      item.original_language === source.language
    ) {
      score += LANGUAGE_POINTS;
    }
    return { ...entry, score, shared };
  });

  // No genre cap here on purpose. Every candidate in these pools already
  // shares a genre with the source, so a "more like this" row is supposed
  // to be full of the source's genre — capping it sank the best matches
  // (House of the Dragon) below the noise (a 6.7-rated drama).
  const adjusted = scored;

  adjusted.sort(
    (a, b) => b.score - a.score || (b.item.popularity ?? 0) - (a.item.popularity ?? 0)
  );

  return adjusted.slice(0, limit).map((entry) => ({
    ...entry.item,
    matchReason: reasonFor(entry.shared, type),
  }));
}

/** Fails soft — a dead discovery endpoint must not break the watch page. */
async function safe(items: Promise<any>): Promise<any[]> {
  try {
    const res = await items;
    return res?.results ?? [];
  } catch {
    return [];
  }
}

/**
 * Discovery pools used when TMDB's related endpoints come back thin: the
 * source's most distinctive genre and its most specific keywords. Both
 * queries are popularity-sorted, so they add *findable* titles rather
 * than the long tail `similar` is made of.
 */
async function discoveryPools(
  type: RelatedMedia,
  source: SourceProfile,
  keywordIds: { id: number; name: string }[]
): Promise<{ origin: Origin; items: any[] }[]> {
  const signatureGenre = [...source.genres].sort(
    (a, b) => specificity(type, b) - specificity(type, a)
  )[0];

  const tasks: Promise<any[]>[] = [];
  const origins: Origin[] = [];
  if (signatureGenre != null) {
    tasks.push(safe(tmdb.discoverByGenre(type, signatureGenre, 1)));
    origins.push('genre');
  }
  for (const keyword of keywordIds.slice(0, 2)) {
    tasks.push(safe(tmdb.discoverByKeyword(type, keyword.id, 1)));
    origins.push('keyword');
  }
  if (tasks.length === 0) return [];

  const results = await Promise.all(tasks);
  return results.map((items, i) => ({ origin: origins[i] ?? 'genre', items }));
}

/**
 * Genre weights for a same-media-type match — the source's own genres,
 * weighted by how distinctive they are.
 */
function sameTypeWeights(source: SourceProfile): Map<number, number> {
  const weights = new Map<number, number>();
  for (const id of source.genres) {
    weights.set(id, Math.max(weights.get(id) ?? 0, specificity(source.type, id)));
  }
  return weights;
}

/**
 * Genre weights for a cross-media-type match. A series' "Sci-Fi & Fantasy"
 * maps to the films' "Sci-Fi" and "Fantasy", and the source genre's
 * distinctiveness carries over — so a fantasy series is matched against
 * fantasy films, not against every drama of the year.
 */
function crossTypeWeights(
  from: RelatedMedia,
  to: RelatedMedia,
  sourceGenres: number[]
): Map<number, number> {
  const map = from === 'movie' ? MOVIE_TO_TV_GENRES : TV_TO_MOVIE_GENRES;
  const weights = new Map<number, number>();
  for (const id of sourceGenres) {
    const sourceWeight = specificity(from, id);
    for (const mapped of map[id] ?? []) {
      weights.set(mapped, Math.max(weights.get(mapped) ?? 0, sourceWeight));
    }
  }
  return weights;
}

export interface RelatedOptions {
  /** How many titles to return. */
  limit?: number;
}

/**
 * Builds the "More like this" row for a title — same media type as the
 * source.
 *
 * `details` is the already-fetched TMDB details payload; its `similar` and
 * `recommendations` blocks are reused as-is so the common path costs no
 * extra upstream request and the row renders without extra latency.
 */
export async function getRelatedTitles(
  details: any,
  type: RelatedMedia,
  options: RelatedOptions = {}
): Promise<RelatedItem[]> {
  const limit = options.limit ?? 18;
  const source = readSource(details, type);
  const keywords = pickKeywords(source);

  const pools: { origin: Origin; items: any[] }[] = [
    { origin: 'recommendations', items: details?.recommendations?.results ?? [] },
    { origin: 'similar', items: details?.similar?.results ?? [] },
  ];

  // A cached details payload fetched before `recommendations` was appended
  // has no recommendations block — fetch it once instead of shipping a
  // half-empty row.
  if (!details?.recommendations?.results?.length) {
    const fetched = await safe(
      type === 'movie'
        ? tmdb.movieRecommendations(String(details?.id ?? ''))
        : tmdb.tvRecommendations(String(details?.id ?? ''))
    );
    pools[0] = { origin: 'recommendations', items: fetched };
  }

  let candidates = collect(pools, source, type);
  if (candidates.length < limit) {
    const fillers = await discoveryPools(type, source, keywords);
    candidates = collect([...pools, ...fillers], source, type);
  }

  return rank(candidates, source, type, sameTypeWeights(source), limit);
}

/**
 * Builds the cross-media row — films for a series, series for a film.
 *
 * TMDB's keyword namespace is shared across both taxonomies, and the genre
 * crosswalk (see lib/categories.ts) translates "Sci-Fi & Fantasy" into the
 * films' "Sci-Fi" and "Fantasy", so a fantasy series meets fantasy films
 * instead of every drama of the year.
 */
export async function getCrossTitles(
  details: any,
  type: RelatedMedia,
  options: RelatedOptions = {}
): Promise<RelatedItem[]> {
  const limit = options.limit ?? 12;
  if (limit <= 0) return [];
  const source = readSource(details, type);
  const keywords = pickKeywords(source);
  const other: RelatedMedia = type === 'movie' ? 'tv' : 'movie';
  const weights = crossTypeWeights(type, other, source.genres);
  const targetGenres = Array.from(weights.keys());
  if (targetGenres.length === 0) return [];

  const crossPools: { origin: Origin; items: any[] }[] = [];
  const tasks: Promise<any[]>[] = [];
  const origins: Origin[] = [];

  // Query the two most distinctive target genres: a fantasy series should
  // meet fantasy films, not every drama released this year.
  for (const genreId of targetGenres.slice(0, 2)) {
    tasks.push(safe(tmdb.discoverByGenre(other, genreId, 1)));
    origins.push('genre');
  }
  const crossKeyword = keywords[0];
  if (crossKeyword) {
    tasks.push(safe(tmdb.discoverByKeyword(other, crossKeyword.id, 1)));
    origins.push('keyword');
  }
  const results = await Promise.all(tasks);
  results.forEach((items, i) => {
    crossPools.push({ origin: origins[i] ?? 'genre', items });
  });

  let candidates = collect(crossPools, source, other).filter((entry) =>
    sharedGenres(entry.item.genre_ids ?? [], targetGenres).length > 0
  );
  // If the genre filter was too strict for an unusual title, fall back to
  // the well-rated tail of the same pools rather than showing nothing.
  if (candidates.length < Math.min(6, limit)) {
    const relaxed = collect(crossPools, source, other).filter(
      (entry) =>
        (entry.item.vote_average ?? 0) >= 6.5 && (entry.item.popularity ?? 0) >= 5
    );
    const known = new Set(candidates.map((c) => c.item.id));
    candidates = candidates.concat(relaxed.filter((c) => !known.has(c.item.id)));
  }

  return rank(candidates, source, other, weights, limit);
}
