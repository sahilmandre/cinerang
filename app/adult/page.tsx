import { tmdb } from '@/lib/tmdb';
import Row from '@/components/Row';
import AdultGate from '@/components/AdultGate';

export default async function AdultPage() {
  const [movies, tv, vivamax, ullu] = await Promise.all([
    tmdb.eroticMovies().catch(() => ({ results: [] })),
    tmdb.eroticTV().catch(() => ({ results: [] })),
    tmdb.vivamax().catch(() => ({ results: [] })),
    tmdb.ullu().catch(() => ({ results: [] })),
  ]);
  return (
    <AdultGate>
      <div className="mt-6">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-gradient-to-b from-red-500 to-red-800" />
          <h1 className="text-2xl font-extrabold tracking-tight">
            18+ <span className="text-red-400">Only</span>
          </h1>
          <span className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-extrabold text-white">
            ADULTS ONLY
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          Mature collection, kept separate from the main catalog: erotic
          cinema, erotic series, Vivamax films and Ullu Originals. Nothing
          here appears on Home, Movies or TV.
        </p>
        <Row title="Erotic Movies" items={movies.results ?? []} type="movie" href="/browse/adult-movies" markAdult />
        <Row title="Erotic Series" items={tv.results ?? []} type="tv" href="/browse/adult-tv" markAdult />
        <Row title="Vivamax Films" items={vivamax.results ?? []} type="movie" href="/browse/vivamax" markAdult />
        <Row title="Ullu Originals" items={ullu.results ?? []} type="tv" href="/browse/ullu" markAdult />
      </div>
    </AdultGate>
  );
}
