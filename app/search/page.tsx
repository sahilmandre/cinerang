import { tmdb } from '@/lib/tmdb';
import MovieCard from '@/components/MovieCard';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q ?? '';
  let results: any[] = [];
  if (q) {
    try {
      const data = await tmdb.search(q);
      results = (data.results ?? []).filter((r: any) => r.poster_path && (r.media_type === 'movie' || r.media_type === 'tv'));
    } catch {}
  }
  return (
    <div className="mt-6">
      <h1 className="text-xl font-bold">Results for “{q}”</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        {results.map((r) => (
          <MovieCard key={`${r.media_type}-${r.id}`} item={r} />
        ))}
      </div>
      {!results.length && <p className="mt-4 text-white/50">No results. Try another title.</p>}
    </div>
  );
}
