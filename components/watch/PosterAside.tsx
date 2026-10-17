import Image from 'next/image';
import { poster } from '@/lib/tmdb';

/**
 * Watch-page sidebar — poster thumb beside an info card on phones,
 * stacked full-width poster + card on desktop.
 */
export default function PosterAside({
  posterPath,
  alt,
  label,
  text,
  clamp = false,
}: {
  posterPath: string | null;
  alt: string;
  label: string;
  text: string;
  clamp?: boolean;
}) {
  return (
    <aside className="lg:col-span-1">
      <div className="flex gap-4 lg:block">
        {posterPath ? (
          <Image
            src={poster(posterPath, 'w500')}
            alt={alt}
            width={500}
            height={750}
            loading="lazy"
            sizes="(max-width: 1024px) 128px, 400px"
            className="w-24 shrink-0 self-start rounded-2xl ring-1 ring-white/15 shadow-card sm:w-32 lg:w-full"
          />
        ) : null}
        <div className="min-w-0 flex-1 rounded-2xl glass p-4 lg:mt-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</h2>
          <p className={`mt-2 text-sm leading-relaxed text-white/70 ${clamp ? 'line-clamp-6' : ''}`}>
            {text || '—'}
          </p>
        </div>
      </div>
    </aside>
  );
}
