import Link from 'next/link';
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

export default function MovieCard({ item, forceType }: { item: TMDBItem; forceType?: 'movie' | 'tv' }) {
  const type = forceType ?? mediaTypeOf(item);
  const title = item.title ?? item.name ?? 'Unknown';
  return (
    <Link
      href={`/watch/${type}/${item.id}`}
      className="group w-[140px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-card transition hover:border-accent/60 md:w-[160px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster(item.poster_path, 'w342')}
        alt={title}
        loading="lazy"
        className="aspect-[2/3] w-full object-cover transition group-hover:scale-105"
      />
      <div className="p-2">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-white/40">
          {type.toUpperCase()} {item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : ''}
        </p>
      </div>
    </Link>
  );
}
