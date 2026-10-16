import Link from 'next/link';
import { Clapperboard } from 'lucide-react';
import LiveSearch from './LiveSearch';
import NavLinks from './NavLinks';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-base/80 backdrop-blur-xl">
      {/* Mobile/tablet portrait: row 1 = logo + search, row 2 = scrollable nav.
          Tablet landscape and desktop (lg+): single compact row logo / nav / search. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2.5 gap-y-1.5 px-3 py-2 sm:px-4 lg:flex-nowrap lg:gap-3">
        <Link
          href="/"
          className="group order-1 flex shrink-0 items-center gap-2 rounded-lg"
          aria-label="CineRang home"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-accent to-emerald-400 text-black shadow-lg shadow-accent/25 transition group-hover:shadow-accent/40">
            <Clapperboard size={17} strokeWidth={2.5} />
          </span>
          <span className="hidden text-lg font-extrabold tracking-tight sm:inline">
            cine<span className="text-accent">rang</span>
          </span>
        </Link>
        <div className="order-2 min-w-0 flex-1 lg:order-3 lg:grow-0 lg:shrink-0 lg:basis-52 xl:basis-60">
          <LiveSearch />
        </div>
        <div className="order-3 min-w-0 basis-full lg:order-2 lg:basis-auto lg:flex-1">
          <NavLinks />
        </div>
      </div>
    </header>
  );
}
