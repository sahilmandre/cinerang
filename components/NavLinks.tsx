'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS: { href: string; label: string; adult?: boolean }[] = [
  { href: '/', label: 'Home' },
  { href: '/movies', label: 'Movies' },
  { href: '/tv', label: 'Series' },
  { href: '/recommended', label: 'For You' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/taste', label: 'Taste' },
  { href: '/adult', label: '18+', adult: true },
];

/** Desktop inline navigation — aurora underline slide for the active page. */
export default function NavLinks() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav aria-label="Primary" className="flex items-center gap-0.5 xl:gap-1">
      {LINKS.map((l) => {
        const isActive = active(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-label={l.label}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative rounded-full px-3 py-1.5 text-[13px] font-semibold tracking-wide transition xl:px-3.5 xl:text-sm',
              l.adult
                ? isActive
                  ? 'bg-red-500/15 text-red-300'
                  : 'text-red-400/80 hover:bg-red-500/10 hover:text-red-300'
                : isActive
                  ? 'text-white'
                  : 'text-white/55 hover:text-white'
            )}
          >
            {l.label}
            <span
              aria-hidden
              className={cn(
                'absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-aurora transition-opacity xl:inset-x-3.5',
                isActive && !l.adult ? 'opacity-100' : 'opacity-0'
              )}
            />
            {isActive && l.adult ? (
              <span aria-hidden className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-red-500" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
