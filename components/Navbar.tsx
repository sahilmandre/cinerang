'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bookmark,
  Clapperboard,
  Home,
  Search,
  Sparkles,
  Tv,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import LiveSearch from './LiveSearch';
import NavLinks from './NavLinks';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/movies', label: 'Movies', icon: Clapperboard },
  { href: '/tv', label: 'Series', icon: Tv },
  { href: '/watchlist', label: 'Watchlist', icon: Bookmark },
  { href: '/taste', label: 'Taste', icon: Sparkles },
];

/** Mobile bottom tab bar — the primary navigation on phones. */
function BottomTabs() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-[#0c120d]/90 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((t) => {
          const isActive = active(t.href);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-label={t.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition',
                  isActive ? 'text-white' : 'text-white/45 hover:text-white/75'
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid h-7 w-11 place-items-center rounded-full transition',
                    isActive && 'bg-aurora-soft shadow-glow'
                  )}
                >
                  <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
                </span>
                <span className="text-[10px] font-semibold tracking-wide">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  // The expanded search only exists below `lg`. Close it after navigating
  // (picking a result) and when the viewport grows past `lg` (e.g. tablet
  // rotation) — otherwise the header renders empty with no way back.
  useEffect(() => setSearchOpen(false), [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (desktop.matches) setSearchOpen(false);
    };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0e0a]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-5">
          {/* Expanded mobile search replaces the whole bar content */}
          {searchOpen ? (
            <div className="flex w-full items-center gap-2 lg:hidden">
              <div className="min-w-0 flex-1">
                <LiveSearch autoFocus />
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white/70 transition hover:border-white/25 hover:text-white"
              >
                <X size={17} />
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/"
                className="group flex shrink-0 items-center gap-2.5 rounded-lg"
                aria-label="CineRang home"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-aurora text-white shadow-lg shadow-accent/30 transition group-hover:shadow-glow">
                  <Clapperboard size={17} strokeWidth={2.4} />
                </span>
                <span className="font-display text-xl font-bold tracking-tight">
                  cine<span className="text-aurora">rang</span>
                </span>
              </Link>

              {/* Desktop inline nav */}
              <div className="hidden min-w-0 flex-1 lg:block">
                <NavLinks />
              </div>

              {/* Desktop inline search */}
              <div className="hidden w-56 shrink-0 lg:block xl:w-64">
                <LiveSearch />
              </div>

              {/* Mobile: expandable search + discreet 18+ entry */}
              <div className="ml-auto flex items-center gap-2 lg:hidden">
                <Link
                  href="/adult"
                  aria-label="18+ only section"
                  className="rounded-md border border-red-500/40 px-1.5 py-0.5 text-[11px] font-extrabold text-red-400/90 transition hover:bg-red-500/15 hover:text-red-300"
                >
                  18+
                </Link>
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Open search"
                  className="grid h-9 w-9 place-items-center rounded-full glass text-white/75 transition hover:text-white"
                >
                  <Search size={17} />
                </button>
              </div>
            </>
          )}
        </div>
      </header>
      <BottomTabs />
    </>
  );
}
