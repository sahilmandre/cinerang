import Link from 'next/link';
import { Play, Star } from 'lucide-react';
import { poster } from '@/lib/tmdb';
import { cn } from '@/lib/utils';

export interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  media_type?: string;
  vote_average?: number;
  adult?: boolean;
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
  markAdult = false,
}: {
  item: TMDBItem;
  forceType?: 'movie' | 'tv';
  fluid?: boolean;
  /** Force the 18+ badge — used in gated 18+ sections where every title is mature by curation. */
  markAdult?: boolean;
}) {
  const type = forceType ?? mediaTypeOf(item);
  const title = item.title ?? item.name ?? 'Unknown';
  return (
    <Link
      href={`/watch/${type}/${item.id}`}
      aria-label={`${title} (${type === 'tv' ? 'TV series' : 'movie'})`}
      className={cn(
        'group overflow-hidden rounded-xl border border-white/[0.07] bg-card shadow-card transition duration-300',
        'hover:-translate-y-1 hover:border-accent/50 hover:shadow-glow',
        'focus-visible:-translate-y-1 focus-visible:border-accent/50',
        fluid ? 'w-full' : 'w-[136px] shrink-0 sm:w-[148px] md:w-[160px]'
      )}
    >
      <div className="relative overflow-hidden bg-white/[0.04]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster(item.poster_path, 'w342')}
          alt={title}
          loading="lazy"
          className="aspect-[2/3] w-full object-cover transition duration-500 group-hover:scale-105 group-focus-visible:scale-105"
        />
        {item.vote_average ? (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold backdrop-blur">
            <Star size={10} aria-hidden className="fill-amber-400 text-amber-400" />
            {item.vote_average.toFixed(1)}
          </span>
        ) : null}
        {item.adult || markAdult ? (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-extrabold shadow-lg">
            18+
          </span>
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-black shadow-xl shadow-accent/40">
            <Play size={16} className="ml-0.5 fill-black" />
          </span>
        </span>
      </div>
      <div className="p-2">
        <p className="truncate text-[13px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/35">{type}</p>
      </div>
    </Link>
  );
}
