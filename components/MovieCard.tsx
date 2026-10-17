import Link from 'next/link';
import Image from 'next/image';
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
  genre_ids?: number[];
  release_date?: string;
  first_air_date?: string;
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
  matchScore,
  matchReason,
}: {
  item: TMDBItem;
  forceType?: 'movie' | 'tv';
  fluid?: boolean;
  /** Force the 18+ badge — used in gated 18+ sections where every title is mature by curation. */
  markAdult?: boolean;
  /** Optional "Match X%" badge shown on recommendations rows. */
  matchScore?: number;
  /** Optional reason text shown under the title on recommendations rows. */
  matchReason?: string;
}) {
  const type = forceType ?? mediaTypeOf(item);
  const title = item.title ?? item.name ?? 'Unknown';
  const year = (item.release_date ?? '').slice(0, 4);
  return (
    <Link
      href={`/watch/${type}/${item.id}`}
      aria-label={`${title} (${type === 'tv' ? 'TV series' : 'movie'})`}
      className={cn(
        'group overflow-hidden rounded-2xl bg-card/70 shadow-card transition duration-300',
        'hover:-translate-y-1.5 hover:bg-card hover:shadow-glow hover:ring-1 hover:ring-accent/50',
        'focus-visible:-translate-y-1.5 focus-visible:ring-1 focus-visible:ring-accent/50',
        fluid ? 'w-full' : 'w-[136px] shrink-0 sm:w-[148px] md:w-[160px]'
      )}
    >
      <div className="relative overflow-hidden bg-white/[0.03]">
        <Image
          src={poster(item.poster_path, 'w342')}
          alt={title}
          width={320}
          height={480}
          loading="lazy"
          sizes="(max-width: 640px) 136px, (max-width: 768px) 148px, 160px"
          className="aspect-[2/3] w-full object-cover transition duration-500 group-hover:scale-105 group-focus-visible:scale-105"
        />
        {/* Bottom scrim so badges stay readable over bright art */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent"
        />
        {item.vote_average ? (
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white/90 backdrop-blur-md">
            <Star size={10} aria-hidden className="fill-amber-300 text-amber-300" />
            {item.vote_average.toFixed(1)}
          </span>
        ) : null}
        {matchScore != null ? (
          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-aurora px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-black shadow-lg shadow-accent/25">
            {Math.round(matchScore)}%
          </span>
        ) : null}
        {item.adult || markAdult ? (
          <span className="absolute right-1.5 top-1.5 rounded-md border border-red-400/40 bg-red-950/70 px-1.5 py-0.5 text-[10px] font-extrabold text-red-300 backdrop-blur-md">
            18+
          </span>
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-aurora text-black shadow-xl shadow-accent/40 transition duration-300 group-hover:scale-110">
            <Play size={17} className="ml-0.5 fill-black" />
          </span>
        </span>
      </div>
      <div className="p-2.5 pb-2">
        <p className="truncate text-[13px] font-semibold leading-snug">{title}</p>
        <div className="mt-1 flex items-center justify-between gap-1.5">
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">
            {type === 'tv' ? 'Series' : 'Movie'}
            {year ? ` • ${year}` : ''}
          </p>
        </div>
        {matchReason && (
          <p className="mt-1 truncate text-[10px] uppercase tracking-wider text-accent/75">
            ∵ {matchReason}
          </p>
        )}
      </div>
    </Link>
  );
}
