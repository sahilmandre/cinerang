import { Play } from 'lucide-react';
import WatchlistButton from '@/components/WatchlistButton';

/**
 * Action row for watch pages — watchlist toggle plus the official trailer
 * link when TMDB has one. Server-safe; WatchlistButton is the client island.
 */
export default function TitleActions({
  id,
  mediaType,
  title,
  posterPath,
  trailerKey,
}: {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  trailerKey?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <WatchlistButton id={id} mediaType={mediaType} title={title} poster={posterPath} />
      {trailerKey ? (
        <a
          href={`https://www.youtube.com/watch?v=${trailerKey}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full glass px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:border-accent/50 hover:text-white"
        >
          <Play size={14} aria-hidden className="fill-accent text-accent" />
          Trailer <span className="text-xs text-white/35">(YouTube)</span>
        </a>
      ) : null}
    </div>
  );
}
