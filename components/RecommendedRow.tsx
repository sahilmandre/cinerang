'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Shuffle } from 'lucide-react';
import RecommendationCard, {
  type RecommendationItem,
} from '@/components/RecommendationCard';
import {
  getTaste,
  hasTasteFor,
  recommendationParams,
  type TasteKind,
} from '@/lib/preferences';

export default function RecommendedRow({
  media = 'movie',
  title,
  viewAllHref,
  limit = 15,
}: {
  media?: TasteKind;
  title?: string;
  viewAllHref?: string;
  limit?: number;
}) {
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'no-taste'>('loading');
  const [shuffleKey, setShuffleKey] = useState(0);

  const heading = title ?? (media === 'movie' ? 'Recommended movies' : 'Recommended series');
  const emptyNoun = media === 'movie' ? 'movies' : 'series';

  // Fetches on mount and on Shuffle only. Like/Dislike train the profile
  // without refetching — a refetch reseeds the mix and swaps the row out
  // from under the user. The new taste applies on the next Shuffle/visit.
  useEffect(() => {
    const taste = getTaste();
    if (!hasTasteFor(taste, media)) {
      setStatus('no-taste');
      return;
    }
    const controller = new AbortController();
    const params = recommendationParams(taste, media, { limit, shuffle: shuffleKey });
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
        // An empty list means every upstream pool failed — keep old items.
        if (results.length) setItems(results);
        setStatus(results.length ? 'ready' : 'error');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    // Aborting on Shuffle/unmount stops an older response landing last.
    return () => controller.abort();
  }, [media, limit, shuffleKey]);

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

  if (status === 'loading' && items.length === 0) {
    return (
      <section className="cv-auto mt-10 scroll-mt-24 md:mt-12">
        <div className="mb-3.5 flex items-center gap-3 px-1">
          <div className="h-5 w-48 rounded bg-white/10 shimmer" />
        </div>
        {/* Same strip geometry as the loaded row below (`-mx-4` + `px-4`),
            and enough cards to overflow it, so the skeleton is clipped at
            the container edge like the real strip instead of stopping at
            ~70% of the width and leaving a hole. */}
        <div className="no-scrollbar -mx-4 flex gap-3.5 overflow-hidden px-4 pb-2 md:gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="w-[136px] shrink-0 sm:w-[148px] md:w-[160px]">
              <div className="aspect-[2/3] rounded-2xl bg-white/5 shimmer" />
              <div className="mt-2 h-3 w-32 rounded bg-white/5 shimmer" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="cv-auto mt-10 scroll-mt-24 md:mt-12">
        <div className="mb-3.5 flex items-center gap-3 px-1">
          <h2 className="font-display text-lg font-bold tracking-tight text-ink sm:text-xl">
            {heading}
          </h2>
        </div>
        {status === 'no-taste' ? (
          <p className="px-1 text-sm text-white/50">
            Tell us your taste on the{' '}
            <Link href="/taste" className="font-semibold text-accent hover:underline">
              Taste page
            </Link>
            , and we&apos;ll suggest {emptyNoun} just for you.
          </p>
        ) : (
          <p className="px-1 text-sm text-white/50">
            Couldn&apos;t load your recommendations right now.{' '}
            <button
              type="button"
              onClick={() => setShuffleKey((key) => key + 1)}
              className="font-semibold text-accent hover:underline"
            >
              Try again
            </button>
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="cv-auto mt-10 scroll-mt-24 md:mt-12">
      <div className="mb-3.5 flex items-center gap-3 px-1">
        <h2 className="font-display text-lg font-bold tracking-tight text-ink sm:text-xl">
          {heading}
        </h2>
        <span className="hidden rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/35 min-[420px]:inline-flex">
          {items.length}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShuffleKey((key) => key + 1)}
            aria-label="Shuffle recommendations"
            title="Shuffle recommendations"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-3 pr-2 text-xs font-semibold text-white/45 transition hover:text-accent"
          >
            <Shuffle size={12} aria-hidden />
            Shuffle
          </button>
          {viewAllHref ? (
            <Link
              href={viewAllHref}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-3 pr-2 text-xs font-semibold text-white/45 transition hover:text-accent"
            >
              View all
              <ArrowRight size={13} aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
      <div className="no-scrollbar snap-strip -mx-4 flex gap-3.5 overflow-x-auto px-4 pb-2 md:gap-4">
        {items.map((m) => (
          <RecommendationCard
            key={`${media}-${m.id}`}
            media={media}
            item={m}
            className="w-[136px] shrink-0 sm:w-[148px] md:w-[160px]"
            onFeedback={handleFeedback}
          />
        ))}
      </div>
      <p className="mt-1 px-1 text-xs text-white/30">
        Like trains your taste · Dislike hides a title · Bookmark saves it to My
        Watchlist
      </p>
    </section>
  );
}
