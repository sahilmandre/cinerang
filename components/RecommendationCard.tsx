'use client';

import { useEffect, useState } from 'react';
import { Bookmark, ThumbsDown, ThumbsUp } from 'lucide-react';
import MovieCard from '@/components/MovieCard';
import {
  TASTE_EVENT,
  isDisliked,
  isLiked,
  recordTitleDisliked,
  recordTitleLiked,
  recordTitleUnliked,
  type TasteKind,
} from '@/lib/preferences';
import {
  inWatchlist,
  subscribeWatchlist,
  toggleWatchlist,
} from '@/lib/storage';
import { cn } from '@/lib/utils';

export interface RecommendationItem {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average?: number;
  genre_ids?: number[];
  release_date?: string;
  original_language?: string;
  score: number;
  reasons: string[];
}

function iconButton(activeClass: string | null) {
  return cn(
    'grid h-7 w-7 place-items-center rounded-full border backdrop-blur transition',
    activeClass ??
      'border-white/15 bg-black/70 text-white/80 hover:border-accent/60 hover:text-accent'
  );
}

export default function RecommendationCard({
  media,
  item,
  className,
  onFeedback,
}: {
  media: TasteKind;
  item: RecommendationItem;
  className?: string;
  /** Lets the parent remove a liked/disliked title immediately. */
  onFeedback?: (id: number, feedback: 'like' | 'dislike') => void;
}) {
  // Real values load in the effect below — reading localStorage during the
  // first render would mismatch any server-rendered markup.
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => {
      setLiked(isLiked(item.id, media));
      setDisliked(isDisliked(item.id, media));
      setSaved(inWatchlist(item.id, media));
    };
    sync();
    window.addEventListener(TASTE_EVENT, sync);
    const unsubscribe = subscribeWatchlist(sync);
    return () => {
      window.removeEventListener(TASTE_EVENT, sync);
      unsubscribe();
    };
  }, [item.id, media]);

  // Toggle: a second click unlikes and takes back the signals it added.
  const like = () => {
    const signal = {
      kind: media,
      id: item.id,
      genreIds: item.genre_ids ?? [],
      languages: item.original_language ? [item.original_language] : [],
    };
    if (liked) {
      recordTitleUnliked(signal);
      setLiked(false);
      return;
    }
    recordTitleLiked(signal);
    setLiked(true);
    setDisliked(false);
    onFeedback?.(item.id, 'like');
  };

  const dislike = () => {
    recordTitleDisliked(item.id, media, item.genre_ids ?? []);
    setDisliked(true);
    setLiked(false);
    onFeedback?.(item.id, 'dislike');
  };

  const toggleSaved = () => {
    const next = toggleWatchlist({
      id: item.id,
      mediaType: media,
      title: item.title,
      poster: item.poster_path,
    });
    setSaved(next);
  };

  return (
    <div className={cn('relative', className)}>
      <MovieCard
        fluid
        item={{
          id: item.id,
          title: item.title,
          poster_path: item.poster_path,
          vote_average: item.vote_average,
          genre_ids: item.genre_ids,
          release_date: item.release_date,
          media_type: media,
        }}
        forceType={media}
        matchScore={item.score}
        matchReason={item.reasons[0] ?? undefined}
      />
      <div
        role="group"
        aria-label={`${item.title} recommendation actions`}
        className="absolute left-1.5 top-1.5 z-10 flex gap-1"
      >
        <button
          type="button"
          onClick={like}
          aria-pressed={liked}
          title={liked ? 'Liked — click to undo' : 'Like — show more titles like this'}
          aria-label={
            liked
              ? `Undo like for ${item.title}`
              : `Like ${item.title} and show more titles like this`
          }
          className={iconButton(
            liked ? 'border-transparent bg-accent text-black shadow-lg shadow-accent/30' : null
          )}
        >
          <ThumbsUp size={13} aria-hidden />
        </button>
        <button
          type="button"
          onClick={dislike}
          aria-pressed={disliked}
          title="Dislike — hide this title"
          aria-label={`Dislike ${item.title} and hide it from recommendations`}
          className={iconButton(
            disliked ? 'border-transparent bg-red-500 text-white shadow-lg shadow-red-500/30' : null
          )}
        >
          <ThumbsDown size={13} aria-hidden />
        </button>
        <button
          type="button"
          onClick={toggleSaved}
          aria-pressed={saved}
          title={saved ? 'Remove from My Watchlist' : 'Add to My Watchlist'}
          aria-label={
            saved
              ? `Remove ${item.title} from My Watchlist`
              : `Add ${item.title} to My Watchlist`
          }
          className={iconButton(
            saved ? 'border-transparent bg-accent text-black shadow-lg shadow-accent/30' : null
          )}
        >
          <Bookmark size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}
