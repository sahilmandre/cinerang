/**
 * The device copy of the synced data. localStorage stays the instant source
 * for the UI; every change goes through `commit`, which applies it with the
 * shared reducer and — when signed in — queues it in the outbox for upload.
 */
import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES } from '../categories';
import { CAPS, EMPTY_TASTE, applyOp, cleanItems, cleanScores, emptyData, normalizeTaste } from './reducer';
import type { ContinueItem, Op, OpBody, SyncData, UserTaste } from './types';

export const KEYS = {
  taste: 'cinejoy.taste',
  watchlist: 'cinejoy.watchlist',
  continue: 'cinejoy.continue',
  popupBlock: 'cinerang.popup_block',
  sync: 'cinerang.sync',
} as const;

/** Fired on window whenever taste changes, so client rows can refresh live. */
export const TASTE_EVENT = 'cinerang:taste-updated';
/** Fired on window whenever the watchlist changes. */
export const WATCHLIST_EVENT = 'cinerang:watchlist-updated';
/** Fired on window whenever Continue Watching changes. */
export const CONTINUE_EVENT = 'cinerang:continue-updated';
/** Fired after a pull brought in changes made on another device. */
export const SYNC_EVENT = 'cinerang:synced';

const MOVIE_GENRE_IDS = new Set(TMDB_MOVIE_GENRES.map((g) => String(g.id)));
const TV_GENRE_IDS = new Set(TMDB_TV_GENRES.map((g) => String(g.id)));

function pickScores(
  scores: Record<string, number>,
  allowed: Set<string>
): Record<string, number> {
  return Object.fromEntries(Object.entries(scores).filter(([key]) => allowed.has(key)));
}

export function readTaste(): UserTaste {
  if (typeof window === 'undefined') return EMPTY_TASTE;
  try {
    const raw = localStorage.getItem(KEYS.taste);
    if (!raw) return EMPTY_TASTE;
    const parsed = JSON.parse(raw) as Partial<UserTaste>;
    // Profiles saved before the movie/TV split kept one shared genreScores
    // map. Split it by vocabulary once; shared ids (Drama, Comedy, …) seed
    // both sides.
    const legacyScores = cleanScores(parsed.genreScores);
    const split = parsed.tvGenreScores == null;
    return normalizeTaste({
      ...parsed,
      genreScores: split ? pickScores(legacyScores, MOVIE_GENRE_IDS) : legacyScores,
      tvGenreScores: split ? pickScores(legacyScores, TV_GENRE_IDS) : parsed.tvGenreScores,
    });
  } catch {
    return EMPTY_TASTE;
  }
}

export function readItems(key: typeof KEYS.watchlist | typeof KEYS.continue): ContinueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const cap = key === KEYS.watchlist ? CAPS.watchlist : CAPS.continue;
    return cleanItems(JSON.parse(localStorage.getItem(key) || '[]'), cap);
  } catch {
    return [];
  }
}

export function readPopupBlock(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(KEYS.popupBlock) === '1';
  } catch {
    return false;
  }
}

export function readLocal(): SyncData {
  if (typeof window === 'undefined') return emptyData();
  return {
    taste: readTaste(),
    watchlist: readItems(KEYS.watchlist),
    continue: readItems(KEYS.continue),
    prefs: { popupBlock: readPopupBlock() },
  };
}

/** Writes a value; storage can be full or blocked, which must not throw. */
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* session-only */
  }
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Saves the slices that changed and fires their events. True if any did. */
function persist(prev: SyncData, next: SyncData): boolean {
  const events: string[] = [];
  if (!same(prev.taste, next.taste)) {
    write(KEYS.taste, JSON.stringify(next.taste));
    events.push(TASTE_EVENT);
  }
  if (!same(prev.watchlist, next.watchlist)) {
    write(KEYS.watchlist, JSON.stringify(next.watchlist));
    events.push(WATCHLIST_EVENT);
  }
  if (!same(prev.continue, next.continue)) {
    write(KEYS.continue, JSON.stringify(next.continue));
    events.push(CONTINUE_EVENT);
  }
  const prefsChanged = prev.prefs.popupBlock !== next.prefs.popupBlock;
  if (prefsChanged) write(KEYS.popupBlock, next.prefs.popupBlock ? '1' : '0');
  for (const name of events) window.dispatchEvent(new Event(name));
  return events.length > 0 || prefsChanged;
}

