'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, LogOut, MonitorSmartphone, X } from 'lucide-react';
import {
  prefetchAuthClient,
  signInWithGoogle,
  useSession,
  SIGN_IN_FAILED_PARAM,
} from '@/lib/session';
import { cn } from '@/lib/utils';

const ERRORS: Record<string, string> = {
  not_invited: "This Google account isn't invited to CineRang. Ask the owner to add it.",
};

export function GoogleMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function Avatar({ name, image, size }: { name: string; image?: string | null; size: number }) {
  const [broken, setBroken] = useState(false);
  if (image && !broken) {
    return (
      // Google avatars are tiny and already sized — no optimizer round-trip.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid place-items-center rounded-full bg-aurora font-bold text-black"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

const PANEL =
  'absolute right-0 top-full z-[60] mt-2 w-72 rounded-2xl border border-white/10 bg-[#0c120d]/95 p-3 shadow-card backdrop-blur-xl';

/** Navbar account control: one-click Google sign-in, or the account menu. */
export default function AccountButton() {
  const { status, user } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // A failed Google sign-in comes back as ?signin=failed&error=<code>.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(SIGN_IN_FAILED_PARAM) !== 'failed') return;
    const code = url.searchParams.get('error') ?? '';
    setNotice(ERRORS[code] ?? "Google sign-in didn't complete. Please try again.");
    for (const key of [SIGN_IN_FAILED_PARAM, 'error', 'error_description']) {
      url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);

  // Close the menu / notice on an outside click or Escape.
  useEffect(() => {
    if (!open && !notice) return;
    const close = () => {
      setOpen(false);
      setNotice(null);
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, notice]);

  const signIn = async () => {
    setBusy(true);
    setNotice(null);
    const result = await signInWithGoogle().catch(() => null);
    // On success the browser is already on its way to Google.
    if (!result || result.error) {
      setBusy(false);
      setNotice("Couldn't start Google sign-in. Check your connection and try again.");
    }
  };

  const signOut = async (everywhere: boolean) => {
    setBusy(true);
    const { signOutAndClear } = await import('@/lib/sync/engine');
    await signOutAndClear(everywhere);
    // Fresh guest state for whoever uses this device next.
    window.location.reload();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      {status === 'loading' ? (
        <span aria-hidden className="block h-9 w-9 rounded-full bg-white/[0.06]" />
      ) : user ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          onPointerEnter={prefetchAuthClient}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Account: ${user.name || user.email}`}
          className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-white/15 transition hover:ring-accent/60"
        >
          <Avatar name={user.name || user.email} image={user.image} size={32} />
        </button>
      ) : (
        <button
          type="button"
          onClick={signIn}
          onPointerEnter={prefetchAuthClient}
          onFocus={prefetchAuthClient}
          disabled={busy}
          aria-label="Sign in with Google"
          title="Sign in with Google to sync across devices"
          className="inline-flex h-9 items-center gap-2 rounded-full glass px-2.5 text-sm font-semibold text-white/85 transition hover:text-white disabled:opacity-70 sm:px-3.5"
        >
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <GoogleMark />}
          <span className="hidden sm:inline">Sign in</span>
        </button>
      )}

      {notice ? (
        <div role="alert" className={cn(PANEL, 'flex items-start gap-2.5 text-xs leading-relaxed text-amber-200')}>
          <p className="min-w-0 flex-1">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/50 transition hover:text-white"
          >
            <X size={13} aria-hidden />
          </button>
        </div>
      ) : null}

      {open && user ? (
        <div role="menu" aria-label="Account" className={PANEL}>
          <div className="flex items-center gap-3 px-1 pb-3">
            <Avatar name={user.name || user.email} image={user.image} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name || 'Signed in'}</p>
              <p className="truncate text-xs text-white/45">{user.email}</p>
            </div>
          </div>
          <p className="flex items-center gap-1.5 border-t border-white/[0.08] px-1 pt-3 text-xs text-white/50">
            <Check size={13} className="text-accent" aria-hidden />
            Taste, watchlist and resume points sync to this account
          </p>
          <div className="mt-2 grid gap-1">
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => signOut(false)}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <LogOut size={15} aria-hidden />}
              Sign out
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => signOut(true)}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-60"
            >
              <MonitorSmartphone size={15} aria-hidden />
              Sign out of all devices
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
