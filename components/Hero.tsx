'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Star } from 'lucide-react';
import { poster } from '@/lib/tmdb-image';
import { TMDBItem } from './MovieCard';
import { cn } from '@/lib/utils';

const SLIDE_MS = 8000;

/**
 * Cinematic auto-rotating hero (Disney+/Hulu style). Backdrops crossfade
 * with a slow ken-burns zoom; only the current and next images are ever
 * mounted, so a visit downloads exactly one extra backdrop ahead of time.
 */
export default function Hero({ items }: { items: TMDBItem[] }) {
  const top = items.filter((m) => m.backdrop_path ?? m.poster_path).slice(0, 5);
  const n = top.length;
  const [current, setCurrent] = useState(0);
  const [mounted, setMounted] = useState<boolean[]>(() => top.map((_, i) => i < 2));
  const [paused, setPaused] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (i: number) => setCurrent(((i % n) + n) % n),
    [n]
  );

  // Auto-advance — pauses on hover/focus and whenever the hero is offscreen
  // or the tab is hidden, so timers never pile up in the background.
  useEffect(() => {
    if (paused || n < 2) return;
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!heroRef.current || heroRef.current.checkVisibility?.() === false) return;
      setCurrent((c) => (c + 1) % n);
    }, SLIDE_MS);
    return () => window.clearInterval(t);
  }, [paused, n, current]);

  // Preload exactly one slide ahead; seen slides stay mounted (already cached).
  useEffect(() => {
    const next = (current + 1) % n;
    setMounted((m) => (m[next] ? m : m.map((v, i) => (i === next ? true : v))));
  }, [current, n]);

  if (!n) return null;
  const active = top[current];
  const title = active.title ?? active.name ?? '';
  const year = (active.release_date ?? active.first_air_date ?? '').slice(0, 4);
  const type = active.media_type === 'tv' ? 'Series' : 'Movie';

  return (
    <div
      ref={heroRef}
      className="relative -mx-4 h-[68vh] min-h-[460px] max-h-[620px] overflow-hidden bg-card sm:mx-0 sm:h-[64vh] sm:min-h-[500px] sm:rounded-[28px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Trending now"
    >
      {/* Crossfading backdrops with slow ken-burns drift */}
      {top.map((m, i) =>
        mounted[i] ? (
          <div
            key={m.id}
            aria-hidden
            className={cn(
              'absolute inset-0 transition-opacity duration-[1200ms] ease-out motion-reduce:transition-none',
              i === current ? 'opacity-100' : 'opacity-0'
            )}
          >
            <Image
              src={poster(m.backdrop_path ?? m.poster_path, 'w1280')}
              alt=""
              width={1280}
              height={720}
              priority={i === 0}
              loading={i === 0 ? undefined : 'lazy'}
              sizes="100vw"
              className={cn(
                'h-full w-full object-cover',
                i === current && 'animate-hero-zoom motion-reduce:animate-none'
              )}
            />
          </div>
        ) : null
      )}

      {/* Legibility scrims */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0a0e0a] via-[#0a0e0a]/35 to-transparent" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#0a0e0a]/85 via-[#0a0e0a]/25 to-transparent" />

      {/* Slide content — re-keys per slide so text animates in */}
      <div
        key={active.id}
        className="absolute inset-x-0 bottom-0 p-5 pb-16 sm:p-8 sm:pb-20 md:p-12 md:pb-24"
      >
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
            <span className="h-1 w-6 rounded-full bg-aurora" />
            <span className="text-aurora">#{current + 1} Trending</span>
            <span aria-hidden className="text-white/25">•</span>
            {type}
          </p>
          <h1 className="mt-3 animate-fade-up font-display text-3xl font-bold leading-[1.05] tracking-tight drop-shadow-2xl sm:text-5xl md:text-6xl">
            {title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-white/70">
            {active.vote_average ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
                <Star size={14} aria-hidden className="fill-amber-300" />
                {active.vote_average.toFixed(1)}
              </span>
            ) : null}
            {year ? <span className="tabular-nums">{year}</span> : null}
            {active.adult ? (
              <span className="rounded border border-red-400/60 px-1 text-[11px] font-extrabold text-red-300">
                18+
              </span>
            ) : null}
          </div>
          {active.overview ? (
            <p className="mt-3 hidden max-w-xl animate-fade-up text-sm leading-relaxed text-white/65 sm:line-clamp-2">
              {active.overview}
            </p>
          ) : null}
          <div className="mt-5 animate-fade-up">
            <Link
              href={`/watch/${active.media_type === 'tv' ? 'tv' : 'movie'}/${active.id}`}
              className="group inline-flex items-center gap-2.5 rounded-full bg-aurora px-6 py-3 text-sm font-bold text-black shadow-xl shadow-accent/30 transition hover:shadow-glow sm:px-7 sm:py-3.5 sm:text-[15px]"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-black/15 transition group-hover:scale-110">
                <Play size={13} aria-hidden className="ml-px fill-black" />
              </span>
              Watch now
            </Link>
          </div>
        </div>
      </div>

      {/* Slide selector / progress pills */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 sm:bottom-6 sm:right-6 md:bottom-8 md:right-10">
        {top.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show slide ${i + 1}: ${m.title ?? m.name}`}
            aria-current={i === current}
            className="group relative h-1.5 overflow-hidden rounded-full bg-white/25 transition-all sm:h-2"
            style={{ width: i === current ? '2.75rem' : '1rem' }}
          >
            {i === current ? (
              <span
                key={`p-${current}-${paused}`}
                className="absolute inset-0 rounded-full bg-aurora motion-reduce:hidden"
                style={{
                  animation: `hero-progress ${SLIDE_MS}ms linear forwards`,
                  animationPlayState: paused ? 'paused' : 'running',
                }}
              />
            ) : (
              <span className="absolute inset-0 rounded-full bg-white/0 transition group-hover:bg-white/50" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
