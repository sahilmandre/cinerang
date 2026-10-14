import MovieCard, { TMDBItem } from './MovieCard';

export default function Row({ title, items, type }: { title: string; items: TMDBItem[]; type?: 'movie' | 'tv' }) {
  if (!items?.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
        {items.map((m) => (
          <MovieCard key={`${type ?? m.media_type ?? 'x'}-${m.id}`} item={m} forceType={type} />
        ))}
      </div>
    </section>
  );
}
