'use client';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="mx-auto mt-8 max-w-2xl rounded-2xl border border-red-500/25 bg-red-500/[0.07] p-6 text-center sm:mt-10 sm:p-8">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-500/15 text-red-300">
        <TriangleAlert size={22} aria-hidden />
      </span>
      <h1 className="mt-3 text-xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-white/60">
        The page hit an unexpected error. It&apos;s usually temporary — try again.
      </p>
      <div className="mt-5 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row">
        <button
          onClick={reset}
          className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-accent/30 transition hover:shadow-glow"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-white/10 px-6 py-2.5 text-center text-sm font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
        >
          Go home
        </Link>
      </div>
      {error?.digest ? <p className="mt-3 text-[11px] text-white/30">Error ID: {error.digest}</p> : null}
    </div>
  );
}
