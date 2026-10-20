import { tmdb, hasTmdbCredentials } from '@/lib/tmdb';
import Hero from '@/components/Hero';
import Row from '@/components/Row';
import ContinueWatching from '@/components/ContinueWatching';
import RecommendedRow from '@/components/RecommendedRow';
import LoadError from '@/components/LoadError';

// Re-render at most every 5 minutes. TMDB responses stay in the data cache
// for hours, so this costs no extra API calls — but a page rendered during
// a TMDB outage (empty rows) heals in minutes instead of being served for
// the full 6h data TTL.
export const revalidate = 300;

// One flaky endpoint (e.g. an ECONNRESET mid-request) empties just its row
// instead of failing the whole page.
const empty = { results: [] as any[] };
const quiet = (p: Promise<any>) => p.catch(() => empty);
// /trending/all also returns people, which Row would link to /watch/tv/<personId>.
const titlesOnly = (items: any[] = []) =>
  items.filter((item) => item.media_type === 'movie' || item.media_type === 'tv');

export default async function Home() {
  const [data, movies, tv, top, anime, hindi, tamil, telugu] = await Promise.all([
    quiet(tmdb.trending('all')),
    quiet(tmdb.popularMovies()),
    quiet(tmdb.popularTV()),
    quiet(tmdb.topRatedMovies()),
    quiet(tmdb.anime()),
    quiet(tmdb.bollywood()),
    quiet(tmdb.southTamil()),
    quiet(tmdb.southTelugu()),
  ]);
  const sections = [data, movies, tv, top, anime, hindi, tamil, telugu];
  if (sections.every((s) => !(s.results?.length))) {
    // Everything empty: a missing key on first run, or TMDB is unreachable
    // (e.g. ISP-level blocking) — only the first deserves the setup guide.
    if (!hasTmdbCredentials) {
      return (
        <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] p-6 sm:mt-10 sm:p-8">
          <h1 className="text-xl font-bold tracking-tight">Add your TMDB API key to get started</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            1. Get a free key at themoviedb.org → Settings → API
            <br />
            2. Copy <code>.env.example</code> to <code>.env.local</code> and fill{' '}
            <code>TMDB_ACCESS_TOKEN</code> (or <code>TMDB_API_KEY</code>)
            <br />
            3. Restart <code>npm run dev</code>
          </p>
        </div>
      );
    }
    return <LoadError title="Could not load titles" retryHref="/" />;
  }
  return (
    <div>
      <Hero items={titlesOnly(data.results)} />
      <RecommendedRow media="movie" title="Recommended movies" viewAllHref="/recommended" />
      <RecommendedRow media="tv" title="Recommended series" viewAllHref="/recommended/series" />
      <ContinueWatching />
      <Row title="Trending now" items={titlesOnly(data.results)} href="/browse/trending" />
      <Row title="Popular movies" items={movies.results ?? []} type="movie" href="/browse/popular-movies" />
      <Row title="Popular TV shows" items={tv.results ?? []} type="tv" href="/browse/popular-tv" />
      <Row title="Top rated movies" items={top.results ?? []} type="movie" href="/browse/top-rated" />
      <Row title="Hindi / Bollywood" items={hindi.results ?? []} type="movie" href="/browse/hindi" />
      <Row
        title="South Indian (Tamil + Telugu)"
        items={[...(tamil.results ?? []), ...(telugu.results ?? [])]
          .filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i)
          .slice(0, 20)}
        type="movie"
        href="/browse/south"
      />
      <Row title="Anime" items={anime.results ?? []} type="tv" href="/browse/anime" />
    </div>
  );
}
