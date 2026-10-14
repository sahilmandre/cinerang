import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { tmdb } from '@/lib/tmdb';
import MovieCard, { TMDBItem } from '@/components/MovieCard';

interface Category {
  title: string;
  type?: 'movie' | 'tv';
  load: (page: number) => Promise<{ results: TMDBItem[]; total_pages: number }>;
}

const CATEGORIES: Record<string, Category> = {
  trending: { title: 'Trending now', load: (p) => tmdb.trending('all', p) },
  'popular-movies': { title: 'Popular movies', type: 'movie', load: (p) => tmdb.popularMovies(p) },
  'popular-tv': { title: 'Popular TV shows', type: 'tv', load: (p) => tmdb.popularTV(p) },
  'top-rated': { title: 'Top rated movies', type: 'movie', load: (p) => tmdb.topRatedMovies(p) },
  hindi: { title: 'Hindi / Bollywood', type: 'movie', load: (p) => tmdb.bollywood(p) },
  anime: { title: 'Anime', type: 'tv', load: (p) => tmdb.anime(p) },
  south: {
    title: 'South Indian (Tamil + Telugu)',
    type: 'movie',
    load: async (p) => {
      const [ta, te] = await Promise.all([tmdb.southTamil(p), tmdb.southTelugu(p)]);
      const merged = [...(ta.results ?? []), ...(te.results ?? [])].filter(
        (m, i, a) => a.findIndex((x) => x.id === m.id) === i
      );
      return { results: merged, total_pages: Math.max(ta.total_pages ?? 1, te.total_pages ?? 1) };
    },
  },
};

export default async function BrowsePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { page?: string };
}) {
  const cat = CATEGORIES[params.slug];
  if (!cat) notFound();
  const page = Math.min(Math.max(Number(searchParams.page) || 1, 1), 500);
  const data = await cat.load(page);
  const totalPages = Math.min(data.total_pages ?? 1, 500);

  const pageLink = (p: number) => `/browse/${params.slug}?page=${p}`;
  const neighbours = [page - 2, page - 1, page, page + 1, page + 2].filter((p) => p >= 1 && p <= totalPages);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2.5">
        <span className="h-6 w-1 rounded-full bg-gradient-to-b from-accent to-emerald-500" />
        <h1 className="text-2xl font-extrabold tracking-tight">{cat.title}</h1>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/40">
          Page {page} of {totalPages}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {(data.results ?? [])
          .filter((m) => m.poster_path)
          .map((m) => (
            <MovieCard key={m.id} item={m} forceType={cat.type} fluid />
          ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={pageLink(page - 1)}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-accent/50 hover:text-white"
            >
              <ChevronLeft size={14} /> Prev
            </Link>
          )}
          {neighbours.map((p) => (
            <Link
              key={p}
              href={pageLink(p)}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                p === page
                  ? 'bg-accent font-bold text-black shadow-lg shadow-accent/30'
                  : 'border border-white/10 text-white/70 hover:border-accent/40 hover:text-white'
              }`}
            >
              {p}
            </Link>
          ))}
          {page < totalPages && (
            <Link
              href={pageLink(page + 1)}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-accent/50 hover:text-white"
            >
              Next <ChevronRight size={14} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
