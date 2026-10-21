import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { tmdb, poster, isAdultTitle, isTmdbNotFound } from '@/lib/tmdb';
import { ADULT_DEFAULT_SERVER } from '@/lib/servers';
import { getRelatedTitles } from '@/lib/related';
import RelatedCrossRow from '@/components/watch/RelatedCrossRow';
import Player from '@/components/Player';
import DownloadBox from '@/components/DownloadBox';
import Row from '@/components/Row';
import LoadError from '@/components/LoadError';
import TitleHeader from '@/components/watch/TitleHeader';
import MetaChips from '@/components/watch/MetaChips';
import TitleActions from '@/components/watch/TitleActions';
import PosterAside from '@/components/watch/PosterAside';
import { Play } from 'lucide-react';
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
  let missing = false;
  try {
    d = await tmdb.tvDetails(params.id);
  } catch (e) {
    missing = isTmdbNotFound(e);
  }
  // A deleted/unknown id is a real 404 — Retry could never fix it.
  if (missing) notFound();
  if (!d?.id)
    return <LoadError title="Could not load this title" retryHref={`/watch/tv/${params.id}`} />;
  const adult = isAdultTitle(d);
  const trailer = d.videos?.results?.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
  type SeasonEntry = { season_number: number; episode_count: number; name: string };
  const allSeasons: SeasonEntry[] = d.seasons ?? [];
  // Specials (season 0) are hidden unless they're all the show has.
  const regular = allSeasons.filter((s) => s.season_number > 0);
  const seasons = regular.length ? regular : allSeasons;
  // Snap ?s= to a season that exists (bad, fractional or out-of-range
  // values used to load a nonexistent season with no episode list).
  const requestedSeason = Math.floor(Number(searchParams.s));
  const season =
    seasons.find((s) => s.season_number === requestedSeason)?.season_number ??
    seasons[0]?.season_number ??
    1;
  // Independent calls — fetch together instead of sequentially.
  const [seasonData, ext, related] = await Promise.all([
    tmdb.seasonDetails(params.id, season).catch(() => null),
    tmdb.tvExternalIds(params.id).catch(() => null),
    // Blends TMDB's `similar` + `recommendations` and re-ranks them against
    // this series' genres, so the row shows genuinely comparable shows.
    getRelatedTitles(d, 'tv', { limit: 18, adult }),
  ]);
  const episodeCount: number | undefined =
    seasonData?.episodes?.length ||
    seasons.find((s) => s.season_number === season)?.episode_count ||
    undefined;
  const requestedEpisode = Math.floor(Number(searchParams.e));
  const episode =
    requestedEpisode >= 1 && (!episodeCount || requestedEpisode <= episodeCount)
      ? requestedEpisode
      : 1;
  const playerSeasons = seasons.map((s) => ({
    number: s.season_number,
    episodes: s.season_number === season && episodeCount ? episodeCount : s.episode_count ?? 0,
  }));
  return (
    <div className="pb-2">
      <TitleHeader
        backdropPath={d.backdrop_path ?? d.poster_path}
        posterPath={d.poster_path}
        title={d.name}
        eyebrow="Series"
        chips={
          <MetaChips
            type="tv"
            adult={adult}
            voteAverage={d.vote_average}
            year={d.first_air_date?.slice(0, 4)}
            seasons={d.number_of_seasons}
            currentSeason={season}
            currentEpisode={episode}
            episodeCount={episodeCount}
            genres={d.genres ?? []}
          />
        }
        actions={
          <TitleActions
            id={Number(params.id)}
            mediaType="tv"
            title={d.name}
            posterPath={d.poster_path ?? null}
            trailerKey={trailer?.key}
          />
        }
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Player
            tmdbId={params.id}
            type="tv"
            title={d.name}
            posterPath={d.poster_path}
            initialSeason={season}
            initialEpisode={episode}
            seasons={playerSeasons}
            adult={adult}
            defaultServer={adult ? ADULT_DEFAULT_SERVER : undefined}
            // Opened from a card (no ?s=&e=): continue the saved episode.
            resumeSaved={searchParams.s == null && searchParams.e == null}
            // Episode-list links name the episode; season tabs don't.
            episodeChosen={searchParams.e != null}
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

          <nav aria-label="Seasons" className="mt-6 px-1">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Seasons</h2>
            <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1">
              {seasons.map((s) => (
                <Link
                  key={s.season_number}
                  // No `e`: browsing a season isn't choosing an episode to watch.
                  href={`/watch/tv/${params.id}?s=${s.season_number}`}
                  aria-current={s.season_number === season ? 'page' : undefined}
                  title={s.name}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold tabular-nums transition',
                    s.season_number === season
                      ? 'bg-aurora font-bold text-black shadow-lg shadow-accent/25'
                      : 'glass text-white/65 hover:border-accent/40 hover:text-white'
                  )}
                >
                  S{s.season_number}
                </Link>
              ))}
            </div>
          </nav>

          {seasonData && (
            <section className="mt-5">
              <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
                Episodes — Season {season}
              </h2>
              <ul className="mt-2.5 grid max-h-[26rem] gap-2 overflow-y-auto pr-1">
                {(seasonData.episodes ?? []).map((ep: any) => {
                  const isCurrent = ep.episode_number === episode;
                  return (
                    <li key={ep.episode_number}>
                      <Link
                        href={`/watch/tv/${params.id}?s=${season}&e=${ep.episode_number}`}
                        aria-current={isCurrent ? 'page' : undefined}
                        scroll={false}
                        className={cn(
                          'group flex items-center gap-3.5 rounded-2xl p-2.5 transition',
                          isCurrent
                            ? 'bg-aurora-soft ring-1 ring-accent/40'
                            : 'hover:bg-white/[0.04] hover:ring-1 hover:ring-white/10'
                        )}
                      >
                        <span className="relative w-28 shrink-0 overflow-hidden rounded-xl bg-white/5 sm:w-32">
                          <Image
                            src={poster(ep.still_path, 'w185')}
                            alt=""
                            aria-hidden
                            width={185}
                            height={104}
                            loading="lazy"
                            sizes="128px"
                            className="aspect-video w-full object-cover"
                          />
                          <span
                            aria-hidden
                            className={cn(
                              'absolute inset-0 grid place-items-center bg-black/40 transition',
                              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            )}
                          >
                            <span
                              className={cn(
                                'grid h-8 w-8 place-items-center rounded-full',
                                isCurrent ? 'bg-aurora text-black' : 'bg-black/70 text-white'
                              )}
                            >
                              <Play size={13} className="ml-0.5 fill-current" />
                            </span>
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span
                              className={cn(
                                'text-xs font-extrabold tabular-nums',
                                isCurrent ? 'text-accent' : 'text-white/40'
                              )}
                            >
                              E{ep.episode_number}
                            </span>
                            <span className="truncate text-sm font-semibold text-white/90">
                              {ep.name}
                            </span>
                          </span>
                          {ep.overview ? (
                            <span className="mt-0.5 hidden text-xs leading-relaxed text-white/45 sm:line-clamp-1">
                              {ep.overview}
                            </span>
                          ) : null}
                          <span className="mt-0.5 block text-[11px] tabular-nums text-white/30">
                            {ep.air_date ? new Date(ep.air_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                            {ep.runtime ? ` · ${ep.runtime}m` : ''}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {d.overview ? (
            <section className="mt-6 px-1">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Story</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/70">{d.overview}</p>
            </section>
          ) : null}
        </div>
        <PosterAside
          posterPath={d.poster_path}
          alt={`${d.name} poster`}
          label="About"
          text={d.overview || '—'}
          clamp
        />
        <div className="min-w-0 lg:col-span-3">
          <Row title="More like this" items={related} type="tv" markAdult={adult} />
        </div>
        <div className="min-w-0 lg:col-span-3">
          <Suspense fallback={null}>
            <RelatedCrossRow details={d} type="tv" title="Movies with a similar vibe" adult={adult} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
