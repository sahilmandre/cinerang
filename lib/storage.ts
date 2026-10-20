export interface ContinueItem {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  poster: string | null;
  season?: number;
  episode?: number;
  updatedAt: number;
}

const KEY_CONTINUE = 'cinejoy.continue';
const KEY_LIST = 'cinejoy.watchlist';

/** Fired on window whenever the watchlist changes. */
export const WATCHLIST_EVENT = 'cinerang:watchlist-updated';

/** Reads a stored list, dropping anything malformed (corrupt or hand-edited). */
function readList(key: string): ContinueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ContinueItem =>
        Boolean(item) &&
        Number.isInteger(item.id) &&
        item.id > 0 &&
        (item.mediaType === 'movie' || item.mediaType === 'tv') &&
        typeof item.title === 'string'
    );
  } catch {
    return [];
  }
}

/** Writes a list; storage can be full or blocked, which must not throw. */
function writeList(key: string, list: ContinueItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* session-only */
  }
}

export function getContinue(): ContinueItem[] {
  return readList(KEY_CONTINUE);
}

export function saveContinue(item: ContinueItem) {
  if (typeof window === 'undefined') return;
  const list = getContinue().filter(
    (x) => !(x.id === item.id && x.mediaType === item.mediaType)
  );
  list.unshift({ ...item, updatedAt: Date.now() });
  writeList(KEY_CONTINUE, list.slice(0, 20));
}

export function removeContinue(id: number, mediaType: string) {
  if (typeof window === 'undefined') return;
  writeList(
    KEY_CONTINUE,
    getContinue().filter((x) => !(x.id === id && x.mediaType === mediaType))
  );
}

export function clearContinue() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY_CONTINUE);
  } catch {
    /* nothing stored */
  }
}

export function getWatchlist(): ContinueItem[] {
  return readList(KEY_LIST);
}

export function toggleWatchlist(item: Omit<ContinueItem, 'updatedAt'>): boolean {
  if (typeof window === 'undefined') return false;
  const list = getWatchlist();
  const exists = list.some((x) => x.id === item.id && x.mediaType === item.mediaType);
  const next = exists
    ? list.filter((x) => !(x.id === item.id && x.mediaType === item.mediaType))
    : [{ ...item, updatedAt: Date.now() }, ...list];
  writeList(KEY_LIST, next);
  window.dispatchEvent(new Event(WATCHLIST_EVENT));
  return !exists;
}

/** Explicit remove — unlike a toggle, a stale UI can't re-add the title. */
export function removeFromWatchlist(id: number, mediaType: string) {
  if (typeof window === 'undefined') return;
  writeList(
    KEY_LIST,
    getWatchlist().filter((x) => !(x.id === id && x.mediaType === mediaType))
  );
  window.dispatchEvent(new Event(WATCHLIST_EVENT));
}

/** Calls `onChange` when the watchlist changes in this tab or another one. */
export function subscribeWatchlist(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY_LIST || e.key === null) onChange();
  };
  window.addEventListener(WATCHLIST_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(WATCHLIST_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function inWatchlist(id: number, mediaType: string): boolean {
  return getWatchlist().some((x) => x.id === id && x.mediaType === mediaType);
}
