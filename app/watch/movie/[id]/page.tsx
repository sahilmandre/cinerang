import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { tmdb, poster, isAdultTitle } from '@/lib/tmdb';
import { genreSlug } from '@/lib/categories';
import { ADULT_DEFAULT_SERVER } from '@/lib/servers';
import Player from '@/components/Player';
import DownloadBox from '@/components/DownloadBox';
import Row from '@/components/Row';
import LoadError from '@/components/LoadError';
import { Star, Clock, Calendar, Play } from 'lucide-react';

export async function generateMetadata({ params }: { params: { id: string } }) {
  if (!/^\d+$/.test(params.id)) return { title: 'Not found — CineRang' };
  // Served from the shared fetch cache + singleflight: no extra TMDB call.
  const d = await tmdb.movieDetails(params.id).catch(() => null);
  if (!d?.id) return { title: 'Not found — CineRang' };
  return {
    title: `${d.title} — Watch | CineRang`,
    description: (d.overview ?? 'Watch now on CineRang.').slice(0, 160),
    openGraph: {
      title: d.title,
      description: (d.overview ?? '').slice(0, 200),
      images: d.poster_path ? [poster(d.poster_path, 'w500')] : [],
    },
  };
}

export default async function WatchMovie({ params }: { params: { id: string } }) {
  if (!/^\d+$/.test(params.id)) notFound();
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
    <div className="mt-4 md:mt-5">
      {/* Backdrop banner */}
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
            type="movie"
            title={d.title}
            posterPath={d.poster_path}
            adult={adult}
            defaultServer={adult ? ADULT_DEFAULT_SERVER : undefined}
          />
          <DownloadBox
            title={d.title}
            year={d.release_date?.slice(0, 4)}
            type="movie"
            tmdbId={params.id}
            imdbId={d.imdb_id ?? null}
          />
          <h1 className="mt-5 text-balance text-2xl font-extrabold tracking-tight md:text-3xl">{d.title}</h1>
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
            {d.release_date && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-white/60">
                <Calendar size={12} aria-hidden /> {d.release_date.slice(0, 4)}
              </span>
            )}
            {d.runtime ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-white/60">
                <Clock size={12} aria-hidden /> {d.runtime} min
              </span>
            ) : null}
            {(d.genres ?? []).slice(0, 5).map((g: any) => {
              const slug = genreSlug('movie', g.id);
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
        </div>
        {/* Mobile-first sidebar: compact thumb row on phones, stacked card on desktop */}
        <aside className="lg:col-span-1">
          <div className="flex gap-4 lg:block">
            <Image
              src={poster(d.poster_path, 'w500')}
              alt={`${d.title} poster`}
              width={500}
              height={750}
              loading="lazy"
              sizes="(max-width: 1024px) 128px, 400px"
              className="w-24 shrink-0 self-start rounded-2xl border border-white/10 shadow-card sm:w-32 lg:w-full"
            />
            <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.07] bg-card/60 p-4 lg:mt-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">Cast</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-white/75">
                {(d.credits?.cast ?? []).slice(0, 8).map((c: any) => c.name).join(', ') || '—'}
              </p>
            </div>
          </div>
        </aside>
        <div className="min-w-0 lg:col-span-3">
          <Row title="More like this" items={(d.similar?.results ?? []).slice(0, 15)} type="movie" />
        </div>
      </div>
    </div>
  );
}
