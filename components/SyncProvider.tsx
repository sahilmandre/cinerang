'use client';

import { useEffect } from 'react';
import { useSession } from '@/lib/session';
import { clearLocal, readSyncState } from '@/lib/sync/local';

/**
 * Renders nothing. Follows the session on the client and starts or stops
 * account sync — pages stay static, no server work is added, and guests
 * never download the sync engine.
 */
export default function SyncProvider() {
  const { status, user } = useSession();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (status === 'loading' || status === 'error') return;
    if (userId) {
      let stop: (() => void) | undefined;
      let cancelled = false;
      void import('@/lib/sync/engine').then(({ startSync }) => {
        if (!cancelled) stop = startSync(userId);
      });
      return () => {
        cancelled = true;
        stop?.();
      };
    }
    // Confirmed signed out while the device still holds an account's data:
    // the session expired or was revoked from another device. Wipe it, as
    // an explicit sign-out would.
    if (readSyncState().ownerId) clearLocal();
  }, [status, userId]);

  return null;
}
