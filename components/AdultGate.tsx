'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

const KEY = 'cinerang.adult_ok';

/**
 * UI-level 18+ gate for the adult hub and 18+ browse pages.
 * Remembers confirmation in localStorage so repeat visits skip it.
 * Note: this is a UI deterrent, not legal-grade age verification.
 */
export default function AdultGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === '1') setOk(true);
    } catch {
      /* storage unavailable — stay gated */
    }
    setReady(true);
  }, []);

  const enter = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* session-only confirmation */
    }
    setOk(true);
  };

  // Skeleton placeholder keeps layout stable pre-hydration (avoids flash of empty content).
  if (!ready)
    return (
      <div aria-hidden className="mx-auto mt-10 max-w-lg animate-pulse rounded-2xl border border-white/[0.07] bg-card/60 p-8">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-white/10" />
        <div className="mx-auto mt-4 h-6 w-48 rounded bg-white/10" />
        <div className="mx-auto mt-2 h-4 w-72 rounded bg-white/5" />
      </div>
    );
  if (ok) return <>{children}</>;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="adult-gate-title"
      aria-describedby="adult-gate-desc"
      className="mx-auto mt-8 w-full max-w-lg rounded-2xl border border-red-500/25 bg-card/70 p-6 text-center shadow-2xl shadow-red-950/30 backdrop-blur sm:mt-10 sm:p-8"
    >
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/15 text-red-400">
        <ShieldAlert size={26} aria-hidden />
      </span>
      <p className="mt-4 inline-block rounded-md bg-red-600 px-2 py-0.5 text-xs font-extrabold tracking-widest text-white">
        18+
      </p>
      <h1 id="adult-gate-title" className="mt-2 text-2xl font-extrabold tracking-tight">
        Adults only
      </h1>
      <p id="adult-gate-desc" className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/60">
        This section contains mature content intended only for viewers aged 18
        or older. By entering, you confirm you are of legal age in your region.
      </p>
      <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <button
          onClick={enter}
          autoFocus
          className="rounded-xl bg-red-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/30 transition hover:bg-red-400"
        >
          I am 18+ — Enter
        </button>
        <Link
          href="/"
          className="rounded-xl border border-white/10 px-6 py-2.5 text-center text-sm font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
        >
          Go back
        </Link>
      </div>
    </div>
  );
}
