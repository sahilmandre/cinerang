'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, Clapperboard } from 'lucide-react';

export default function Navbar() {
  const [q, setQ] = useState('');
  const router = useRouter();
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-base/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-black">
            <Clapperboard size={18} />
          </span>
          cine<span className="text-accent">joy</span>
          <span className="text-xs font-normal text-white/40">clone</span>
        </Link>
        <form
          className="ml-auto flex w-full max-w-md items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <div className="relative w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search movies, TV, anime..."
              className="w-full rounded-lg border border-white/10 bg-card py-2 pl-9 pr-3 text-sm outline-none placeholder:text-white/30 focus:border-accent"
            />
          </div>
        </form>
      </div>
    </header>
  );
}
