import {
  commit,
  readItems,
  readPopupBlock,
  subscribe,
  CONTINUE_EVENT,
  KEYS,
  WATCHLIST_EVENT,
} from './sync/local';
import type { ContinueItem, Kind } from './sync/types';

export type { ContinueItem };
export { CONTINUE_EVENT, WATCHLIST_EVENT };

const isKind = (mediaType: string): mediaType is Kind =>
  mediaType === 'movie' || mediaType === 'tv';

export function getContinue(): ContinueItem[] {
  return readItems(KEYS.continue);
}

/** Saves a resume point — season/episode and the server it was playing on. */
export function saveContinue(item: ContinueItem) {
  if (typeof window === 'undefined') return;
  commit({ t: 'continue.upsert', item: { ...item, updatedAt: Date.now() } });
}

export function removeContinue(id: number, mediaType: string) {
  if (typeof window === 'undefined' || !isKind(mediaType)) return;
  commit({ t: 'continue.remove', mediaType, titleId: id });
}

export function clearContinue() {
  if (typeof window === 'undefined') return;
  commit({ t: 'continue.clear' });
}

/** A title's resume point: episode, server and position, if it has one. */
export function savedEntryFor(id: number, mediaType: Kind): ContinueItem | undefined {
  return getContinue().find((x) => x.id === id && x.mediaType === mediaType);
}

/** Calls `onChange` when Continue Watching changes here, in another tab or by sync. */
export function subscribeContinue(onChange: () => void): () => void {
  return subscribe(CONTINUE_EVENT, KEYS.continue, onChange);
}

export function getWatchlist(): ContinueItem[] {
  return readItems(KEYS.watchlist);
}

export function toggleWatchlist(item: Omit<ContinueItem, 'updatedAt'>): boolean {
  if (typeof window === 'undefined') return false;
  const exists = inWatchlist(item.id, item.mediaType);
  commit(
    exists
      ? { t: 'watchlist.remove', mediaType: item.mediaType, titleId: item.id }
      : { t: 'watchlist.add', item: { ...item, updatedAt: Date.now() } }
  );
  return !exists;
}

/** Explicit remove — unlike a toggle, a stale UI can't re-add the title. */
export function removeFromWatchlist(id: number, mediaType: string) {
  if (typeof window === 'undefined' || !isKind(mediaType)) return;
  commit({ t: 'watchlist.remove', mediaType, titleId: id });
}

/** Calls `onChange` when the watchlist changes in this tab or another one. */
export function subscribeWatchlist(onChange: () => void): () => void {
  return subscribe(WATCHLIST_EVENT, KEYS.watchlist, onChange);
}

export function inWatchlist(id: number, mediaType: string): boolean {
  return getWatchlist().some((x) => x.id === id && x.mediaType === mediaType);
}

/** Player popup-blocker (sandboxed frame) preference. */
export function getPopupBlock(): boolean {
  return readPopupBlock();
}

export function setPopupBlock(on: boolean) {
  if (typeof window === 'undefined') return;
  commit({ t: 'prefs.set', popupBlock: on });
}
