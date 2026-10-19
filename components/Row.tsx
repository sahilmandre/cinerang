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
    <section aria-labelledby={headingId} className="cv-auto group/row mt-10 scroll-mt-24 md:mt-12">
      <div className="mb-3.5 flex items-center gap-3 px-1">
        <h2
          id={headingId}
          className="font-display text-lg font-bold tracking-tight text-ink sm:text-xl"
        >
          {title}
        </h2>
        <span className="hidden rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/35 min-[420px]:inline-flex">
          {items.length}
        </span>
        {href && (
          <Link
            href={href}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-3 pr-2 text-xs font-semibold text-white/45 transition hover:text-accent"
          >
            View all
            <ArrowRight size={13} aria-hidden />
          </Link>
        )}
      </div>

      <div className="relative">
        {/* Desktop edge arrows — fade in when the row is hovered */}
        <div
          role="group"
          aria-label={`Scroll ${title}`}
          className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 hidden items-center justify-between md:flex"
        >
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label={`Scroll ${title} left`}
            className="pointer-events-auto ml-1 grid h-10 w-10 -translate-x-2 place-items-center rounded-full glass text-white/80 opacity-0 shadow-xl transition duration-300 hover:bg-[#16211a] hover:text-white group-hover/row:translate-x-0 group-hover/row:opacity-100"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label={`Scroll ${title} right`}
            className="pointer-events-auto mr-1 grid h-10 w-10 translate-x-2 place-items-center rounded-full glass text-white/80 opacity-0 shadow-xl transition duration-300 hover:bg-[#16211a] hover:text-white group-hover/row:translate-x-0 group-hover/row:opacity-100"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div
          ref={stripRef}
          role="region"
          aria-label={`${title} — scrollable row`}
          tabIndex={0}
          className="no-scrollbar snap-strip -mx-4 flex gap-3.5 overflow-x-auto px-4 pb-2.5 md:gap-4"
        >
          {items.map((m) => (
            <MovieCard
              key={`${type ?? m.media_type ?? 'x'}-${m.id}`}
              item={m}
              forceType={type}
              markAdult={markAdult}
              matchReason={m.matchReason}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
