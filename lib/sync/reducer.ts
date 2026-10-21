/**
 * The single definition of what every user action does to the synced data.
 * Pure — no browser or Node APIs — so the browser applies its own changes
 * with exactly the code the server uses to apply them to MongoDB, and the
 * phone, the laptop and the database can never disagree.
 */
import type { ContinueItem, Kind, Op, SyncData, UserTaste } from './types';

export const CAPS = {
  ids: 2000, // liked / disliked / watched ids per media type
  favorites: 200, // favorite genre ids per media type
  watchlist: 500,
  continue: 30,
  appliedOps: 500, // op ids remembered server-side for idempotent retries
} as const;

export const EMPTY_TASTE: UserTaste = {
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

export function emptyData(): SyncData {
  return { taste: EMPTY_TASTE, watchlist: [], continue: [], prefs: { popupBlock: false } };
}

const KEYS = {
  movie: {
    favorite: 'favoriteGenres',
    liked: 'likedMovieIds',
    disliked: 'dislikedMovieIds',
    watched: 'watchedMovieIds',
    scores: 'genreScores',
  },
  tv: {
    favorite: 'favoriteTvGenres',
    liked: 'likedTvIds',
    disliked: 'dislikedTvIds',
    watched: 'watchedTvIds',
    scores: 'tvGenreScores',
  },
} as const;

/** Positive integer ids, deduped in first-seen order; `cap` keeps the newest. */
export function cleanIds(value: unknown, cap: number = CAPS.ids): number[] {
  if (!Array.isArray(value)) return [];
  const ids = Array.from(
    new Set(value.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))
  );
  return ids.length > cap ? ids.slice(-cap) : ids;
}

