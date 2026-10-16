'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS: { href: string; label: string; short?: string; adult?: boolean }[] = [
  { href: '/', label: 'Home' },
  { href: '/movies', label: 'Movies' },
  { href: '/tv', label: 'TV Series', short: 'TV' },
  { href: '/recommended', label: 'Recommended' },
  { href: '/watchlist', label: 'My Watchlist', short: 'Watchlist' },
  { href: '/taste', label: 'Taste' },
  { href: '/adult', label: '18+ Only', short: '18+', adult: true },
];

export default function NavLinks() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav
      aria-label="Primary"
      className="no-scrollbar -mx-3 flex snap-x snap-proximity flex-nowrap items-center gap-1 overflow-x-auto scroll-smooth px-3 py-0.5 [mask-image:linear-gradient(to_right,black_calc(100%_-_2rem),transparent)] sm:-mx-4 sm:px-4 lg:mx-0 lg:overflow-visible lg:px-0 lg:py-0 lg:[mask-image:none]"
    >
      {LINKS.map((l) => {
        const isActive = active(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-label={l.label}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-[2.5rem] snap-start items-center whitespace-nowrap rounded-full px-3 text-xs font-semibold transition sm:px-3.5 sm:text-[13px] lg:min-h-[2rem]',
              isActive
                ? l.adult
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                  : 'bg-accent text-black shadow-lg shadow-accent/25'
                : l.adult
                  ? 'border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
            )}
          >
            {l.short ? (
              <>
                <span className="sm:hidden">{l.short}</span>
                <span className="hidden sm:inline">{l.label}</span>
              </>
            ) : (
              l.label
            )}
          </Link>
        );
      })}
    </nav>
  );
}
