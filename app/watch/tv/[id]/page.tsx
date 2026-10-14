import { tmdb, poster } from '@/lib/tmdb';
import Player from '@/components/Player';
import Row from '@/components/Row';

export default async function WatchTV({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { s?: string; e?: string };
}) {
  const d = await tmdb.tvDetails(params.id);
  const season = Number(searchParams.s) || 1;
  const episode = Number(searchParams.e) || 1;
  const seasons: { season_number: number; episode_count: number; name: string }[] = (d.seasons ?? []).filter(
    (s: any) => s.season_number > 0
  );
  const seasonData = await tmdb.seasonDetails(params.id, season).catch(() => null);
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Player
          tmdbId={params.id}
          type="tv"
          title={d.name}
          posterPath={d.poster_path}
          initialSeason={season}
          initialEpisode={episode}
        />
        <h1 className="mt-4 text-2xl font-bold">{d.name}</h1>
        <p className="mt-1 text-sm text-white/50">
          {d.first_air_date} • {d.number_of_seasons} seasons • ★ {d.vote_average?.toFixed(1)}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/80">{d.overview}</p>

        <div className="mt-4">
          <h3 className="font-semibold">Seasons</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {seasons.map((s) => (
              <a
                key={s.season_number}
                href={`/watch/tv/${params.id}?s=${s.season_number}&e=1`}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  s.season_number === season
                    ? 'border-accent bg-accent font-semibold text-black'
                    : 'border-white/15 text-white/70'
                }`}
              >
                S{s.season_number}
              </a>
            ))}
          </div>
        </div>

        {seasonData && (
          <div className="mt-4 grid gap-2">
            <h3 className="font-semibold">Episodes — Season {season}</h3>
            <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
              {(seasonData.episodes ?? []).map((ep: any) => (
                <a
                  key={ep.episode_number}
                  href={`/watch/tv/${params.id}?s=${season}&e=${ep.episode_number}`}
                  className={`rounded-lg border p-2 text-sm ${
                    ep.episode_number === episode
                      ? 'border-accent bg-accent/10'
                      : 'border-white/10 bg-card hover:border-accent/40'
                  }`}
                >
                  <span className="font-semibold">E{ep.episode_number}</span> — {ep.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster(d.poster_path, 'w500')} alt={d.name} className="w-full rounded-xl border border-white/10" />
      </div>
      <div className="lg:col-span-3">
        <Row title="More like this" items={(d.similar?.results ?? []).slice(0, 15)} type="tv" />
      </div>
    </div>
  );
}
