export type TasteKind = 'movie' | 'tv';

/**
 * Persisted taste profile. Movie and TV tastes are tracked separately because
 * TMDB genre vocabularies — and user preferences — differ between them.
 *
 * genreScores/languageScores are frequency signals learned from explicit quiz
 * picks. They let the scorer weigh repeated genre/language choices instead of
 * treating every selected genre equally.
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
  genreScores: Record<string, number>; // genre id -> pick frequency
  languageScores: Record<string, number>; // original language -> pick frequency
  updatedAt: number;
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
      genreScores: cleanScores(parsed.genreScores),
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

  const nextGenreScores = { ...current.genreScores };
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
    genreScores: nextGenreScores,
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
 * Dislikes a recommended title. It is hidden from later recommendations and
 * removed from likes if it was previously liked.
 */
export function recordTitleDisliked(id: number, kind: TasteKind): UserTaste {
  const current = getTaste();
  const likedKey = kind === 'movie' ? 'likedMovieIds' : 'likedTvIds';
  const dislikedKey =
    kind === 'movie' ? 'dislikedMovieIds' : 'dislikedTvIds';
  return saveTaste({
    [likedKey]: current[likedKey].filter((titleId) => titleId !== id),
    [dislikedKey]: Array.from(new Set([...current[dislikedKey], id])),
  } as Partial<UserTaste>);
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
