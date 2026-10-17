import { notFound } from 'next/navigation';
import { tmdb, poster, isAdultTitle } from '@/lib/tmdb';
import { ADULT_DEFAULT_SERVER } from '@/lib/servers';
import Player from '@/components/Player';
import DownloadBox from '@/components/DownloadBox';
import Row from '@/components/Row';
import LoadError from '@/components/LoadError';
import TitleHeader from '@/components/watch/TitleHeader';
import MetaChips from '@/components/watch/MetaChips';
import TitleActions from '@/components/watch/TitleActions';
import PosterAside from '@/components/watch/PosterAside';

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
    <div className="pb-2">
      <TitleHeader
        backdropPath={d.backdrop_path ?? d.poster_path}
        posterPath={d.poster_path}
        title={d.title}
        eyebrow="Movie"
        chips={
          <MetaChips
            type="movie"
            adult={adult}
            voteAverage={d.vote_average}
            year={d.release_date?.slice(0, 4)}
            runtimeMin={d.runtime}
            genres={d.genres ?? []}
          />
        }
        actions={
          <TitleActions
            id={Number(params.id)}
            mediaType="movie"
            title={d.title}
            posterPath={d.poster_path ?? null}
            trailerKey={trailer?.key}
          />
        }
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-3">
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
          {d.overview ? (
            <section className="mt-6 px-1">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Story</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/70">{d.overview}</p>
            </section>
          ) : null}
        </div>
        <PosterAside
          posterPath={d.poster_path}
          alt={`${d.title} poster`}
          label="Cast"
          text={(d.credits?.cast ?? []).slice(0, 8).map((c: any) => c.name).join(', ')}
        />
        <div className="min-w-0 lg:col-span-3">
          <Row title="More like this" items={(d.similar?.results ?? []).slice(0, 15)} type="movie" />
        </div>
      </div>
    </div>
  );
}
