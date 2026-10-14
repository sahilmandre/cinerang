'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, Star, Trash2, X } from 'lucide-react';
import { getContinue, removeContinue, clearContinue, ContinueItem } from '@/lib/storage';
import { poster } from '@/lib/tmdb';

export default function ContinueWatching() {
  const [items, setItems] = useState<ContinueItem[]>([]);
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
    <section className="mt-9">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-emerald-500" />
        <h2 className="text-lg font-bold tracking-tight">Continue watching</h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/40">
          {items.length}
        </span>
        <button
          onClick={clear}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-white/50 transition hover:border-red-400/50 hover:text-red-300"
          title="Remove all items from Continue watching"
        >
          <Trash2 size={12} /> Clear all
        </button>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-3 pt-1">
        {items.map((c) => (
          <div key={`${c.mediaType}-${c.id}`} className="group relative w-[150px] shrink-0 md:w-[170px]">
            <Link
              href={`/watch/${c.mediaType}/${c.id}`}
              className="block overflow-hidden rounded-xl border border-white/[0.07] bg-card transition duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/10"
            >
              <div className="relative overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={poster(c.poster, 'w342')}
                  alt={c.title}
                  loading="lazy"
                  className="aspect-[2/3] w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 opacity-80" />
                {/* hover play */}
                <span className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-black shadow-xl shadow-accent/40">
                    <Play size={18} className="ml-0.5 fill-black" />
                  </span>
                </span>
                {c.mediaType === 'tv' && c.season != null && (
                  <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-accent backdrop-blur">
                    S{c.season} : E{c.episode ?? 1}
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-[13px] font-semibold">{c.title}</p>
                <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/35">
                  {c.mediaType === 'tv' ? 'TV Series' : 'Movie'}
                </p>
              </div>
            </Link>
            <button
              onClick={() => remove(c.id, c.mediaType)}
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-black/70 text-white/70 opacity-100 backdrop-blur transition hover:border-red-400/60 hover:bg-red-500/80 hover:text-white md:opacity-0 md:group-hover:opacity-100"
              title={`Remove ${c.title}`}
              aria-label={`Remove ${c.title} from Continue watching`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
