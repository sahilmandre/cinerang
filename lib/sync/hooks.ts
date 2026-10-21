import { useEffect, useState } from 'react';
import { getTaste, hasTasteFor, type TasteKind } from '../preferences';
import { SYNC_EVENT } from './local';

/**
 * Recommendation rows fetch once on mount. On a device's first sync the
 * account's taste can arrive just after that, so a row stuck on "take the
 * quiz" gets a new key and loads real picks. Rows already showing picks are
 * left alone — refetching would swap them out under the user.
 */
export function useReloadOnFirstSync(waiting: boolean, media: TasteKind): number {
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!waiting) return;
    const onSync = () => {
      if (hasTasteFor(getTaste(), media)) setKey((k) => k + 1);
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [waiting, media]);
  return key;
}
