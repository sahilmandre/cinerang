'use client';

import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import {
  inWatchlist,
  subscribeWatchlist,
  toggleWatchlist,
} from '@/lib/storage';
import type { TasteKind } from '@/lib/preferences';
import { cn } from '@/lib/utils';

export default function WatchlistButton({
  id,
  mediaType,
  title,
  poster,
  className,
}: {
  id: number;
  mediaType: TasteKind;
  title: string;
  poster: string | null;
  className?: string;
}) {
  // Starts false to match the server render; reading localStorage here
  // caused a hydration mismatch that re-rendered the whole watch page
  // (reloading the player iframe). The effect loads the real value.
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(inWatchlist(id, mediaType));
    sync();
    return subscribeWatchlist(sync);
  }, [id, mediaType]);

  return (
    <button
      type="button"
      onClick={() =>
        setSaved(
          toggleWatchlist({ id, mediaType, title, poster })
        )
      }
      aria-pressed={saved}
      title={saved ? 'Remove from My Watchlist' : 'Add to My Watchlist'}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition',
        saved
          ? 'border-transparent bg-aurora text-black shadow-lg shadow-accent/25'
          : 'glass text-white/85 hover:border-accent/50 hover:text-white',
        className
      )}
    >
      {saved ? (
        <BookmarkCheck size={15} aria-hidden />
      ) : (
        <Bookmark size={15} aria-hidden />
      )}
      {saved ? 'In Watchlist' : 'Add to Watchlist'}
    </button>
  );
}
