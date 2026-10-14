import { tmdb, poster } from '@/lib/tmdb';
import Player from '@/components/Player';
import Row from '@/components/Row';
import { Star } from 'lucide-react';

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
    <div className="mt-5">
      <div className="relative -mx-4 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster(d.backdrop_path ?? d.poster_path, 'w1280')}
          alt=""
          aria-hidden
          className="h-44 w-full object-cover object-top opacity-40 blur-[2px] md:h-64"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/70 to-base/20" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Player
            tmdbId={params.id}
            type="tv"
            title={d.name}
            posterPath={d.poster_path}
            initialSeason={season}
            initialEpisode={episode}
          />
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight md:text-3xl">{d.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            {d.vote_average ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 font-bold text-amber-300">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                {d.vote_average.toFixed(1)}
              </span>
            ) : null}
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/60">
              S{season} : E{episode}
            </span>
            {d.number_of_seasons ? (
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/60">
                {d.number_of_seasons} season{d.number_of_seasons > 1 ? 's' : ''}
              </span>
            ) : null}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/75">{d.overview}</p>

          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-card/60 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">Seasons</h3>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {seasons.map((s) => (
                <a
                  key={s.season_number}
                  href={`/watch/tv/${params.id}?s=${s.season_number}&e=1`}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                    s.season_number === season
                      ? 'bg-accent font-bold text-black shadow-lg shadow-accent/30'
                      : 'border border-white/10 bg-white/[0.03] text-white/70 hover:border-accent/40 hover:text-white'
                  }`}
                >
                  S{s.season_number}
                </a>
              ))}
            </div>
          </div>

          {seasonData && (
            <div className="mt-4 rounded-2xl border border-white/[0.07] bg-card/60 p-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">
                Episodes — Season {season}
              </h3>
              <div className="mt-2.5 grid max-h-72 gap-2 overflow-y-auto pr-1">
                {(seasonData.episodes ?? []).map((ep: any) => (
                  <a
                    key={ep.episode_number}
                    href={`/watch/tv/${params.id}?s=${season}&e=${ep.episode_number}`}
                    className={`rounded-xl border p-2.5 text-sm transition ${
                      ep.episode_number === episode
                        ? 'border-accent/60 bg-accent/10'
                        : 'border-white/[0.07] bg-black/30 hover:border-accent/30'
                    }`}
                  >
                    <span className="font-bold text-accent">E{ep.episode_number}</span>
                    <span className="text-white/80"> — {ep.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster(d.poster_path, 'w500')}
            alt={d.name}
            className="w-full rounded-2xl border border-white/10 shadow-2xl shadow-black/50"
          />
        </div>
        <div className="lg:col-span-3">
          <Row title="More like this" items={(d.similar?.results ?? []).slice(0, 15)} type="tv" />
        </div>
      </div>
    </div>
  );
}
