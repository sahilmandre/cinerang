import Link from 'next/link';
import { Clapperboard } from 'lucide-react';
import LiveSearch from './LiveSearch';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-base/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-emerald-400 text-black shadow-lg shadow-accent/25 transition group-hover:shadow-accent/40">
            <Clapperboard size={18} strokeWidth={2.5} />
          </span>
          <span className="text-xl font-extrabold tracking-tight">
            cine<span className="text-accent">rang</span>
          </span>
        </Link>
        <LiveSearch />
      </div>
    </header>
  );
}