/** Replaces the device copy (after a pull). True if anything changed. */
export function replaceLocal(next: SyncData): boolean {
  return persist(readLocal(), next);
}

export function hasLocalData(data: SyncData): boolean {
  const { taste } = data;
  return (
    data.watchlist.length > 0 ||
    data.continue.length > 0 ||
    data.prefs.popupBlock ||
    Object.entries(taste).some(([key, value]) =>
      key === 'updatedAt'
        ? false
        : Array.isArray(value)
          ? value.length > 0
          : Object.keys(value as object).length > 0
    )
  );
}

// ── Sync bookkeeping ────────────────────────────────────────────────────

export interface SyncState {
  /** Account the device copy belongs to; null = guest data. */
  ownerId: string | null;
  /** Server revision the device copy reflects (0 = never pulled). */
  rev: number;
  /** Changes not yet confirmed by the server, oldest first. */
  outbox: Op[];
  lastPullAt: number;
}

const EMPTY_SYNC: SyncState = { ownerId: null, rev: 0, outbox: [], lastPullAt: 0 };

export function readSyncState(): SyncState {
  if (typeof window === 'undefined') return EMPTY_SYNC;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEYS.sync) || 'null');
    if (!parsed || typeof parsed !== 'object') return EMPTY_SYNC;
    return {
      ownerId: typeof parsed.ownerId === 'string' ? parsed.ownerId : null,
      rev: Number.isInteger(parsed.rev) && parsed.rev > 0 ? parsed.rev : 0,
      outbox: Array.isArray(parsed.outbox) ? parsed.outbox : [],
      lastPullAt: Number(parsed.lastPullAt) || 0,
    };
  } catch {
    return EMPTY_SYNC;
  }
}

export function updateSyncState(patch: Partial<SyncState>): SyncState {
  const next = { ...readSyncState(), ...patch };
  write(KEYS.sync, JSON.stringify(next));
  return next;
}

/** Drops confirmed ops, re-reading first so ops queued meanwhile survive. */
export function removeFromOutbox(ids: Set<string>) {
  updateSyncState({ outbox: readSyncState().outbox.filter((op) => !ids.has(op.id)) });
}

/** Wipes the device copy and sync state — sign-out or an account switch. */
export function clearLocal() {
  if (typeof window === 'undefined') return;
  for (const key of Object.values(KEYS)) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing stored */
    }
  }
  for (const name of [TASTE_EVENT, WATCHLIST_EVENT, CONTINUE_EVENT]) {
    window.dispatchEvent(new Event(name));
  }
}

/** randomUUID needs a secure context; plain-http LAN testing doesn't have one. */
function newOpId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createOp(body: OpBody): Op {
  return { ...body, id: newOpId(), at: Date.now() } as Op;
}

let onRecord: (() => void) | null = null;

/** The sync engine registers here to schedule an upload after each change. */
export function setRecordListener(listener: (() => void) | null) {
  onRecord = listener;
}

/**
 * Applies one change to the device copy and, when the device belongs to an
 * account, queues it for upload. Never waits on the network.
 */
export function commit(body: OpBody): SyncData {
  if (typeof window === 'undefined') return emptyData();
  const op = createOp(body);
  const prev = readLocal();
  const next = applyOp(prev, op);
  persist(prev, next);
  const sync = readSyncState();
  if (sync.ownerId) {
    updateSyncState({ outbox: [...sync.outbox, op] });
    onRecord?.();
  }
  return next;
}

/** Calls `onChange` when a slice changes in this tab or another one. */
export function subscribe(
  event: string,
  key: string,
  onChange: () => void
): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) onChange();
  };
  window.addEventListener(event, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(event, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
