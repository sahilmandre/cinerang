'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, Film, Tv } from 'lucide-react';
import { searchTitles, SearchResult } from '@/lib/tmdb-client';
import { poster } from '@/lib/tmdb';

function label(item: SearchResult) {
  const type = item.media_type === 'tv' ? 'tv' : 'movie';
  const title = item.title ?? item.name ?? 'Unknown';
  const year = (item.release_date ?? item.first_air_date ?? '').slice(0, 4);
  return { type, title, year };
}

export default function LiveSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await searchTitles(q.trim(), ctrl.signal);
        setResults(r);
        setOpen(true);
      } catch {
        /* aborted or flaky network — keep old results */
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const go = (query: string) => {
    if (!query.trim()) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div ref={boxRef} className="relative ml-auto w-full max-w-md">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => e.key === 'Enter' && go(q)}
          placeholder="Search movies, TV, anime…"
          className="w-full rounded-xl border border-white/10 bg-card/80 py-2.5 pl-9 pr-9 text-sm outline-none backdrop-blur transition placeholder:text-white/30 focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
        />
        {loading && (
          <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-accent" />
        )}
      </div>

      {open && q.trim().length >= 2 && !loading && (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-white/10 bg-[#101610]/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
          {results.length === 0 ? (
            <button
              onClick={() => go(q)}
              className="block w-full px-4 py-3 text-left text-sm text-white/50 hover:bg-white/5"
            >
              No quick matches — press Enter for full search
            </button>
          ) : (
            <>
              {results.map((r) => {
                const { type, title, year } = label(r);
                return (
                  <Link
                    key={`${type}-${r.id}`}
                    href={`/watch/${type}/${r.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 transition hover:bg-white/5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={poster(r.poster_path, 'w92')}
                      alt={title}
                      className="h-12 w-8 rounded object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{title}</p>
                      <p className="flex items-center gap-1.5 text-xs text-white/40">
                        {type === 'tv' ? <Tv size={11} /> : <Film size={11} />}
                        {type.toUpperCase()} {year && `• ${year}`}
                        {r.vote_average ? ` • ★ ${r.vote_average.toFixed(1)}` : ''}
                      </p>
                    </div>
                  </Link>
                );
              })}
              <button
                onClick={() => go(q)}
                className="block w-full border-t border-white/10 px-4 py-2.5 text-center text-sm font-medium text-accent hover:bg-white/5"
              >
                See all results for “{q.trim()}” →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
