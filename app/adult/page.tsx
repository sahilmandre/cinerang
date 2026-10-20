import { tmdb } from '@/lib/tmdb';
import Row from '@/components/Row';
import AdultGate from '@/components/AdultGate';
import PageHeader from '@/components/PageHeader';

// Heal outage-degraded renders within 5 minutes (see app/page.tsx).
export const revalidate = 300;

export default async function AdultPage() {
  const [movies, tv, vivamax, ullu] = await Promise.all([
    tmdb.eroticMovies().catch(() => ({ results: [] })),
    tmdb.eroticTV().catch(() => ({ results: [] })),
    tmdb.vivamax().catch(() => ({ results: [] })),
    tmdb.ullu().catch(() => ({ results: [] })),
  ]);
  return (
    <AdultGate>
      <div className="mt-8">
        <PageHeader title="18+ Only" tone="danger">
          <span className="rounded-md border border-red-400/50 bg-red-500/10 px-2 py-0.5 text-xs font-extrabold text-red-300">
            ADULTS ONLY
          </span>
        </PageHeader>
        <p className="mt-3 max-w-2xl px-1 text-sm leading-relaxed text-white/50">
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
