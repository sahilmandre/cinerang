/**
 * Shapes shared by the browser (localStorage) and the server (MongoDB
 * `profiles`). Type-only: safe to import from client and server code.
 */

export type Kind = 'movie' | 'tv';

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

/** A Continue Watching or Watchlist entry. */
export interface ContinueItem {
  id: number;
  mediaType: Kind;
  title: string;
  poster: string | null;
  season?: number;
  episode?: number;
  /** Video server the title was last played on (lib/servers id). */
  server?: string;
  /** Seconds into the episode/movie when last saved (players that report it). */
  time?: number;
  /** Length in seconds, as reported by the player. */
  duration?: number;
  /** Queued after the previous episode finished — not started yet. */
  upNext?: boolean;
  updatedAt: number;
}

/** Everything a device syncs: one document per user on the server. */
export interface SyncData {
  taste: UserTaste;
  watchlist: ContinueItem[]; // newest first
  continue: ContinueItem[]; // newest first
  prefs: { popupBlock: boolean };
}

/** Taste fields a `taste.set` op may replace (everything but updatedAt). */
export type TasteFields = Omit<UserTaste, 'updatedAt'>;

/**
 * One user intent. Ops are applied by the same reducer on every device and
 * on the server, so concurrent changes merge instead of overwriting.
 */
export type OpBody =
  | { t: 'taste.like'; kind: Kind; titleIds: number[]; genreIds: number[]; languages: string[] }
  | { t: 'taste.unlike'; kind: Kind; titleId: number; genreIds: number[]; languages: string[] }
  | { t: 'taste.dislike'; kind: Kind; titleId: number; genreIds: number[] }
  | { t: 'taste.set'; fields: Partial<TasteFields> }
  | { t: 'watchlist.add'; item: ContinueItem }
  | { t: 'watchlist.remove'; mediaType: Kind; titleId: number }
  | { t: 'continue.upsert'; item: ContinueItem }
  | { t: 'continue.remove'; mediaType: Kind; titleId: number }
  | { t: 'continue.clear' }
  | { t: 'prefs.set'; popupBlock: boolean }
  | { t: 'import'; snapshot: SyncData };

/** `id` makes retries idempotent; `at` is the device clock in ms. */
export type Op = OpBody & { id: string; at: number };
