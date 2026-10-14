'use client';
import { useEffect, useState } from 'react';
import { getContinue, ContinueItem } from '@/lib/storage';
import MovieCard from './MovieCard';

export default function ContinueWatching() {
  const [items, setItems] = useState<ContinueItem[]>([]);
  useEffect(() => setItems(getContinue()), []);
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Continue watching</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
        {items.map((c) => (
          <MovieCard
            key={`${c.mediaType}-${c.id}`}
            item={{ id: c.id, title: c.title, name: c.title, poster_path: c.poster }}
            forceType={c.mediaType}
          />
        ))}
      </div>
    </section>
  );
}
