import Image from 'next/image';
import { poster } from '@/lib/tmdb-image';

/**
 * Cinematic title header — full-bleed backdrop with the poster, title,
 * meta chips and actions composited over a bottom scrim. Used by both
 * the movie and TV watch pages so their anatomy stays identical.
 */
export default function TitleHeader({
  backdropPath,
  posterPath,
  title,
  eyebrow,
  chips,
  actions,
}: {
  backdropPath: string | null;
  posterPath: string | null;
  title: string;
  eyebrow: string;
  chips?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="relative mt-2 overflow-hidden rounded-none sm:mx-0 sm:rounded-[28px]">
      {/* Backdrop + scrims */}
      <div aria-hidden className="absolute inset-0">
        <Image
          src={poster(backdropPath, 'w1280')}
          alt=""
          width={1280}
          height={720}
          priority
          sizes="100vw"
          className="h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/55 to-base/15" />
        <div className="absolute inset-0 bg-gradient-to-r from-base/80 via-base/30 to-transparent" />
      </div>

      {/* Content rides the flow, so the banner is always exactly tall enough */}
      <div className="relative flex items-end gap-5 px-5 pb-5 pt-36 sm:px-8 sm:pb-7 sm:pt-48 md:px-10 md:pb-9 md:pt-60">
        {posterPath ? (
          <div className="relative hidden h-44 w-28 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/20 shadow-2xl shadow-black/60 min-[420px]:block sm:h-52 sm:w-36 md:h-60 md:w-40">
            <Image
              src={poster(posterPath, 'w500')}
              alt={`${title} poster`}
              fill
              sizes="(max-width: 640px) 112px, (max-width: 768px) 144px, 160px"
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-accent">
            <span aria-hidden className="h-1 w-6 rounded-full bg-aurora" />
            {eyebrow}
          </p>
          <h1 className="mt-2 text-balance font-display text-2xl font-bold leading-[1.08] tracking-tight drop-shadow-xl sm:text-4xl md:text-5xl">
            {title}
          </h1>
          {chips ? <div className="mt-3 flex flex-wrap items-center gap-2">{chips}</div> : null}
          {actions ? <div className="mt-4 flex flex-wrap items-center gap-2.5">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}
