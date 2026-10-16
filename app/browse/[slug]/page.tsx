import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { tmdb } from '@/lib/tmdb';
import AdultGate from '@/components/AdultGate';
import LoadError from '@/components/LoadError';
import MovieCard, { TMDBItem } from '@/components/MovieCard';

interface Category {
  title: string;
  type?: 'movie' | 'tv';
  adultOnly?: boolean;
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
  hollywood: { title: 'Hollywood (English)', type: 'movie', load: (p) => tmdb.moviesByLang('en', p) },
  korean: { title: 'Korean Movies', type: 'movie', load: (p) => tmdb.moviesByLang('ko', p) },
  tollywood: { title: 'Tollywood (Telugu)', type: 'movie', load: (p) => tmdb.moviesByLang('te', p) },
  tamil: { title: 'Tamil', type: 'movie', load: (p) => tmdb.moviesByLang('ta', p) },
  'tv-english': { title: 'English TV Series', type: 'tv', load: (p) => tmdb.tvByLang('en', p) },
  'tv-hindi': { title: 'Hindi TV Series', type: 'tv', load: (p) => tmdb.tvByLang('hi', p) },
  'tv-korean': { title: 'Korean TV Series', type: 'tv', load: (p) => tmdb.tvByLang('ko', p) },
  // Movie genre sub-categories
  'movie-action': { title: 'Action Movies', type: 'movie', load: (p) => tmdb.genreMovies(28, p) },
  'movie-comedy': { title: 'Comedy Movies', type: 'movie', load: (p) => tmdb.genreMovies(35, p) },
  'movie-crime': { title: 'Crime Movies', type: 'movie', load: (p) => tmdb.genreMovies(80, p) },
  'movie-thriller': { title: 'Thriller Movies', type: 'movie', load: (p) => tmdb.genreMovies(53, p) },
  'movie-horror': { title: 'Horror Movies', type: 'movie', load: (p) => tmdb.genreMovies(27, p) },
  'movie-romance': { title: 'Romance Movies', type: 'movie', load: (p) => tmdb.genreMovies(10749, p) },
  // TV genre sub-categories
  'tv-action': { title: 'Action & Adventure Series', type: 'tv', load: (p) => tmdb.genreTV(10759, p) },
  'tv-comedy': { title: 'Comedy Series', type: 'tv', load: (p) => tmdb.genreTV(35, p) },
  'tv-crime': { title: 'Crime Series', type: 'tv', load: (p) => tmdb.genreTV(80, p) },
  'tv-drama': { title: 'Drama Series', type: 'tv', load: (p) => tmdb.genreTV(18, p) },
  'tv-mystery': { title: 'Mystery Series', type: 'tv', load: (p) => tmdb.genreTV(9648, p) },
  'tv-scifi': { title: 'Sci-Fi & Fantasy Series', type: 'tv', load: (p) => tmdb.genreTV(10765, p) },
  'tv-reality': { title: 'Reality Series', type: 'tv', load: (p) => tmdb.genreTV(10764, p) },
  // 18+ only — age-gated brand/keyword curation, excluded from the main catalog.
  // Every item here is mature by construction (verified against the live API).
  'adult-movies': {
    title: 'Erotic Movies (18+)',
    type: 'movie',
    adultOnly: true,
    load: (p) => tmdb.eroticMovies(p),
  },
  'adult-tv': {
    title: 'Erotic Series (18+)',
    type: 'tv',
    adultOnly: true,
    load: (p) => tmdb.eroticTV(p),
  },
  vivamax: {
    title: 'Vivamax Films (18+)',
    type: 'movie',
    adultOnly: true,
    load: (p) => tmdb.vivamax(p),
  },
  ullu: {
    title: 'Ullu Originals (18+)',
    type: 'tv',
    adultOnly: true,
    load: (p) => tmdb.ullu(p),
  },
};

export function generateMetadata({ params }: { params: { slug: string } }) {
  const cat = CATEGORIES[params.slug];
  return { title: cat ? `${cat.title} — CineRang` : 'Not found — CineRang' };
}

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
  let data: { results: TMDBItem[]; total_pages: number };
  try {
    data = await cat.load(page);
  } catch {
    return (
      <LoadError
        title={`Could not load ${cat.title}`}
        retryHref={`/browse/${params.slug}?page=${page}`}
      />
    );
  }
  const totalPages = Math.min(data.total_pages ?? 1, 500);

  const pageLink = (p: number) => `/browse/${params.slug}?page=${p}`;
  const neighbours = [page - 2, page - 1, page, page + 1, page + 2].filter((p) => p >= 1 && p <= totalPages);

  const content = (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={`h-6 w-1 rounded-full ${
            cat.adultOnly
              ? 'bg-gradient-to-b from-red-500 to-red-800'
              : 'bg-gradient-to-b from-accent to-emerald-500'
          }`}
        />
        <h1 className="text-2xl font-extrabold tracking-tight">{cat.title}</h1>
        {cat.adultOnly ? (
          <span className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-extrabold text-white">
            18+
          </span>
        ) : null}
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/40">
          Page {page} of {totalPages}
        </span>
      </div>

      {cat.adultOnly ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-red-300/80">
          Adults only — mature collection kept separate from the main catalog.
          By viewing you confirm you are 18 or older.
        </p>
      ) : null}

      <BrowseGrid items={data.results ?? []} type={cat.type} adultOnly={cat.adultOnly} />

      {totalPages > 1 && (
        <nav aria-label="Browse pages" className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={pageLink(page - 1)}
              rel="prev"
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-accent/50 hover:text-white"
            >
              <ChevronLeft size={14} /> Prev
            </Link>
          )}
          {neighbours.map((p) => (
            <Link
              key={p}
              href={pageLink(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Page ${p}`}
              className={`rounded-full px-3.5 py-2 text-sm font-medium tabular-nums transition ${
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
              rel="next"
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-accent/50 hover:text-white"
            >
              Next <ChevronRight size={14} />
            </Link>
          )}
        </nav>
      )}
    </div>
  );

  if (cat.adultOnly) return <AdultGate>{content}</AdultGate>;
  return content;
}

function BrowseGrid({
  items,
  type,
  adultOnly,
}: {
  items: TMDBItem[];
  type?: 'movie' | 'tv';
  adultOnly?: boolean;
}) {
  return (
    <div className="cv-auto mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {items
        .filter((m) => m.poster_path)
        .map((m) => (
          <MovieCard key={m.id} item={m} forceType={type} fluid markAdult={adultOnly} />
        ))}
    </div>
  );
}
