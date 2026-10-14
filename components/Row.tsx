import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
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
  if (!items?.length) return null;
  return (
    <section className="mt-9">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-emerald-500" />
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/40">
          {items.length}
        </span>
        {href && (
          <Link
            href={href}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-accent/50 hover:text-accent"
          >
            View all <ArrowRight size={12} />
          </Link>
        )}
      </div>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {items.map((m) => (
          <MovieCard key={`${type ?? m.media_type ?? 'x'}-${m.id}`} item={m} forceType={type} markAdult={markAdult} />
        ))}
      </div>
    </section>
  );
}
