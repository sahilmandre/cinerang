import { tmdb, poster, isAdultTitle } from '@/lib/tmdb';
import { genreSlug } from '@/lib/categories';
import { ADULT_DEFAULT_SERVER } from '@/lib/servers';
import Player from '@/components/Player';
import Row from '@/components/Row';
import LoadError from '@/components/LoadError';
import { Star, Clock, Calendar } from 'lucide-react';

export default async function WatchMovie({ params }: { params: { id: string } }) {
  let d: any = null;
  try {
    d = await tmdb.movieDetails(params.id);
  } catch {
    /* handled below */
  }
  if (!d?.id)
    return <LoadError title="Could not load this title" retryHref={`/watch/movie/${params.id}`} />;
  const adult = isAdultTitle(d);
  const trailer = d.videos?.results?.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
  return (
    <div className="mt-5">
      {/* Backdrop banner */}
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
            type="movie"
            title={d.title}
            posterPath={d.poster_path}
            adult={adult}
            defaultServer={adult ? ADULT_DEFAULT_SERVER : undefined}
          />
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight md:text-3xl">{d.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            {adult ? (
              <span className="rounded-md bg-red-600 px-2 py-1 text-xs font-extrabold text-white">
                18+ Adult
              </span>
            ) : null}
            {d.vote_average ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 font-bold text-amber-300">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                {d.vote_average.toFixed(1)}
              </span>
            ) : null}
            {d.release_date && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-white/60">
                <Calendar size={12} /> {d.release_date.slice(0, 4)}
              </span>
            )}
            {d.runtime ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-white/60">
                <Clock size={12} /> {d.runtime} min
              </span>
            ) : null}
            {(d.genres ?? []).slice(0, 5).map((g: any) => {
              const slug = genreSlug('movie', g.id);
              return slug ? (
                <a
                  key={g.id}
                  href={`/browse/${slug}`}
                  className="rounded-full bg-white/5 px-2.5 py-1 text-white/60 transition hover:border hover:border-accent/40 hover:text-white"
                >
                  {g.name}
                </a>
              ) : (
                <span key={g.id} className="rounded-full bg-white/5 px-2.5 py-1 text-white/60">
                  {g.name}
                </span>
              );
            })}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/75">{d.overview}</p>
          {trailer && (
            <a
              href={`https://www.youtube.com/watch?v=${trailer.key}`}
              target="_blank"
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/80 transition hover:border-accent/50 hover:text-white"
            >
              ▶ Official trailer <span className="text-xs text-white/40">(YouTube)</span>
            </a>
          )}
        </div>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster(d.poster_path, 'w500')}
            alt={d.title}
            className="w-full rounded-2xl border border-white/10 shadow-2xl shadow-black/50"
          />
          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-card/60 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">Cast</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/75">
              {(d.credits?.cast ?? []).slice(0, 8).map((c: any) => c.name).join(', ') || '—'}
            </p>
          </div>
        </div>
        <div className="lg:col-span-3">
          <Row title="More like this" items={(d.similar?.results ?? []).slice(0, 15)} type="movie" />
        </div>
      </div>
    </div>
  );
}
