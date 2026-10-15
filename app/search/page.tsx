import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { tmdb } from '@/lib/tmdb';
import MovieCard from '@/components/MovieCard';

const SUGGESTIONS = ['Avengers', 'Breaking Bad', 'Naruto', 'Dune', 'Money Heist'];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? '').trim();
  let results: any[] = [];
  if (q) {
    try {
      const data = await tmdb.search(q);
      results = (data.results ?? []).filter(
        (r: any) => r.poster_path && (r.media_type === 'movie' || r.media_type === 'tv')
      );
    } catch {
      /* error UI below */
    }
  }

  return (
    <div className="mt-6">
      {q ? (
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Results for <span className="text-accent">“{q}”</span>
          </h1>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs tabular-nums text-white/40">
            {results.length} found
          </span>
        </div>
      ) : (
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Search</h1>
      )}

      {results.length > 0 ? (
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">
          {results.map((r) => (
            <MovieCard key={`${r.media_type}-${r.id}`} item={r} fluid />
          ))}
        </div>
      ) : (
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-white/[0.07] bg-card/60 p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white/5 text-white/40">
            <SearchX size={22} aria-hidden />
          </span>
          <p className="mt-3 font-semibold">
            {q ? 'No results found' : 'Find your next watch'}
          </p>
          <p className="mt-1 text-sm text-white/50">
            {q
              ? 'Try a different spelling or browse a suggestion below.'
              : 'Type at least 2 characters above, or try a suggestion.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <Link
                key={s}
                href={`/search?q=${encodeURIComponent(s)}`}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[13px] font-medium text-white/70 transition hover:border-accent/40 hover:text-accent"
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
