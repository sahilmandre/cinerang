import Link from 'next/link';
import { RotateCcw, WifiOff } from 'lucide-react';

/** Friendly fallback when TMDB doesn't respond (flaky network / VPN blocks). */
export default function LoadError({
  title = 'Could not load titles',
  retryHref,
}: {
  title?: string;
  retryHref?: string;
}) {
  return (
    <div role="alert" className="mx-auto mt-8 max-w-2xl rounded-2xl border border-red-500/25 bg-red-500/[0.07] p-6 sm:mt-10 sm:p-8">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-500/15 text-red-300">
        <WifiOff size={20} aria-hidden />
      </span>
      <h1 className="mt-3 text-xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/70">
        The catalog didn&apos;t respond — usually a network hiccup or VPN/DNS
        block on the TMDB API. Check your connection and try again.
      </p>
      {retryHref ? (
        <Link
          href={retryHref}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-accent/30 transition hover:shadow-glow"
        >
          <RotateCcw size={15} aria-hidden /> Retry
        </Link>
      ) : null}
    </div>
  );
}
