import Link from 'next/link';
import { Clapperboard } from 'lucide-react';
import LiveSearch from './LiveSearch';
import NavLinks from './NavLinks';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-base/80 backdrop-blur-xl">
      {/* Mobile-first: row 1 = logo + search, row 2 = scrollable nav.
          Desktop (md+): single row logo / nav / search. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:flex-nowrap md:gap-4 md:py-3">
        <Link
          href="/"
          className="group order-1 flex shrink-0 items-center gap-2.5 rounded-lg"
          aria-label="CineRang home"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-emerald-400 text-black shadow-lg shadow-accent/25 transition group-hover:shadow-accent/40">
            <Clapperboard size={18} strokeWidth={2.5} />
          </span>
          <span className="hidden text-xl font-extrabold tracking-tight sm:inline">
            cine<span className="text-accent">rang</span>
          </span>
        </Link>
        <div className="order-2 min-w-0 flex-1 md:order-3 md:max-w-md md:flex-none md:basis-72 lg:basis-80">
          <LiveSearch />
        </div>
        <div className="order-3 min-w-0 basis-full md:order-2 md:basis-auto">
          <NavLinks />
        </div>
      </div>
    </header>
  );
}
