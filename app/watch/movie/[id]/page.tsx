import { tmdb, poster } from '@/lib/tmdb';
import Player from '@/components/Player';
import Row from '@/components/Row';

export default async function WatchMovie({ params }: { params: { id: string } }) {
  const d = await tmdb.movieDetails(params.id);
  const trailer = d.videos?.results?.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Player tmdbId={params.id} type="movie" title={d.title} posterPath={d.poster_path} />
        <h1 className="mt-4 text-2xl font-bold">{d.title}</h1>
        <p className="mt-1 text-sm text-white/50">
          {d.release_date} • {d.runtime} min • ★ {d.vote_average?.toFixed(1)}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/80">{d.overview}</p>
        {trailer && (
          <a
            href={`https://www.youtube.com/watch?v=${trailer.key}`}
            target="_blank"
            className="mt-3 inline-block rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:border-accent/50"
          >
            ▶ Official trailer (YouTube — licensed)
          </a>
        )}
      </div>
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster(d.poster_path, 'w500')} alt={d.title} className="w-full rounded-xl border border-white/10" />
        <div className="mt-3">
          <h3 className="font-semibold">Cast</h3>
          <p className="mt-1 text-sm text-white/60">
            {(d.credits?.cast ?? []).slice(0, 8).map((c: any) => c.name).join(', ')}
          </p>
        </div>
      </div>
      <div className="lg:col-span-3">
        <Row title="More like this" items={(d.similar?.results ?? []).slice(0, 15)} type="movie" />
      </div>
    </div>
  );
}
