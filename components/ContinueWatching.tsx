'use client';
import { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { getContinue, removeContinue, clearContinue, ContinueItem } from '@/lib/storage';
import MovieCard from './MovieCard';

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
        <button
          onClick={clear}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-white/50 transition hover:border-red-400/50 hover:text-red-300"
          title="Remove all items from Continue watching"
        >
          <Trash2 size={12} /> Clear all
        </button>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {items.map((c) => (
          <div key={`${c.mediaType}-${c.id}`} className="relative w-[136px] shrink-0 md:w-[160px]">
            <MovieCard
              item={{ id: c.id, title: c.title, name: c.title, poster_path: c.poster }}
              forceType={c.mediaType}
              fluid
            />
            <button
              onClick={() => remove(c.id, c.mediaType)}
              className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-white/15 bg-black/80 text-white/60 backdrop-blur transition hover:border-red-400/60 hover:text-red-300"
              title={`Remove ${c.title}`}
              aria-label={`Remove ${c.title} from Continue watching`}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
