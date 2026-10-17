'use client';

import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import {
  WATCHLIST_EVENT,
  inWatchlist,
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
  const [saved, setSaved] = useState(() => inWatchlist(id, mediaType));

  useEffect(() => {
    const sync = () => setSaved(inWatchlist(id, mediaType));
    sync();
    window.addEventListener(WATCHLIST_EVENT, sync);
    return () => window.removeEventListener(WATCHLIST_EVENT, sync);
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
