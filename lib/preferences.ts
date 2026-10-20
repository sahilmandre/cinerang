import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES } from './categories';
import { getContinue } from './storage';
import { localDayKey } from './utils';

export type TasteKind = 'movie' | 'tv';

/**
 * Persisted taste profile. Movie and TV tastes are tracked separately because
 * TMDB genre vocabularies — and user preferences — differ between them.
 *
 * genreScores/tvGenreScores/languageScores are frequency signals learned from
 * explicit quiz picks. They let the scorer weigh repeated genre/language
 * choices instead of treating every selected genre equally.
 */
export interface UserTaste {
  favoriteGenres: number[]; // TMDB movie genre ids the user likes
  favoriteTvGenres: number[]; // TMDB TV genre ids the user likes
  likedMovieIds: number[]; // movies the user explicitly liked
  likedTvIds: number[]; // series the user explicitly liked
  dislikedMovieIds: number[]; // movies hidden from future recommendations
  dislikedTvIds: number[]; // series hidden from future recommendations
  watchedMovieIds: number[]; // movie watch/continue history
  watchedTvIds: number[]; // series watch/continue history
  genreScores: Record<string, number>; // movie genre id -> pick frequency
  tvGenreScores: Record<string, number>; // TV genre id -> pick frequency
  languageScores: Record<string, number>; // original language -> pick frequency
  updatedAt: number;
}

const MOVIE_GENRE_IDS = new Set(TMDB_MOVIE_GENRES.map((g) => String(g.id)));
const TV_GENRE_IDS = new Set(TMDB_TV_GENRES.map((g) => String(g.id)));

function pickScores(
  scores: Record<string, number>,
  allowed: Set<string>
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(scores).filter(([key]) => allowed.has(key))
  );
}

const scoresKeyFor = (kind: TasteKind) =>
  kind === 'movie' ? 'genreScores' : 'tvGenreScores';

export function genreScoresFor(
  taste: UserTaste,
  kind: TasteKind
): Record<string, number> {
  return taste[scoresKeyFor(kind)];
}

const KEY = 'cinejoy.taste';

/** Fired on window whenever taste changes, so client rows can refresh live. */
export const TASTE_EVENT = 'cinerang:taste-updated';

const EMPTY: UserTaste = {
  favoriteGenres: [],
  favoriteTvGenres: [],
  likedMovieIds: [],
  likedTvIds: [],
  dislikedMovieIds: [],
  dislikedTvIds: [],
  watchedMovieIds: [],
  watchedTvIds: [],
  genreScores: {},
  tvGenreScores: {},
  languageScores: {},
  updatedAt: 0,
};

function cleanIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  );
}

function cleanScores(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const next: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const score = Number(raw);
    if (key && Number.isFinite(score) && score > 0) {
      next[key] = score;
    }
  }
  return next;
}

export function getTaste(): UserTaste {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<UserTaste>;
    // Profiles saved before the movie/TV split kept one shared genreScores
    // map. Split it by vocabulary once; shared ids (Drama, Comedy, …) seed
    // both sides.
    const legacyScores = cleanScores(parsed.genreScores);
    const split = parsed.tvGenreScores == null;
    return {
      ...EMPTY,
      ...parsed,
      favoriteGenres: cleanIds(parsed.favoriteGenres),
      favoriteTvGenres: cleanIds(parsed.favoriteTvGenres),
      likedMovieIds: cleanIds(parsed.likedMovieIds),
      likedTvIds: cleanIds(parsed.likedTvIds),
      dislikedMovieIds: cleanIds(parsed.dislikedMovieIds),
      dislikedTvIds: cleanIds(parsed.dislikedTvIds),
      watchedMovieIds: cleanIds(parsed.watchedMovieIds),
      watchedTvIds: cleanIds(parsed.watchedTvIds),
      genreScores: split ? pickScores(legacyScores, MOVIE_GENRE_IDS) : legacyScores,
      tvGenreScores: split
        ? pickScores(legacyScores, TV_GENRE_IDS)
        : cleanScores(parsed.tvGenreScores),
      languageScores: cleanScores(parsed.languageScores),
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch {
    return EMPTY;
  }
}

export function saveTaste(partial: Partial<UserTaste>): UserTaste {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const current = getTaste();
    const next: UserTaste = {
      ...current,
      ...partial,
      favoriteGenres: partial.favoriteGenres
        ? cleanIds(partial.favoriteGenres)
        : current.favoriteGenres,
      favoriteTvGenres: partial.favoriteTvGenres
        ? cleanIds(partial.favoriteTvGenres)
        : current.favoriteTvGenres,
      likedMovieIds: partial.likedMovieIds
        ? cleanIds(partial.likedMovieIds)
        : current.likedMovieIds,
      likedTvIds: partial.likedTvIds
        ? cleanIds(partial.likedTvIds)
        : current.likedTvIds,
      dislikedMovieIds: partial.dislikedMovieIds
        ? cleanIds(partial.dislikedMovieIds)
        : current.dislikedMovieIds,
      dislikedTvIds: partial.dislikedTvIds
        ? cleanIds(partial.dislikedTvIds)
        : current.dislikedTvIds,
      watchedMovieIds: partial.watchedMovieIds
        ? cleanIds(partial.watchedMovieIds)
        : current.watchedMovieIds,
      watchedTvIds: partial.watchedTvIds
        ? cleanIds(partial.watchedTvIds)
        : current.watchedTvIds,
      genreScores: partial.genreScores
        ? cleanScores(partial.genreScores)
        : current.genreScores,
      tvGenreScores: partial.tvGenreScores
        ? cleanScores(partial.tvGenreScores)
        : current.tvGenreScores,
      languageScores: partial.languageScores
        ? cleanScores(partial.languageScores)
        : current.languageScores,
      updatedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(TASTE_EVENT));
    return next;
  } catch {
    return EMPTY;
  }
}

