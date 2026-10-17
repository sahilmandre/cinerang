import Link from 'next/link';
import { Calendar, Clock, Star } from 'lucide-react';
import { genreSlug } from '@/lib/categories';
import { cn } from '@/lib/utils';

const chip = 'inline-flex items-center gap-1.5 rounded-full glass px-2.5 py-1 text-xs font-medium text-white/75';

/**
 * Meta chips row for watch pages — rating, year, runtime/seasons, current
 * S/E position and clickable genre links. Pure presentation (server-safe).
 */
export default function MetaChips({
  type,
  adult = false,
  voteAverage,
  year,
  runtimeMin,
  seasons,
  currentSeason,
  currentEpisode,
  episodeCount,
  genres = [],
}: {
  type: 'movie' | 'tv';
  adult?: boolean;
  voteAverage?: number;
  year?: string;
  runtimeMin?: number;
  seasons?: number;
  currentSeason?: number;
  currentEpisode?: number;
  episodeCount?: number;
  genres?: { id: number; name: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      {adult ? (
        <span className="rounded-md border border-red-400/50 bg-red-500/10 px-2 py-0.5 text-xs font-extrabold text-red-300">
          18+ Adult
        </span>
      ) : null}
      {voteAverage ? (
        <span className={cn(chip, 'font-bold text-amber-300')}>
          <Star size={12} aria-hidden className="fill-amber-300 text-amber-300" />
          {voteAverage.toFixed(1)}
        </span>
      ) : null}
      {year ? (
        <span className={chip}>
          <Calendar size={12} aria-hidden /> {year}
        </span>
      ) : null}
      {runtimeMin ? (
        <span className={chip}>
          <Clock size={12} aria-hidden /> {runtimeMin} min
        </span>
      ) : null}
      {seasons ? (
        <span className={chip}>
          {seasons} season{seasons > 1 ? 's' : ''}
        </span>
      ) : null}
      {type === 'tv' && currentSeason != null && currentEpisode != null ? (
        <span aria-live="polite" className={cn(chip, 'tabular-nums')}>
          S{currentSeason} · E{currentEpisode}
          {episodeCount ? ` / ${episodeCount}` : ''}
        </span>
      ) : null}
      {genres.slice(0, 5).map((g) => {
        const slug = genreSlug(type, g.id);
        return slug ? (
          <Link
            key={g.id}
            href={`/browse/${slug}`}
            className={cn(chip, 'transition hover:border-accent/50 hover:text-accent')}
          >
            {g.name}
          </Link>
        ) : (
          <span key={g.id} className={chip}>
            {g.name}
          </span>
        );
      })}
    </div>
  );
}
