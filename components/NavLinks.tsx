'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/movies', label: 'Movies' },
  { href: '/tv', label: 'TV Series' },
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
              ? 'bg-accent text-black shadow-lg shadow-accent/25'
              : 'text-white/60 hover:bg-white/5 hover:text-white'
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
