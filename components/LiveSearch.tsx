'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Search, Film, Tv } from 'lucide-react';
import { searchTitles, SearchResult } from '@/lib/tmdb-client';
import { poster } from '@/lib/tmdb';
import { cn } from '@/lib/utils';

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
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const inputId = useId();
  const router = useRouter();

  const showDropdown = open && q.trim().length >= 2;

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setHighlight(-1);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await searchTitles(q.trim(), ctrl.signal);
        setResults(r);
        setHighlight(-1);
        setOpen(true);
      } catch {
        /* aborted or flaky network — keep old results */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
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
    setHighlight(-1);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <label htmlFor={inputId} className="sr-only">
        Search movies, TV shows and anime
      </label>
      <div className="relative">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
        />
        <input
          id={inputId}
          value={q}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={highlight >= 0 ? `${listId}-opt-${highlight}` : undefined}
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (highlight >= 0 && results[highlight]) {
                const r = results[highlight];
                const { type } = label(r);
                setOpen(false);
                router.push(`/watch/${type}/${r.id}`);
              } else {
                go(q);
              }
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, -1));
            }
          }}
          placeholder="Search movies, TV, anime…"
          className="w-full rounded-xl border border-white/10 bg-card/80 py-2 pl-9 pr-9 text-sm outline-none backdrop-blur transition placeholder:text-white/30 focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
        />
        {loading && (
          <Loader2
            size={16}
            aria-hidden
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-accent"
          />
        )}
        <span aria-live="polite" className="sr-only">
          {loading ? 'Searching…' : results.length ? `${results.length} suggestions` : ''}
        </span>
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-white/10 bg-card/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
          {loading && results.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-3 text-sm text-white/50">
              <Loader2 size={14} className="animate-spin text-accent" /> Searching…
            </p>
          ) : results.length === 0 ? (
            <button
              onClick={() => go(q)}
              className="block w-full px-4 py-3 text-left text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
            >
              No quick matches — press Enter for full search
            </button>
          ) : (
            <>
              <ul role="listbox" id={listId} aria-label="Search suggestions">
                {results.map((r, i) => {
                  const { type, title, year } = label(r);
                  return (
                    <li key={`${type}-${r.id}`} role="option" aria-selected={i === highlight}>
                      <Link
                        id={`${listId}-opt-${i}`}
                        href={`/watch/${type}/${r.id}`}
                        onClick={() => setOpen(false)}
                        onMouseEnter={() => setHighlight(i)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 transition',
                          i === highlight ? 'bg-white/10' : 'hover:bg-white/5'
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={poster(r.poster_path, 'w92')}
                          alt=""
                          aria-hidden
                          className="h-12 w-8 shrink-0 rounded bg-white/5 object-cover"
                          loading="lazy"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{title}</p>
                          <p className="flex items-center gap-1.5 text-xs text-white/40">
                            {type === 'tv' ? <Tv size={11} aria-hidden /> : <Film size={11} aria-hidden />}
                            {type.toUpperCase()} {year && `• ${year}`}
                            {r.vote_average ? ` • ★ ${r.vote_average.toFixed(1)}` : ''}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <button
                onClick={() => go(q)}
                className="block w-full border-t border-white/10 px-4 py-2.5 text-center text-sm font-medium text-accent transition hover:bg-white/5"
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
