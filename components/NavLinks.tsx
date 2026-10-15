'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS: { href: string; label: string; adult?: boolean }[] = [
  { href: '/', label: 'Home' },
  { href: '/movies', label: 'Movies' },
  { href: '/tv', label: 'TV Series' },
  { href: '/adult', label: '18+ Only', adult: true },
];

export default function NavLinks() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav
      aria-label="Primary"
      className="no-scrollbar -mx-4 flex flex-nowrap items-center gap-1 overflow-x-auto px-4 py-0.5 md:mx-0 md:overflow-visible md:px-0"
    >
      {LINKS.map((l) => {
        const isActive = active(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition sm:px-3.5 sm:text-sm',
              isActive
                ? l.adult
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                  : 'bg-accent text-black shadow-lg shadow-accent/25'
                : l.adult
                  ? 'border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
