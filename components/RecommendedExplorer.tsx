'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Shuffle } from 'lucide-react';
import RecommendationCard, {
  type RecommendationItem,
} from '@/components/RecommendationCard';
import {
  getTaste,
  hasTasteFor,
  recommendationParams,
  TASTE_EVENT,
  type TasteKind,
  type UserTaste,
} from '@/lib/preferences';
import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES } from '@/lib/categories';
import { useReloadOnFirstSync } from '@/lib/sync/hooks';
import { cn } from '@/lib/utils';

const MOVIE_NAMES = new Map(TMDB_MOVIE_GENRES.map((g) => [g.id, g.name]));
const TV_NAMES = new Map(TMDB_TV_GENRES.map((g) => [g.id, g.name]));

export default function RecommendedExplorer({ media }: { media: TasteKind }) {
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [taste, setTaste] = useState<UserTaste | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'no-taste'>('loading');
  const [shuffleKey, setShuffleKey] = useState(0);
  const [genreFilter, setGenreFilter] = useState<number | null>(null);
  const [originFilter, setOriginFilter] = useState<'all' | 'hi' | 'ko'>('all');
  const syncKey = useReloadOnFirstSync(status === 'no-taste', media);

  const isMovie = media === 'movie';
  const names = isMovie ? MOVIE_NAMES : TV_NAMES;

  // Fetches on mount and on Shuffle only — Like/Dislike train the profile
  // without reshuffling the grid under the user (see RecommendedRow).
  useEffect(() => {
    const current = getTaste();
    setTaste(current);
    if (!hasTasteFor(current, media)) {
      setStatus('no-taste');
      return;
    }
    const controller = new AbortController();
    const params = recommendationParams(current, media, { limit: 48, shuffle: shuffleKey });
    setStatus('loading');
    fetch(`/api/recommendations?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const results: RecommendationItem[] = data.results ?? [];
        if (results.length) setItems(results);
        setStatus(results.length ? 'ready' : 'error');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [media, shuffleKey, syncKey]);

  // Keep the favorite-genre chips current as feedback trains the profile.
  useEffect(() => {
    const sync = () => setTaste(getTaste());
    window.addEventListener(TASTE_EVENT, sync);
    return () => window.removeEventListener(TASTE_EVENT, sync);
  }, []);

  // Dislike removes the card immediately. Likes keep it — a like only
  // trains the profile, the title must not vanish from the list.
  const handleFeedback = useCallback(
    (id: number, feedback: 'like' | 'dislike') => {
      if (feedback === 'dislike') {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    },
    []
  );

  const favoriteChips = useMemo(() => {
    if (!taste) return [];
    const favorites = isMovie ? taste.favoriteGenres : taste.favoriteTvGenres;
    return favorites
      .filter((id, index) => favorites.indexOf(id) === index)
      .slice(0, 10)
      .map((id) => ({ id, name: names.get(id) ?? `Genre ${id}` }));
  }, [taste, isMovie, names]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (genreFilter != null && !(item.genre_ids ?? []).includes(genreFilter)) {
          return false;
        }
        if (originFilter !== 'all' && item.original_language !== originFilter) {
          return false;
        }
        return true;
      }),
    [items, genreFilter, originFilter]
  );

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3 px-1">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.7rem]">
          Recommended for you
        </h1>
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs tabular-nums text-white/40">
          {filtered.length} of {items.length}
        </span>
        <button
          type="button"
          onClick={() => setShuffleKey((key) => key + 1)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold text-white/70 transition hover:border-accent/50 hover:text-accent"
        >
          <Shuffle size={12} aria-hidden />
          Shuffle
        </button>
      </div>
      <p className="mt-2 px-1 text-xs text-white/40">
        Fresh picks every calendar day. Like trains your taste, Dislike hides a
        title, and Bookmark adds it to My Watchlist.
      </p>

      <div
        role="tablist"
        aria-label="Recommendation type"
        className="mt-5 inline-flex rounded-full glass p-1 text-sm font-semibold"
      >
        <Link
          role="tab"
          aria-selected={isMovie}
          href="/recommended"
          className={cn(
            'rounded-full px-5 py-2 transition',
            isMovie ? 'bg-aurora text-black shadow-lg shadow-accent/25' : 'text-white/60 hover:text-white'
          )}
        >
          Movies
        </Link>
        <Link
          role="tab"
          aria-selected={!isMovie}
          href="/recommended/series"
          className={cn(
            'rounded-full px-5 py-2 transition',
            !isMovie ? 'bg-aurora text-black shadow-lg shadow-accent/25' : 'text-white/60 hover:text-white'
          )}
        >
          Series
        </Link>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setGenreFilter(null)}
          aria-pressed={genreFilter == null}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
            genreFilter == null
              ? 'border-transparent bg-accent font-bold text-black'
              : 'border-white/10 text-white/60 hover:border-accent/50 hover:text-accent'
          )}
        >
          All matches
        </button>
        {favoriteChips.map((genre) => (
          <button
            key={genre.id}
            type="button"
            onClick={() => setGenreFilter(genre.id)}
            aria-pressed={genreFilter === genre.id}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
              genreFilter === genre.id
                ? 'border-transparent bg-accent font-bold text-black'
                : 'border-white/10 text-white/60 hover:border-accent/50 hover:text-accent'
            )}
          >
            {genre.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOriginFilter(originFilter === 'hi' ? 'all' : 'hi')}
          aria-pressed={originFilter === 'hi'}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
            originFilter === 'hi'
              ? 'border-transparent bg-accent font-bold text-black'
              : 'border-white/10 text-white/60 hover:border-accent/50 hover:text-accent'
          )}
        >
          {isMovie ? 'Bollywood / Hindi' : 'Hindi series'}
        </button>
        <button
          type="button"
          onClick={() => setOriginFilter(originFilter === 'ko' ? 'all' : 'ko')}
          aria-pressed={originFilter === 'ko'}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
            originFilter === 'ko'
              ? 'border-transparent bg-accent font-bold text-black'
              : 'border-white/10 text-white/60 hover:border-accent/50 hover:text-accent'
          )}
        >
          {isMovie ? 'Korean movies' : 'K-dramas'}
        </button>
      </div>

      {status === 'no-taste' ? (
        <div className="mt-8 rounded-2xl glass p-6 text-center">
          <p className="text-sm text-white/60">
            We don&apos;t know your taste in {isMovie ? 'movies' : 'series'} yet.
            Take the quick{' '}
            <Link href="/taste" className="font-semibold text-accent hover:underline">
              taste quiz
            </Link>{' '}
            and we&apos;ll fill this page with picks for you.
          </p>
        </div>
      ) : status === 'error' && items.length === 0 ? (
        <div className="mt-8 rounded-2xl glass p-6 text-center">
          <p className="text-sm text-white/60">
            Couldn&apos;t load your recommendations right now.{' '}
            <button
              type="button"
              onClick={() => setShuffleKey((key) => key + 1)}
              className="font-semibold text-accent hover:underline"
            >
              Try again
            </button>
          </p>
        </div>
      ) : status === 'loading' && items.length === 0 ? (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <div className="shimmer aspect-[2/3] rounded-2xl bg-white/5" />
              <div className="shimmer mt-2 h-3 w-24 rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl glass p-6 text-center">
          <p className="text-sm text-white/60">
            No recommendations match these filters yet. Try another genre, clear
            the origin filter, shuffle, or retake the{' '}
            <Link href="/taste" className="font-semibold text-accent hover:underline">
              taste quiz
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">
          {filtered.map((item) => (
            <RecommendationCard
              key={`${media}-${item.id}`}
              media={media}
              item={item}
              className="w-full"
              onFeedback={handleFeedback}
            />
          ))}
        </div>
      )}
    </div>
  );
}
