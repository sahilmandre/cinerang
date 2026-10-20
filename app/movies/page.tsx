import { tmdb } from '@/lib/tmdb';
import Row from '@/components/Row';
import ContinueWatching from '@/components/ContinueWatching';
import PageHeader from '@/components/PageHeader';
import LoadError from '@/components/LoadError';

// Heal outage-degraded renders within 5 minutes (see app/page.tsx).
export const revalidate = 300;

// One flaky endpoint (e.g. an ECONNRESET mid-request) empties just its row
// instead of failing the whole page.
const empty = { results: [] as any[] };
const quiet = (p: Promise<any>) => p.catch(() => empty);

export default async function MoviesPage() {
  const [hollywood, hindi, telugu, tamil, korean, action, thriller, comedy, horror, romance] =
    await Promise.all([
      quiet(tmdb.moviesByLang('en')),
      quiet(tmdb.bollywood()),
      quiet(tmdb.moviesByLang('te')),
      quiet(tmdb.moviesByLang('ta')),
      quiet(tmdb.moviesByLang('ko')),
      quiet(tmdb.genreMovies(28)),
      quiet(tmdb.genreMovies(53)),
      quiet(tmdb.genreMovies(35)),
      quiet(tmdb.genreMovies(27)),
      quiet(tmdb.genreMovies(10749)),
    ]);
  const sections = [hollywood, hindi, telugu, tamil, korean, action, thriller, comedy, horror, romance];
  if (sections.every((s) => !(s.results?.length))) {
    return <LoadError title="Could not load Movies" retryHref="/movies" />;
  }
  return (
    <div className="mt-8">
      <PageHeader title="Movies" />
      <Row title="Hollywood (English)" items={hollywood.results ?? []} type="movie" href="/browse/hollywood" />
      <Row title="Bollywood (Hindi)" items={hindi.results ?? []} type="movie" href="/browse/hindi" />
      <Row title="Tollywood (Telugu)" items={telugu.results ?? []} type="movie" href="/browse/tollywood" />
      <Row title="Tamil" items={tamil.results ?? []} type="movie" href="/browse/tamil" />
      <Row title="Korean Movies" items={korean.results ?? []} type="movie" href="/browse/korean" />
      <Row title="Action" items={action.results ?? []} type="movie" href="/browse/movie-action" />
      <Row title="Thriller" items={thriller.results ?? []} type="movie" href="/browse/movie-thriller" />
      <Row title="Comedy" items={comedy.results ?? []} type="movie" href="/browse/movie-comedy" />
      <Row title="Horror" items={horror.results ?? []} type="movie" href="/browse/movie-horror" />
      <Row title="Romance" items={romance.results ?? []} type="movie" href="/browse/movie-romance" />
      <ContinueWatching />
    </div>
  );
}
