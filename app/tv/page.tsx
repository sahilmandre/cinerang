import { tmdb } from '@/lib/tmdb';
import Row from '@/components/Row';
import ContinueWatching from '@/components/ContinueWatching';
import LoadError from '@/components/LoadError';

export default async function TVPage() {
  let english: any,
    hindi: any,
    korean: any,
    anime: any,
    action: any,
    crime: any,
    mystery: any,
    scifi: any;
  try {
    [english, hindi, korean, anime, action, crime, mystery, scifi] = await Promise.all([
      tmdb.tvByLang('en'),
      tmdb.tvByLang('hi'),
      tmdb.tvByLang('ko'),
      tmdb.anime(),
      tmdb.genreTV(10759),
      tmdb.genreTV(80),
      tmdb.genreTV(9648),
      tmdb.genreTV(10765),
    ]);
  } catch {
    return <LoadError title="Could not load TV Series" retryHref="/tv" />;
  }
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2.5">
        <span className="h-6 w-1 rounded-full bg-gradient-to-b from-accent to-emerald-500" />
        <h1 className="text-2xl font-extrabold tracking-tight">TV Series</h1>
      </div>
      <Row title="English Series" items={english.results ?? []} type="tv" href="/browse/tv-english" />
      <Row title="Hindi Series" items={hindi.results ?? []} type="tv" href="/browse/tv-hindi" />
      <Row title="Korean Series" items={korean.results ?? []} type="tv" href="/browse/tv-korean" />
      <Row title="Anime" items={anime.results ?? []} type="tv" href="/browse/anime" />
      <Row title="Action & Adventure" items={action.results ?? []} type="tv" href="/browse/tv-action" />
      <Row title="Crime" items={crime.results ?? []} type="tv" href="/browse/tv-crime" />
      <Row title="Mystery" items={mystery.results ?? []} type="tv" href="/browse/tv-mystery" />
      <Row title="Sci-Fi & Fantasy" items={scifi.results ?? []} type="tv" href="/browse/tv-scifi" />
      <ContinueWatching />
    </div>
  );
}
