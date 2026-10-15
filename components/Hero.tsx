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
    <div className="mt-4 grid gap-3 sm:gap-4 md:mt-5 md:grid-cols-3">
      <Link
        href={`/watch/${first.media_type === 'tv' ? 'tv' : 'movie'}/${first.id}`}
        className="group relative block overflow-hidden rounded-2xl border border-white/10 shadow-card transition duration-300 hover:border-accent/40 md:col-span-2"
        aria-label={`Watch ${title} now`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster(first.backdrop_path ?? first.poster_path, 'w1280')}
          alt=""
          aria-hidden
          fetchPriority="high"
          className="h-[260px] w-full object-cover transition duration-500 group-hover:scale-[1.03] sm:h-[300px] md:h-[400px]"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/5" />
        <div className="absolute inset-x-0 top-3 flex items-start justify-between px-3 sm:top-4 sm:px-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-black shadow-lg">
            <TrendingUp size={12} aria-hidden /> #1 Trending
          </span>
          {first.vote_average ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold backdrop-blur">
              <Star size={12} aria-hidden className="fill-amber-400 text-amber-400" />
              {first.vote_average.toFixed(1)}
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 md:p-6">
          <h1 className="max-w-2xl text-balance text-xl font-extrabold leading-tight tracking-tight drop-shadow-lg sm:text-2xl md:text-4xl">
            {title}
          </h1>
          {first.overview ? (
            <p className="mt-2 hidden max-w-xl text-sm leading-relaxed text-white/70 [display:-webkit-box] sm:line-clamp-2">
              {first.overview}
            </p>
          ) : null}
          <span className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black shadow-lg shadow-accent/30 transition group-hover:shadow-glow sm:px-5 sm:py-2.5">
            <Play size={16} aria-hidden className="fill-black" /> Watch now
          </span>
        </div>
      </Link>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-1">
        {rest.slice(0, 2).map((m, i) => (
          <Link
            key={m.id}
            href={`/watch/${m.media_type === 'tv' ? 'tv' : 'movie'}/${m.id}`}
            className="group relative block overflow-hidden rounded-2xl border border-white/10 transition duration-300 hover:border-accent/40"
            aria-label={`Watch ${m.title ?? m.name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster(m.backdrop_path ?? m.poster_path, 'w780')}
              alt=""
              aria-hidden
              loading="lazy"
              className="h-[140px] w-full object-cover transition duration-500 group-hover:scale-[1.04] sm:h-[150px] md:h-[192px]"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <p className="absolute inset-x-3 bottom-3 truncate text-sm font-semibold drop-shadow sm:text-[15px]">
              <span className="mr-2 text-xs font-bold text-accent">#{i + 2}</span>
              {m.title ?? m.name}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
