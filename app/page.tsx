import { tmdb } from '@/lib/tmdb';
import Hero from '@/components/Hero';
import Row from '@/components/Row';
import ContinueWatching from '@/components/ContinueWatching';

export default async function Home() {
  let data: any = { results: [] };
  let movies = { results: [] };
  let tv = { results: [] };
  let top = { results: [] };
  let anime = { results: [] };
  let hindi: any = { results: [] };
  let tamil: any = { results: [] };
  let telugu: any = { results: [] };
  try {
    [data, movies, tv, top, anime, hindi, tamil, telugu] = await Promise.all([
      tmdb.trending('all'),
      tmdb.popularMovies(),
      tmdb.popularTV(),
      tmdb.topRatedMovies(),
      tmdb.anime(),
      tmdb.bollywood(),
      tmdb.southTamil(),
      tmdb.southTelugu(),
    ]);
  } catch (e: any) {
    return (
      <div className="mt-10 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-6">
        <h1 className="text-xl font-bold">Add your TMDB API key to get started</h1>
        <p className="mt-2 text-sm text-white/70">
          1. Get a free key at themoviedb.org → Settings → API
          <br />
          2. Copy <code>.env.example</code> to <code>.env.local</code> and fill{' '}
          <code>NEXT_PUBLIC_TMDB_API_KEY</code>
          <br />
          3. Restart <code>npm run dev</code>
        </p>
        <p className="mt-2 text-xs text-white/40">Error: {String(e?.message)}</p>
      </div>
    );
  }
  return (
    <div>
      <Hero items={data.results ?? []} />
      <ContinueWatching />
      <Row title="Trending now" items={data.results ?? []} />
      <Row title="Popular movies" items={movies.results ?? []} type="movie" />
      <Row title="Popular TV shows" items={tv.results ?? []} type="tv" />
      <Row title="Top rated movies" items={top.results ?? []} type="movie" />
      <Row title="Hindi / Bollywood" items={hindi.results ?? []} type="movie" />
      <Row
        title="South Indian (Tamil + Telugu)"
        items={[...(tamil.results ?? []), ...(telugu.results ?? [])]
          .filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i)
          .slice(0, 20)}
        type="movie"
      />
      <Row title="Anime" items={anime.results ?? []} type="tv" />
    </div>
  );
}
