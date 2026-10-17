'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import MovieCard from '@/components/MovieCard';
import {
  WATCHLIST_EVENT,
  getWatchlist,
  toggleWatchlist,
  type ContinueItem,
} from '@/lib/storage';
import { cn } from '@/lib/utils';

type WatchlistFilter = 'all' | 'movie' | 'tv';

export default function WatchlistPage() {
  const [items, setItems] = useState<ContinueItem[]>([]);
  const [filter, setFilter] = useState<WatchlistFilter>('all');

  useEffect(() => {
    const load = () => setItems(getWatchlist());
    load();
    window.addEventListener(WATCHLIST_EVENT, load);
    return () => window.removeEventListener(WATCHLIST_EVENT, load);
  }, []);

  const filtered = useMemo(
    () => items.filter((item) => filter === 'all' || item.mediaType === filter),
    [items, filter]
  );

  const remove = (item: ContinueItem) => {
    toggleWatchlist(item);
    setItems(getWatchlist());
  };

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3 px-1">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.7rem]">My Watchlist</h1>
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs tabular-nums text-white/40">
          {filtered.length} of {items.length}
        </span>
      </div>

      <div className="mt-4 inline-flex gap-1 rounded-full glass p-1 text-sm font-semibold">
        {(
          [
            { value: 'all', label: 'All' },
            { value: 'movie', label: 'Movies' },
            { value: 'tv', label: 'Series' },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            aria-pressed={filter === option.value}
            className={cn(
              'rounded-full px-5 py-2 transition',
              filter === option.value
                ? 'bg-aurora text-black shadow-lg shadow-accent/25'
                : 'text-white/60 hover:text-white'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl glass p-6 text-center">
          <p className="text-sm text-white/60">
            {items.length === 0
              ? 'Your watchlist is empty. Bookmark titles from recommendations or watch pages to save them here.'
              : 'No saved titles match this filter.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/recommended"
              className="rounded-full bg-aurora px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-accent/25 transition hover:shadow-glow"
            >
              Find recommendations
            </Link>
            <Link
              href="/movies"
              className="rounded-full border border-white/10 px-6 py-2.5 text-sm font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
            >
              Browse movies
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">
          {filtered.map((item) => (
            <div key={`${item.mediaType}-${item.id}`} className="relative w-full">
              <MovieCard
                fluid
                item={{
                  id: item.id,
                  title: item.title,
                  poster_path: item.poster,
                  media_type: item.mediaType,
                }}
                forceType={item.mediaType}
              />
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={`Remove ${item.title} from My Watchlist`}
                title={`Remove ${item.title}`}
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-black/70 text-white/80 backdrop-blur transition hover:border-red-400/60 hover:bg-red-500/80 hover:text-white"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