/**
 * Records one quiz round's explicit picks. Genre/language frequencies grow
 * with repeated picks, so the scorer can distinguish a passing interest from
 * a strong, repeated preference.
 */
export function addQuizSignals(input: {
  kind: TasteKind;
  titleIds: number[];
  genreIds: number[];
  languages: Array<string | null | undefined>;
}): UserTaste {
  const current = getTaste();
  const favoriteKey =
    input.kind === 'movie' ? 'favoriteGenres' : 'favoriteTvGenres';
  const likedKey = input.kind === 'movie' ? 'likedMovieIds' : 'likedTvIds';
  const dislikedKey =
    input.kind === 'movie' ? 'dislikedMovieIds' : 'dislikedTvIds';
  const titleIds = cleanIds(input.titleIds);
  const scoresKey = scoresKeyFor(input.kind);

  const nextGenreScores = { ...current[scoresKey] };
  for (const genreId of cleanIds(input.genreIds)) {
    const key = String(genreId);
    nextGenreScores[key] = (nextGenreScores[key] ?? 0) + 1;
  }

  const nextLanguageScores = { ...current.languageScores };
  for (const language of input.languages) {
    if (!language) continue;
    const key = language.toLowerCase();
    nextLanguageScores[key] = (nextLanguageScores[key] ?? 0) + 1;
  }

  return saveTaste({
    [favoriteKey]: Array.from(
      new Set([
        ...(current[favoriteKey] as number[]),
        ...cleanIds(input.genreIds),
      ])
    ),
    [likedKey]: Array.from(
      new Set([...(current[likedKey] as number[]), ...titleIds])
    ),
    // An explicit like always clears a previous dislike for the same title.
    [dislikedKey]: (current[dislikedKey] as number[]).filter(
      (id) => !titleIds.includes(id)
    ),
    [scoresKey]: nextGenreScores,
    languageScores: nextLanguageScores,
  } as Partial<UserTaste>);
}

/**
 * Likes a recommended title and trains the model from its genres/language.
 * Liked titles are excluded from later recommendations, while their genre and
 * language signals make similar titles rank higher.
 */
export function recordTitleLiked(input: {
  kind: TasteKind;
  id: number;
  genreIds?: number[];
  languages?: Array<string | null | undefined>;
}): UserTaste {
  return addQuizSignals({
    kind: input.kind,
    titleIds: [input.id],
    genreIds: input.genreIds ?? [],
    languages: input.languages ?? [],
  });
}

/**
 * Undoes recordTitleLiked: drops the like and takes back the +1 genre and
 * language frequency it added, so toggling Like never inflates the profile.
 */
export function recordTitleUnliked(input: {
  kind: TasteKind;
  id: number;
  genreIds?: number[];
  languages?: Array<string | null | undefined>;
}): UserTaste {
  const current = getTaste();
  const likedKey = input.kind === 'movie' ? 'likedMovieIds' : 'likedTvIds';
  const scoresKey = scoresKeyFor(input.kind);

  const decrement = (scores: Record<string, number>, key: string) => {
    const next = (scores[key] ?? 0) - 1;
    if (next > 0) scores[key] = next;
    else delete scores[key];
  };
  const nextGenreScores = { ...current[scoresKey] };
  for (const genreId of cleanIds(input.genreIds ?? [])) {
    decrement(nextGenreScores, String(genreId));
  }
  const nextLanguageScores = { ...current.languageScores };
  for (const language of input.languages ?? []) {
    if (language) decrement(nextLanguageScores, language.toLowerCase());
  }

  return saveTaste({
    [likedKey]: current[likedKey].filter((titleId) => titleId !== input.id),
    [scoresKey]: nextGenreScores,
    languageScores: nextLanguageScores,
  } as Partial<UserTaste>);
}

/**
 * Dislikes a recommended title. It is hidden from later recommendations and
 * removed from likes if it was previously liked. The title's genres are also
 * gently dampened (−0.5 pick frequency each, never below zero) so repeated
 * dislikes can neutralize an over-eager genre without hard-deleting the
 * user's explicit quiz selections.
 */
