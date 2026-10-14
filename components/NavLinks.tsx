'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
    <nav className="flex shrink-0 items-center gap-1">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
            active(l.href)
              ? l.adult
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-accent text-black shadow-lg shadow-accent/25'
              : l.adult
                ? 'border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
