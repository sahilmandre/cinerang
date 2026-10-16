import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { tmdb, poster, isAdultTitle } from '@/lib/tmdb';
import { genreSlug } from '@/lib/categories';
import { ADULT_DEFAULT_SERVER } from '@/lib/servers';
import Player from '@/components/Player';
import DownloadBox from '@/components/DownloadBox';
import WatchlistButton from '@/components/WatchlistButton';
import Row from '@/components/Row';
import LoadError from '@/components/LoadError';
import { Star, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  if (!/^\d+$/.test(params.id)) return { title: 'Not found — CineRang' };
  // Served from the shared fetch cache + singleflight: no extra TMDB call.
  const d = await tmdb.tvDetails(params.id).catch(() => null);
  if (!d?.id) return { title: 'Not found — CineRang' };
  return {
    title: `${d.name} — Watch | CineRang`,
    description: (d.overview ?? 'Watch now on CineRang.').slice(0, 160),
    openGraph: {
      title: d.name,
      description: (d.overview ?? '').slice(0, 200),
      images: d.poster_path ? [poster(d.poster_path, 'w500')] : [],
    },
  };
}

export default async function WatchTV({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { s?: string; e?: string };
}) {
  if (!/^\d+$/.test(params.id)) notFound();
  let d: any = null;
  try {
    d = await tmdb.tvDetails(params.id);
  } catch {
    /* handled below */
  }
  if (!d?.id)
    return <LoadError title="Could not load this title" retryHref={`/watch/tv/${params.id}`} />;
  const adult = isAdultTitle(d);
  const trailer = d.videos?.results?.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
  const season = Math.min(40, Math.max(1, Number(searchParams.s) || 1));
  const episode = Math.min(200, Math.max(1, Number(searchParams.e) || 1));
  const seasons: { season_number: number; episode_count: number; name: string }[] = (d.seasons ?? []).filter(
    (s: any) => s.season_number > 0
  );
  // Independent calls — fetch together instead of sequentially.
  const [seasonData, ext] = await Promise.all([
    tmdb.seasonDetails(params.id, season).catch(() => null),
    tmdb.tvExternalIds(params.id).catch(() => null),
  ]);
  const episodeCount: number | undefined = seasonData?.episodes?.length;
  return (
    <div className="mt-4 md:mt-5">
      <div className="relative -mx-4 overflow-hidden">
        <Image
          src={poster(d.backdrop_path ?? d.poster_path, 'w1280')}
          alt=""
          aria-hidden
          width={1280}
          height={720}
          sizes="100vw"
          className="h-36 w-full object-cover object-top opacity-40 blur-[2px] sm:h-44 md:h-64"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-base via-base/70 to-base/20" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Player
            tmdbId={params.id}
            type="tv"
            title={d.name}
            posterPath={d.poster_path}
            initialSeason={season}
            initialEpisode={episode}
            adult={adult}
            defaultServer={adult ? ADULT_DEFAULT_SERVER : undefined}
          />
          <DownloadBox
            title={d.name}
            year={d.first_air_date?.slice(0, 4)}
            type="tv"
            tmdbId={params.id}
            imdbId={ext?.imdb_id ?? null}
            season={season}
            episode={episode}
          />
          <h1 className="mt-5 text-balance text-2xl font-extrabold tracking-tight md:text-3xl">{d.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            {adult ? (
              <span className="rounded-md bg-red-600 px-2 py-1 text-xs font-extrabold text-white">
                18+ Adult
              </span>
            ) : null}
            {d.vote_average ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 font-bold text-amber-300">
                <Star size={12} aria-hidden className="fill-amber-400 text-amber-400" />
                {d.vote_average.toFixed(1)}
              </span>
            ) : null}
            <span aria-live="polite" className="rounded-full bg-white/5 px-2.5 py-1 tabular-nums text-white/60">
              S{season} : E{episode}
              {episodeCount ? ` / ${episodeCount}` : ''}
            </span>
            {d.number_of_seasons ? (
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/60">
                {d.number_of_seasons} season{d.number_of_seasons > 1 ? 's' : ''}
              </span>
            ) : null}
            {(d.genres ?? []).slice(0, 5).map((g: any) => {
              const slug = genreSlug('tv', g.id);
              return slug ? (
                <Link
                  key={g.id}
                  href={`/browse/${slug}`}
                  className="rounded-full bg-white/5 px-2.5 py-1 text-white/60 transition hover:text-white hover:ring-1 hover:ring-accent/40"
                >
                  {g.name}
                </Link>
              ) : (
                <span key={g.id} className="rounded-full bg-white/5 px-2.5 py-1 text-white/60">
                  {g.name}
                </span>
              );
            })}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/75">{d.overview}</p>
          <div className="mt-4">
            <WatchlistButton
              id={Number(params.id)}
              mediaType="tv"
              title={d.name}
              poster={d.poster_path ?? null}
            />
          </div>
          {trailer && (
            <a
              href={`https://www.youtube.com/watch?v=${trailer.key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/80 transition hover:border-accent/50 hover:text-white"
            >
              <Play size={14} aria-hidden className="fill-accent text-accent" />
              Official trailer <span className="text-xs text-white/40">(YouTube)</span>
            </a>
          )}

          <nav aria-label="Seasons" className="mt-5 rounded-2xl border border-white/[0.07] bg-card/60 p-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">Seasons</h2>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {seasons.map((s) => (
                <Link
                  key={s.season_number}
                  href={`/watch/tv/${params.id}?s=${s.season_number}&e=1`}
                  aria-current={s.season_number === season ? 'page' : undefined}
                  scroll={false}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-[13px] font-medium tabular-nums transition',
                    s.season_number === season
                      ? 'bg-accent font-bold text-black shadow-lg shadow-accent/30'
                      : 'border border-white/10 bg-white/[0.03] text-white/70 hover:border-accent/40 hover:text-white'
                  )}
                >
                  S{s.season_number}
                </Link>
              ))}
            </div>
          </nav>

          {seasonData && (
            <div className="mt-4 rounded-2xl border border-white/[0.07] bg-card/60 p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">
                Episodes — Season {season}
              </h2>
              <div role="list" className="mt-2.5 grid max-h-72 gap-2 overflow-y-auto pr-1">
                {(seasonData.episodes ?? []).map((ep: any) => {
                  const isCurrent = ep.episode_number === episode;
                  return (
                    <Link
                      key={ep.episode_number}
                      role="listitem"
                      href={`/watch/tv/${params.id}?s=${season}&e=${ep.episode_number}`}
                      aria-current={isCurrent ? 'page' : undefined}
                      scroll={false}
                      className={cn(
                        'rounded-xl border p-2.5 text-sm transition',
                        isCurrent
                          ? 'border-accent/60 bg-accent/10'
                          : 'border-white/[0.07] bg-black/30 hover:border-accent/30'
                      )}
                    >
                      <span className="font-bold tabular-nums text-accent">E{ep.episode_number}</span>
                      <span className="text-white/80"> — {ep.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <aside className="lg:col-span-1">
          <div className="flex gap-4 lg:block">
            <Image
              src={poster(d.poster_path, 'w500')}
              alt={`${d.name} poster`}
              width={500}
              height={750}
              loading="lazy"
              sizes="(max-width: 1024px) 128px, 400px"
              className="w-24 shrink-0 self-start rounded-2xl border border-white/10 shadow-card sm:w-32 lg:w-full"
            />
            <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.07] bg-card/60 p-4 lg:mt-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">About</h2>
              <p className="mt-1.5 line-clamp-6 text-sm leading-relaxed text-white/75">
                {d.overview || '—'}
              </p>
            </div>
          </div>
        </aside>
        <div className="min-w-0 lg:col-span-3">
          <Row title="More like this" items={(d.similar?.results ?? []).slice(0, 15)} type="tv" />
        </div>
      </div>
    </div>
  );
}
