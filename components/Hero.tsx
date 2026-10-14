import Link from 'next/link';
import { poster } from '@/lib/tmdb';
import { TMDBItem } from './MovieCard';
import { Play } from 'lucide-react';

export default function Hero({ items }: { items: TMDBItem[] }) {
  const top = items.slice(0, 5);
  const [first, ...rest] = top;
  if (!first) return null;
  const title = first.title ?? first.name ?? '';
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <Link
        href={`/watch/${first.media_type === 'tv' ? 'tv' : 'movie'}/${first.id}`}
        className="relative overflow-hidden rounded-2xl border border-white/10 md:col-span-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster(first.backdrop_path ?? first.poster_path, 'w1280')}
          alt={title}
          className="h-[320px] w-full object-cover md:h-[380px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-xs text-accent">#1 Trending this week</p>
          <h1 className="text-2xl font-bold md:text-4xl">{title}</h1>
          <span className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
            <Play size={16} /> Watch now
          </span>
        </div>
      </Link>
      <div className="grid gap-4">
        {rest.slice(0, 2).map((m) => (
          <Link
            key={m.id}
            href={`/watch/${m.media_type === 'tv' ? 'tv' : 'movie'}/${m.id}`}
            className="relative overflow-hidden rounded-2xl border border-white/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster(m.backdrop_path ?? m.poster_path, 'w780')}
              alt={m.title ?? m.name}
              className="h-[152px] w-full object-cover md:h-[182px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
            <p className="absolute bottom-3 left-3 font-semibold">{m.title ?? m.name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
