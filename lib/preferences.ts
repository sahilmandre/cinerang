import { getContinue } from './storage';
import { localDayKey } from './utils';
import { EMPTY_TASTE, cleanIds, normalizeTaste } from './sync/reducer';
import { commit, readTaste, TASTE_EVENT } from './sync/local';
import type { Kind, TasteFields, UserTaste } from './sync/types';

export type TasteKind = Kind;
export type { UserTaste };
export { TASTE_EVENT };

const scoresKeyFor = (kind: TasteKind) =>
  kind === 'movie' ? 'genreScores' : 'tvGenreScores';

export function genreScoresFor(
  taste: UserTaste,
  kind: TasteKind
): Record<string, number> {
  return taste[scoresKeyFor(kind)];
}

const TASTE_FIELDS = (Object.keys(EMPTY_TASTE) as (keyof UserTaste)[]).filter(
  (key): key is keyof TasteFields => key !== 'updatedAt'
);

/** Lower-cased language codes; blanks dropped, repeats kept (they count). */
function cleanLanguages(languages: Array<string | null | undefined>): string[] {
  return languages
    .filter(
      (language): language is string =>
        typeof language === 'string' && language.length > 0 && language.length <= 12
    )
    .map((language) => language.toLowerCase());
}

export function getTaste(): UserTaste {
  return readTaste();
}

/**
 * Replaces whole fields (quiz start/finish, Back restoring an earlier
 * profile). Only the fields that actually change are recorded, so a restore
 * doesn't upload the entire profile.
 */
export function saveTaste(partial: Partial<UserTaste>): UserTaste {
  if (typeof window === 'undefined') return EMPTY_TASTE;
  const current = getTaste();
  const wanted = normalizeTaste({ ...current, ...partial });
  const fields: Partial<TasteFields> = {};
  for (const key of TASTE_FIELDS) {
    if (JSON.stringify(wanted[key]) !== JSON.stringify(current[key])) {
      Object.assign(fields, { [key]: wanted[key] });
    }
  }
  if (!Object.keys(fields).length) return current;
  return commit({ t: 'taste.set', fields }).taste;
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
  return commit({
    t: 'taste.like',
    kind: input.kind,
    titleIds: cleanIds(input.titleIds),
    genreIds: cleanIds(input.genreIds),
    languages: cleanLanguages(input.languages),
  }).taste;
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
  return commit({
    t: 'taste.unlike',
    kind: input.kind,
    titleId: input.id,
    genreIds: cleanIds(input.genreIds ?? []),
    languages: cleanLanguages(input.languages ?? []),
  }).taste;
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
  return commit({ t: 'taste.dislike', kind, titleId: id, genreIds: cleanIds(genreIds) }).taste;
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
