import { tmdb } from '@/lib/tmdb';
import Row from '@/components/Row';
import ContinueWatching from '@/components/ContinueWatching';

export default async function TVPage() {
  const [english, hindi, korean, anime] = await Promise.all([
    tmdb.tvByLang('en'),
    tmdb.tvByLang('hi'),
    tmdb.tvByLang('ko'),
    tmdb.anime(),
  ]);
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
      <ContinueWatching />
    </div>
  );
}
