import { tmdb } from '@/lib/tmdb';
import Row from '@/components/Row';
import ContinueWatching from '@/components/ContinueWatching';

export default async function MoviesPage() {
  const [hollywood, hindi, telugu, tamil] = await Promise.all([
    tmdb.moviesByLang('en'),
    tmdb.bollywood(),
    tmdb.moviesByLang('te'),
    tmdb.moviesByLang('ta'),
  ]);
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
      <ContinueWatching />
    </div>
  );
}
