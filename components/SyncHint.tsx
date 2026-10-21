'use client';

import { useState } from 'react';
import { prefetchAuthClient, signInWithGoogle, useSession } from '@/lib/session';
import { GoogleMark } from './AccountButton';
import { cn } from '@/lib/utils';

/** Guest-only nudge: what signing in adds. Renders nothing once signed in. */
export default function SyncHint({ what, className }: { what: string; className?: string }) {
  const { status } = useSession();
  const [busy, setBusy] = useState(false);
  if (status !== 'signed-out') return null;
  return (
    <p className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-white/45', className)}>
      Saved on this device only.
      <button
        type="button"
        disabled={busy}
        onPointerEnter={prefetchAuthClient}
        onFocus={prefetchAuthClient}
        onClick={async () => {
          setBusy(true);
          const result = await signInWithGoogle().catch(() => null);
          if (!result || result.error) setBusy(false);
        }}
        className="inline-flex items-center gap-1.5 font-semibold text-accent transition hover:underline disabled:opacity-60"
      >
        <GoogleMark size={13} />
        Sign in to sync {what} across devices
      </button>
    </p>
  );
}
