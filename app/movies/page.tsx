import { tmdb } from '@/lib/tmdb';
import Row from '@/components/Row';
import ContinueWatching from '@/components/ContinueWatching';
import LoadError from '@/components/LoadError';

export default async function MoviesPage() {
  let hollywood: any,
    hindi: any,
    telugu: any,
    tamil: any,
    korean: any,
    action: any,
    thriller: any,
    comedy: any,
    horror: any,
    romance: any;
  try {
    [hollywood, hindi, telugu, tamil, korean, action, thriller, comedy, horror, romance] =
      await Promise.all([
      tmdb.moviesByLang('en'),
      tmdb.bollywood(),
      tmdb.moviesByLang('te'),
      tmdb.moviesByLang('ta'),
      tmdb.moviesByLang('ko'),
      tmdb.genreMovies(28),
      tmdb.genreMovies(53),
      tmdb.genreMovies(35),
      tmdb.genreMovies(27),
      tmdb.genreMovies(10749),
      ]);
  } catch {
    return <LoadError title="Could not load Movies" retryHref="/movies" />;
  }
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2.5">
        <span className="h-6 w-1 rounded-full bg-gradient-to-b from-accent to-emerald-500" />
        <h1 className="text-2xl font-extrabold tracking-tight">Movies</h1>
      </div>
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