export function recordTitleDisliked(
  id: number,
  kind: TasteKind,
  genreIds: number[] = []
): UserTaste {
  const current = getTaste();
  const likedKey = kind === 'movie' ? 'likedMovieIds' : 'likedTvIds';
  const dislikedKey =
    kind === 'movie' ? 'dislikedMovieIds' : 'dislikedTvIds';
  const scoresKey = scoresKeyFor(kind);

  const nextGenreScores = { ...current[scoresKey] };
  for (const genreId of cleanIds(genreIds)) {
    const key = String(genreId);
    const next = (nextGenreScores[key] ?? 0) - 0.5;
    if (next > 0) nextGenreScores[key] = next;
    else delete nextGenreScores[key];
  }

  return saveTaste({
    [likedKey]: current[likedKey].filter((titleId) => titleId !== id),
    [dislikedKey]: Array.from(new Set([...current[dislikedKey], id])),
    [scoresKey]: nextGenreScores,
  } as Partial<UserTaste>);
}

/** True once the user has given any taste signal for this media type. */
export function hasTasteFor(taste: UserTaste, kind: TasteKind): boolean {
  const favorites = kind === 'movie' ? taste.favoriteGenres : taste.favoriteTvGenres;
  const liked = kind === 'movie' ? taste.likedMovieIds : taste.likedTvIds;
  return (
    favorites.length > 0 ||
    liked.length > 0 ||
    Object.keys(genreScoresFor(taste, kind)).length > 0
  );
}

function serializeScores(scores: Record<string, number>): string {
  return Object.entries(scores)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .map(([key, value]) => `${key}:${Math.round(value * 100) / 100}`)
    .join(',');
}

/**
 * Query string for /api/recommendations. Titles in Continue Watching count
 * as watched, so the recommender doesn't suggest what the user already
 * started.
 */
export function recommendationParams(
  taste: UserTaste,
  kind: TasteKind,
  options: { limit: number; shuffle: number }
): URLSearchParams {
  const params = new URLSearchParams();
  const favorites = kind === 'movie' ? taste.favoriteGenres : taste.favoriteTvGenres;
  const watched = Array.from(
    new Set([
      ...(kind === 'movie' ? taste.watchedMovieIds : taste.watchedTvIds),
      ...getContinue()
        .filter((item) => item.mediaType === kind)
        .map((item) => item.id),
    ])
  );
  const liked = kind === 'movie' ? taste.likedMovieIds : taste.likedTvIds;
  const disliked = kind === 'movie' ? taste.dislikedMovieIds : taste.dislikedTvIds;
  params.set('media', kind);
  if (favorites.length) params.set('favoriteGenres', favorites.join(','));
  if (watched.length) params.set('watchedIds', watched.join(','));
  if (liked.length) params.set('likedIds', liked.join(','));
  if (disliked.length) params.set('dislikedIds', disliked.join(','));
  const genreWeights = serializeScores(genreScoresFor(taste, kind));
  const languageScores = serializeScores(taste.languageScores);
  if (genreWeights) params.set('genreWeights', genreWeights);
  if (languageScores) params.set('languageScores', languageScores);
  params.set('limit', String(options.limit));
  // Daily rotation key plus manual shuffle token. The same taste returns
  // the same list all day; a new calendar day rotates the recommendations.
  params.set('date', localDayKey());
  params.set('shuffle', String(options.shuffle));
  return params;
}

export function addWatched(id: number, kind: TasteKind = 'movie'): UserTaste {
  const current = getTaste();
  const key = kind === 'movie' ? 'watchedMovieIds' : 'watchedTvIds';
  return saveTaste({
    [key]: Array.from(new Set([...current[key], id])),
  } as Partial<UserTaste>);
}

export function addLiked(id: number, kind: TasteKind = 'movie'): UserTaste {
  const current = getTaste();
  const key = kind === 'movie' ? 'likedMovieIds' : 'likedTvIds';
  return saveTaste({
    [key]: Array.from(new Set([...current[key], id])),
  } as Partial<UserTaste>);
}

export function removeLiked(id: number, kind: TasteKind = 'movie'): UserTaste {
  const current = getTaste();
  const key = kind === 'movie' ? 'likedMovieIds' : 'likedTvIds';
  return saveTaste({
    [key]: current[key].filter((x) => x !== id),
  } as Partial<UserTaste>);
}

export function isLiked(id: number, kind: TasteKind = 'movie'): boolean {
  const taste = getTaste();
  return (kind === 'movie' ? taste.likedMovieIds : taste.likedTvIds).includes(
    id
  );
}

export function isDisliked(id: number, kind: TasteKind = 'movie'): boolean {
  const taste = getTaste();
  return (
    kind === 'movie' ? taste.dislikedMovieIds : taste.dislikedTvIds
  ).includes(id);
}
