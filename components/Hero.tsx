import Link from 'next/link';
import { poster } from '@/lib/tmdb';
import { TMDBItem } from './MovieCard';
import { Play, Star, TrendingUp } from 'lucide-react';

export default function Hero({ items }: { items: TMDBItem[] }) {
  const top = items.slice(0, 5);
  const [first, ...rest] = top;
  if (!first) return null;
  const title = first.title ?? first.name ?? '';
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-3">
      <Link
        href={`/watch/${first.media_type === 'tv' ? 'tv' : 'movie'}/${first.id}`}
        className="group relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 transition duration-300 hover:border-accent/40 hover:shadow-accent/10 md:col-span-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster(first.backdrop_path ?? first.poster_path, 'w1280')}
          alt={title}
          className="h-[300px] w-full object-cover transition duration-500 group-hover:scale-[1.03] md:h-[400px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-x-0 top-4 flex items-start justify-between px-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-black shadow-lg">
            <TrendingUp size={12} /> #1 Trending
          </span>
          {first.vote_average ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold backdrop-blur">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              {first.vote_average.toFixed(1)}
            </span>
          ) : null}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
          <h1 className="text-2xl font-extrabold tracking-tight drop-shadow-lg md:text-4xl">{title}</h1>
          <span className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-accent/30 transition group-hover:shadow-accent/50">
            <Play size={16} className="fill-black" /> Watch now
          </span>
        </div>
      </Link>
      <div className="grid gap-4">
        {rest.slice(0, 2).map((m, i) => (
          <Link
            key={m.id}
            href={`/watch/${m.media_type === 'tv' ? 'tv' : 'movie'}/${m.id}`}
            className="group relative overflow-hidden rounded-2xl border border-white/10 transition duration-300 hover:border-accent/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster(m.backdrop_path ?? m.poster_path, 'w780')}
              alt={m.title ?? m.name}
              loading="lazy"
              className="h-[142px] w-full object-cover transition duration-500 group-hover:scale-[1.04] md:h-[192px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            <p className="absolute bottom-3 left-3 right-3 truncate font-semibold drop-shadow">
              <span className="mr-2 text-xs font-bold text-accent">#{i + 2}</span>
              {m.title ?? m.name}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
