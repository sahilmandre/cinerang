'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shuffle } from 'lucide-react';
import RecommendationCard, {
  type RecommendationItem,
} from '@/components/RecommendationCard';
import { getTaste, TASTE_EVENT, type TasteKind } from '@/lib/preferences';
import { localDayKey } from '@/lib/utils';

function serializeScores(scores: Record<string, number>): string {
  return Object.entries(scores)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .map(([key, value]) => `${key}:${Math.round(value * 100) / 100}`)
    .join(',');
}

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
  const [loading, setLoading] = useState(true);
  const [shuffleKey, setShuffleKey] = useState(0);

  const heading = title ?? (media === 'movie' ? 'Recommended movies' : 'Recommended series');
  const emptyNoun = media === 'movie' ? 'movies' : 'series';

  const load = useCallback(() => {
    const taste = getTaste();
    const params = new URLSearchParams();
    const favorites =
      media === 'movie' ? taste.favoriteGenres : taste.favoriteTvGenres;
    const watched =
      media === 'movie' ? taste.watchedMovieIds : taste.watchedTvIds;
    const liked = media === 'movie' ? taste.likedMovieIds : taste.likedTvIds;
    const disliked =
      media === 'movie' ? taste.dislikedMovieIds : taste.dislikedTvIds;
    params.set('media', media);
    if (favorites.length) params.set('favoriteGenres', favorites.join(','));
    if (watched.length) params.set('watchedIds', watched.join(','));
    if (liked.length) params.set('likedIds', liked.join(','));
    if (disliked.length) params.set('dislikedIds', disliked.join(','));
    const genreWeights = serializeScores(taste.genreScores);
    const languageScores = serializeScores(taste.languageScores);
    if (genreWeights) params.set('genreWeights', genreWeights);
    if (languageScores) params.set('languageScores', languageScores);
    params.set('limit', String(limit));
    // Daily rotation key plus manual shuffle token. The same taste returns
    // the same list all day; a new calendar day rotates the recommendations.
    params.set('date', localDayKey());
    params.set('shuffle', String(shuffleKey));

    setLoading(true);
    fetch(`/api/recommendations?${params.toString()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setItems(data.results ?? []))
      .catch(() => {
        /* keep old items on flaky network */
      })
      .finally(() => setLoading(false));
  }, [media, limit, shuffleKey]);

  useEffect(() => {
    load();
    // Refresh live when the taste quiz or feedback buttons save preferences.
    window.addEventListener(TASTE_EVENT, load);
    return () => window.removeEventListener(TASTE_EVENT, load);
  }, [load]);

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  if (loading && items.length === 0) {
    return (
      <section className="cv-auto mt-8 scroll-mt-24 md:mt-9">
        <h2 className="mb-3 text-base font-bold tracking-tight text-ink sm:text-lg">
          {heading}
        </h2>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="w-[136px] shrink-0 sm:w-[148px] md:w-[160px]">
              <div className="aspect-[2/3] rounded-xl bg-white/5 shimmer" />
              <div className="mt-2 h-3 w-32 rounded bg-white/5 shimmer" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="cv-auto mt-8 scroll-mt-24 md:mt-9">
        <div className="mb-3 flex items-center gap-2.5">
          <span
            aria-hidden
            className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-emerald-500"
          />
          <h2 className="text-base font-bold tracking-tight text-ink sm:text-lg">
            {heading}
          </h2>
        </div>
        <p className="text-sm text-white/50">
          Tell us your taste on the{' '}
          <a href="/taste" className="text-accent hover:underline">
            Taste page
          </a>
          , and we&apos;ll suggest {emptyNoun} just for you.
        </p>
      </section>
    );
  }

  return (
    <section className="cv-auto mt-8 scroll-mt-24 md:mt-9">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          aria-hidden
          className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-emerald-500"
        />
        <h2 className="text-base font-bold tracking-tight text-ink sm:text-lg">
          {heading}
        </h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/40">
          {items.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShuffleKey((key) => key + 1)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-accent/50 hover:text-accent"
          >
            <Shuffle size={12} aria-hidden />
            Shuffle
          </button>
          {viewAllHref ? (
            <Link
              href={viewAllHref}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-accent/50 hover:text-accent"
            >
              View all
            </Link>
          ) : null}
        </div>
      </div>
      <div className="no-scrollbar snap-strip -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {items.map((m) => (
          <RecommendationCard
            key={`${media}-${m.id}`}
            media={media}
            item={m}
            className="w-[136px] shrink-0 sm:w-[148px] md:w-[160px]"
            onFeedback={removeItem}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-white/35">
        Like trains your taste · Dislike hides a title · Bookmark saves it to My
        Watchlist
      </p>
    </section>
  );
}