export function cleanScores(value: unknown): Record<string, number> {
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

export function normalizeTaste(raw: Partial<UserTaste>): UserTaste {
  return {
    favoriteGenres: cleanIds(raw.favoriteGenres, CAPS.favorites),
    favoriteTvGenres: cleanIds(raw.favoriteTvGenres, CAPS.favorites),
    likedMovieIds: cleanIds(raw.likedMovieIds),
    likedTvIds: cleanIds(raw.likedTvIds),
    dislikedMovieIds: cleanIds(raw.dislikedMovieIds),
    dislikedTvIds: cleanIds(raw.dislikedTvIds),
    watchedMovieIds: cleanIds(raw.watchedMovieIds),
    watchedTvIds: cleanIds(raw.watchedTvIds),
    genreScores: cleanScores(raw.genreScores),
    tvGenreScores: cleanScores(raw.tvGenreScores),
    languageScores: cleanScores(raw.languageScores),
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

/** Drops anything malformed (corrupt or hand-edited) and enforces the cap. */
export function cleanItems(value: unknown, cap: number): ContinueItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is ContinueItem =>
        Boolean(item) &&
        Number.isInteger(item.id) &&
        item.id > 0 &&
        (item.mediaType === 'movie' || item.mediaType === 'tv') &&
        typeof item.title === 'string'
    )
    .slice(0, cap);
}

export function normalizeData(raw: Partial<SyncData> | null | undefined): SyncData {
  return {
    taste: normalizeTaste(raw?.taste ?? {}),
    watchlist: cleanItems(raw?.watchlist, CAPS.watchlist),
    continue: cleanItems(raw?.continue, CAPS.continue),
    prefs: { popupBlock: raw?.prefs?.popupBlock === true },
  };
}

const isItem = (x: ContinueItem, mediaType: Kind, id: number) =>
  x.id === id && x.mediaType === mediaType;

const newestFirst = (a: ContinueItem, b: ContinueItem) => b.updatedAt - a.updatedAt;

/** Inserts or replaces one entry; an older copy never overwrites a newer one. */
function upsertItem(list: ContinueItem[], item: ContinueItem, cap: number): ContinueItem[] {
  const existing = list.find((x) => isItem(x, item.mediaType, item.id));
  if (existing && existing.updatedAt > item.updatedAt) return list;
  return [item, ...list.filter((x) => !isItem(x, item.mediaType, item.id))]
    .sort(newestFirst)
    .slice(0, cap);
}

/** Union by (mediaType, id); the newer copy of an entry wins. */
function mergeItems(a: ContinueItem[], b: ContinueItem[], cap: number): ContinueItem[] {
  return b.reduce((list, item) => upsertItem(list, item, Infinity), a).slice(0, cap);
}

function adjust(scores: Record<string, number>, key: string, delta: number) {
  const next = (scores[key] ?? 0) + delta;
  if (next > 0) scores[key] = next;
  else delete scores[key];
}

/** Per-key max, so importing a device's scores never double counts. */
function maxScores(a: Record<string, number>, b: Record<string, number>) {
  const next = { ...a };
  for (const [key, value] of Object.entries(b)) next[key] = Math.max(next[key] ?? 0, value);
  return next;
}

function applyTaste(taste: UserTaste, op: Op): UserTaste {
  const next: UserTaste = { ...taste, updatedAt: Math.max(taste.updatedAt, op.at) };
  switch (op.t) {
    // Genre/language frequencies grow with repeated picks, so the scorer can
    // tell a passing interest from a strong, repeated preference.
    case 'taste.like': {
      const k = KEYS[op.kind];
      const titleIds = cleanIds(op.titleIds);
      const genreIds = cleanIds(op.genreIds);
      next[k.favorite] = cleanIds([...taste[k.favorite], ...genreIds], CAPS.favorites);
      next[k.liked] = cleanIds([...taste[k.liked], ...titleIds]);
      // An explicit like always clears a previous dislike for the same title.
      next[k.disliked] = taste[k.disliked].filter((id) => !titleIds.includes(id));
      next[k.scores] = { ...taste[k.scores] };
      for (const id of genreIds) adjust(next[k.scores], String(id), 1);
      next.languageScores = { ...taste.languageScores };
      for (const lang of op.languages) {
        if (lang) adjust(next.languageScores, lang.toLowerCase(), 1);
      }
      return next;
    }
    // Takes back exactly what one like added, so toggling never inflates.
    case 'taste.unlike': {
      const k = KEYS[op.kind];
      next[k.liked] = taste[k.liked].filter((id) => id !== op.titleId);
      next[k.scores] = { ...taste[k.scores] };
      for (const id of cleanIds(op.genreIds)) adjust(next[k.scores], String(id), -1);
      next.languageScores = { ...taste.languageScores };
      for (const lang of op.languages) {
        if (lang) adjust(next.languageScores, lang.toLowerCase(), -1);
      }
      return next;
    }
    // Hides the title and gently dampens its genres (−0.5 each, never below
    // zero) without hard-deleting the user's explicit quiz selections.
    case 'taste.dislike': {
      const k = KEYS[op.kind];
      next[k.liked] = taste[k.liked].filter((id) => id !== op.titleId);
      next[k.disliked] = cleanIds([...taste[k.disliked], op.titleId]);
      next[k.scores] = { ...taste[k.scores] };
      for (const id of cleanIds(op.genreIds)) adjust(next[k.scores], String(id), -0.5);
      return next;
    }
    case 'taste.set':
      return normalizeTaste({ ...next, ...op.fields, updatedAt: next.updatedAt });
    default:
      return taste;
  }
}

/**
 * First sign-in on a device that already has guest data. Id sets are
 * unioned — a title liked on one side and disliked on the other keeps the
 * account's existing choice — and scores take the per-key max.
 */
function importSnapshot(data: SyncData, raw: SyncData): SyncData {
  const snap = normalizeData(raw);
  const t = data.taste;
  const s = snap.taste;
  const taste: UserTaste = { ...t, updatedAt: Math.max(t.updatedAt, s.updatedAt) };
  for (const kind of ['movie', 'tv'] as const) {
    const k = KEYS[kind];
    const liked = new Set(t[k.liked]);
    const disliked = new Set(t[k.disliked]);
    taste[k.liked] = cleanIds([...t[k.liked], ...s[k.liked].filter((id) => !disliked.has(id))]);
    taste[k.disliked] = cleanIds([
      ...t[k.disliked],
      ...s[k.disliked].filter((id) => !liked.has(id)),
    ]);
    taste[k.favorite] = cleanIds([...t[k.favorite], ...s[k.favorite]], CAPS.favorites);
    taste[k.watched] = cleanIds([...t[k.watched], ...s[k.watched]]);
    taste[k.scores] = maxScores(t[k.scores], s[k.scores]);
  }
  taste.languageScores = maxScores(t.languageScores, s.languageScores);
  return {
    taste,
    watchlist: mergeItems(data.watchlist, snap.watchlist, CAPS.watchlist),
    continue: mergeItems(data.continue, snap.continue, CAPS.continue),
    prefs: { popupBlock: data.prefs.popupBlock || snap.prefs.popupBlock },
  };
}

export function applyOp(data: SyncData, op: Op): SyncData {
  switch (op.t) {
    case 'taste.like':
    case 'taste.unlike':
    case 'taste.dislike':
    case 'taste.set':
      return { ...data, taste: applyTaste(data.taste, op) };
    case 'watchlist.add':
      return { ...data, watchlist: upsertItem(data.watchlist, op.item, CAPS.watchlist) };
    case 'watchlist.remove':
      return {
        ...data,
        watchlist: data.watchlist.filter((x) => !isItem(x, op.mediaType, op.titleId)),
      };
    case 'continue.upsert':
      return { ...data, continue: upsertItem(data.continue, op.item, CAPS.continue) };
    case 'continue.remove':
      return {
        ...data,
        continue: data.continue.filter((x) => !isItem(x, op.mediaType, op.titleId)),
      };
    case 'continue.clear':
      return { ...data, continue: [] };
    case 'prefs.set':
      return { ...data, prefs: { popupBlock: op.popupBlock } };
    case 'import':
      return importSnapshot(data, op.snapshot);
    default:
      return data;
  }
}

export function applyOps(data: SyncData, ops: Op[]): SyncData {
  return ops.reduce(applyOp, data);
}

/**
 * Server-side batch apply. Ops whose id was already applied are skipped, so
 * a retried request (lost response, flaky network) changes nothing twice.
 * Returns null when every op in the batch was a repeat.
 */
export function applyBatch(
  state: { data: SyncData; appliedOps: string[] },
  ops: Op[]
): { data: SyncData; appliedOps: string[] } | null {
  const seen = new Set(state.appliedOps);
  const fresh: Op[] = [];
  for (const op of ops) {
    if (seen.has(op.id)) continue;
    seen.add(op.id);
    fresh.push(op);
  }
  if (!fresh.length) return null;
  return {
    data: applyOps(state.data, fresh),
    appliedOps: [...state.appliedOps, ...fresh.map((op) => op.id)].slice(-CAPS.appliedOps),
  };
}
