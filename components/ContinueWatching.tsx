'use client';
import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Play, X } from 'lucide-react';
import { getContinue, removeContinue, clearContinue, ContinueItem } from '@/lib/storage';
import { poster } from '@/lib/tmdb-image';

export default function ContinueWatching() {
  const [items, setItems] = useState<ContinueItem[]>([]);
  const headingId = useId();
  useEffect(() => setItems(getContinue()), []);
  if (!items.length) return null;

  const remove = (id: number, mediaType: string) => {
    removeContinue(id, mediaType);
    setItems(getContinue());
  };
  const clear = () => {
    clearContinue();
    setItems([]);
  };

  return (
    <section aria-labelledby={headingId} className="cv-auto mt-10 scroll-mt-24 md:mt-12">
      <div className="mb-3.5 flex items-center gap-3 px-1">
        <h2
          id={headingId}
          className="font-display text-lg font-bold tracking-tight text-ink sm:text-xl"
        >
          Continue watching
        </h2>
        <span className="hidden rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/35 min-[420px]:inline-flex">
          {items.length}
        </span>
        <button
          onClick={clear}
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-3 pr-2 text-xs font-semibold text-white/40 transition hover:text-red-300"
          title="Remove all items from Continue watching"
        >
          <X size={12} aria-hidden /> Clear all
        </button>
      </div>

      <div
        role="region"
        aria-label="Continue watching — scrollable row"
        tabIndex={0}
        className="no-scrollbar snap-strip -mx-4 flex gap-3.5 overflow-x-auto px-4 pb-3 pt-1 md:gap-4"
      >
        {items.map((c) => (
          <div
            key={`${c.mediaType}-${c.id}`}
            className="group relative w-[148px] shrink-0 sm:w-[160px] md:w-[170px]"
          >
            <Link
              href={
                c.mediaType === 'tv'
                  ? `/watch/tv/${c.id}?s=${c.season ?? 1}&e=${c.episode ?? 1}`
                  : `/watch/movie/${c.id}`
              }
              aria-label={`Resume ${c.title}`}
              className="block overflow-hidden rounded-2xl bg-card/70 shadow-card transition duration-300 hover:-translate-y-1.5 hover:bg-card hover:shadow-glow hover:ring-1 hover:ring-accent/50 focus-visible:-translate-y-1.5 focus-visible:ring-1 focus-visible:ring-accent/50"
            >
              <div className="relative overflow-hidden bg-white/[0.03]">
                <Image
                  src={poster(c.poster, 'w342')}
                  alt=""
                  aria-hidden
                  width={340}
                  height={510}
                  loading="lazy"
                  sizes="170px"
                  className="aspect-[2/3] w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/75 to-transparent"
                />
                <span
                  aria-hidden
                  className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-aurora text-black shadow-xl shadow-accent/40">
                    <Play size={17} className="ml-0.5 fill-black" />
                  </span>
                </span>
                {c.mediaType === 'tv' && c.season != null && (
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-accent backdrop-blur-md">
                    S{c.season} · E{c.episode ?? 1}
                  </span>
                )}
              </div>
              <div className="p-2.5 pb-2">
                <p className="truncate text-[13px] font-semibold leading-snug">{c.title}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">
                  {c.mediaType === 'tv' ? 'Series' : 'Movie'}
                </p>
              </div>
            </Link>
            <button
              onClick={() => remove(c.id, c.mediaType)}
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-black/65 text-white/75 backdrop-blur-md transition hover:border-red-400/50 hover:bg-red-500/80 hover:text-white md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100"
              title={`Remove ${c.title}`}
              aria-label={`Remove ${c.title} from Continue watching`}
            >
              <X size={13} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
