import Link from 'next/link';
import { Star } from 'lucide-react';
import { poster } from '@/lib/tmdb';

export interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  media_type?: string;
  vote_average?: number;
}

export function mediaTypeOf(item: TMDBItem, fallback: 'movie' | 'tv' = 'movie') {
  if (item.media_type === 'tv' || item.media_type === 'movie') return item.media_type;
  if (item.name && !item.title) return 'tv';
  return fallback;
}

export default function MovieCard({
  item,
  forceType,
  fluid = false,
}: {
  item: TMDBItem;
  forceType?: 'movie' | 'tv';
  fluid?: boolean;
}) {
  const type = forceType ?? mediaTypeOf(item);
  const title = item.title ?? item.name ?? 'Unknown';
  return (
    <Link
      href={`/watch/${type}/${item.id}`}
      className={`group overflow-hidden rounded-xl border border-white/[0.07] bg-card transition duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/10 ${
        fluid ? 'w-full' : 'w-[136px] shrink-0 md:w-[160px]'
      }`}
    >
      <div className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster(item.poster_path, 'w342')}
          alt={title}
          loading="lazy"
          className="aspect-[2/3] w-full object-cover transition duration-500 group-hover:scale-105"
        />
        {item.vote_average ? (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold backdrop-blur">
            <Star size={10} className="fill-amber-400 text-amber-400" />
            {item.vote_average.toFixed(1)}
          </span>
        ) : null}
      </div>
      <div className="p-2">
        <p className="truncate text-[13px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/35">{type}</p>
      </div>
    </Link>
  );
}
