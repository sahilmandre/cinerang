'use client';
import Link from 'next/link';
import { useId, useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import MovieCard, { TMDBItem } from './MovieCard';

export default function Row({
  title,
  items,
  type,
  href,
  markAdult = false,
}: {
  title: string;
  items: TMDBItem[];
  type?: 'movie' | 'tv';
  href?: string;
  markAdult?: boolean;
}) {
  const headingId = useId();
  const stripRef = useRef<HTMLDivElement>(null);
  if (!items?.length) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' });
  };

  return (
    <section aria-labelledby={headingId} className="mt-8 scroll-mt-24 md:mt-9">
      <div className="mb-3 flex items-center gap-2.5">
        <span aria-hidden className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-emerald-500" />
        <h2 id={headingId} className="text-base font-bold tracking-tight sm:text-lg">
          {title}
        </h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/40">
          {items.length}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden items-center gap-1 md:flex" role="group" aria-label={`Scroll ${title}`}>
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label={`Scroll ${title} left`}
              className="grid h-7 w-7 place-items-center rounded-full border border-white/10 text-white/60 transition hover:border-accent/50 hover:text-accent"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label={`Scroll ${title} right`}
              className="grid h-7 w-7 place-items-center rounded-full border border-white/10 text-white/60 transition hover:border-accent/50 hover:text-accent"
            >
              <ChevronRight size={14} />
            </button>
          </span>
          {href && (
            <Link
              href={href}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-accent/50 hover:text-accent"
            >
              View all <ArrowRight size={12} aria-hidden />
            </Link>
          )}
        </div>
      </div>
      <div
        ref={stripRef}
        role="region"
        aria-label={`${title} — scrollable row`}
        tabIndex={0}
        className="no-scrollbar snap-strip -mx-4 flex gap-3 overflow-x-auto px-4 pb-2"
      >
        {items.map((m) => (
          <MovieCard key={`${type ?? m.media_type ?? 'x'}-${m.id}`} item={m} forceType={type} markAdult={markAdult} />
        ))}
      </div>
    </section>
  );
}
