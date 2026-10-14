import Link from 'next/link';

/** Friendly fallback when TMDB doesn't respond (flaky network / VPN blocks). */
export default function LoadError({
  title = 'Could not load titles',
  retryHref,
}: {
  title?: string;
  retryHref?: string;
}) {
  return (
    <div className="mt-10 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-6">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/70">
        The catalog didn&apos;t respond — usually a network hiccup or VPN/DNS
        block on the TMDB API. Check your connection and try again.
      </p>
      {retryHref ? (
        <Link
          href={retryHref}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-accent/30 transition hover:shadow-accent/50"
        >
          ↻ Retry
        </Link>
      ) : null}
    </div>
  );
}
