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

export function getContinue(): ContinueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY_CONTINUE) || '[]');
  } catch {
    return [];
  }
}

export function saveContinue(item: ContinueItem) {
  if (typeof window === 'undefined') return;
  const list = getContinue().filter(
    (x) => !(x.id === item.id && x.mediaType === item.mediaType)
  );
  list.unshift({ ...item, updatedAt: Date.now() });
  localStorage.setItem(KEY_CONTINUE, JSON.stringify(list.slice(0, 20)));
}

export function getWatchlist(): ContinueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY_LIST) || '[]');
  } catch {
    return [];
  }
}

export function toggleWatchlist(item: ContinueItem): boolean {
  const list = getWatchlist();
  const exists = list.some((x) => x.id === item.id && x.mediaType === item.mediaType);
  const next = exists
    ? list.filter((x) => !(x.id === item.id && x.mediaType === item.mediaType))
    : [{ ...item, updatedAt: Date.now() }, ...list];
  localStorage.setItem(KEY_LIST, JSON.stringify(next));
  return !exists;
}

export function inWatchlist(id: number, mediaType: string): boolean {
  return getWatchlist().some((x) => x.id === id && x.mediaType === mediaType);
}
