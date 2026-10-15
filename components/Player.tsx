'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { RotateCcw, ShieldCheck, ShieldOff, SquareArrowOutUpRight } from 'lucide-react';
import { SERVERS, getEmbedUrl, MediaType, ADULT_DEFAULT_SERVER, orderedServers } from '@/lib/servers';
import { saveContinue } from '@/lib/storage';
import { cn } from '@/lib/utils';

// If a frame neither loads nor errors within this window, treat it as dead
// (iframe onError rarely fires cross-browser for network failures).
const LOAD_TIMEOUT_MS = 15000;

// Continue Watching gating: a title counts as "being watched" only after
// sustained visible engagement. Cross-origin embeds expose no play events,
// so these two observable proxies are used instead.
const DWELL_MS = 150000; // 2.5 min of visible, loaded player
const DWELL_TICK_MS = 5000;

export default function Player({
  tmdbId,
  type,
  title,
  posterPath,
  initialSeason = 1,
  initialEpisode = 1,
  defaultServer,
  adult = false,
}: {
  tmdbId: string;
  type: MediaType;
  title: string;
  posterPath: string | null;
  initialSeason?: number;
  initialEpisode?: number;
  defaultServer?: string;
  adult?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const fallback = defaultServer ?? (adult ? ADULT_DEFAULT_SERVER : '2embed');
  // 18+ titles: adult-resolving servers are listed first so the user
  // starts where the copy is most likely to exist — no blind trial.
  const list = orderedServers(adult);
  const recommended = adult ? (defaultServer ?? ADULT_DEFAULT_SERVER) : null;
  // Popup-blocker: sandboxed frame kills popups + tab-hijacks while
  // keeping scripts/storage alive. Cross-origin players can't escape it.
  // Defaults on; VidFast/VidLink refuse sandboxed frames and load direct.
  const [blocker, setBlocker] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem('cinerang.popup_block') === '0') setBlocker(false);
    } catch {
      /* stay protected */
    }
  }, []);
  const toggleBlocker = () => {
    setBlocker((b) => {
      try {
        localStorage.setItem('cinerang.popup_block', b ? '0' : '1');
      } catch {
        /* session-only */
      }
      return !b;
    });
    setKey((k) => k + 1);
  };
  const [server, setServer] = useState(fallback);
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [seasonDraft, setSeasonDraft] = useState(String(initialSeason));
  const [episodeDraft, setEpisodeDraft] = useState(String(initialEpisode));
  const [key, setKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Mirror of `loaded` for timeout callbacks — setState updaters must stay
  // pure (StrictMode double-invokes them), so async checks read the ref.
  const loadedRef = useRef(false);
  const markLoaded = (v: boolean) => {
    loadedRef.current = v;
    setLoaded(v);
  };
  const [exhausted, setExhausted] = useState(false);
  // Servers already tried for this title/episode. Auto-failover walks this
  // list so one dead embed doesn't trap the viewer; stops after all tried.
  const triedRef = useRef<string[]>([fallback]);
  // Engagement clock for the Continue Watching gate. Accumulates only
  // while the player frame has loaded AND the tab is visible — background
  // tabs and never-loaded embeds don't count.
  const dwellAccumRef = useRef(0);
  const dwellFiredRef = useRef(false);
  const persistRef = useRef(() => {});
  const current = list.find((s) => s.id === server);
  const sandboxed = blocker && !!current && !current.noSandbox;

  // Keep local S/E in sync when the URL changes (season / episode links).
  useEffect(() => {
    setSeason(initialSeason);
    setEpisode(initialEpisode);
    setSeasonDraft(String(initialSeason));
    setEpisodeDraft(String(initialEpisode));
  }, [initialSeason, initialEpisode]);

  const episodeKey = `${tmdbId}-${season}-${episode}`;
  useEffect(() => {
    triedRef.current = [server];
    setExhausted(false);
    markLoaded(false);
    dwellAccumRef.current = 0;
    dwellFiredRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeKey]);

  // Load-timeout failover: complements onError for silent network failures.
  // Reads loadedRef instead of a setState updater (updaters must be pure —
  // StrictMode double-invokes them, which used to skip a server).
  useEffect(() => {
    markLoaded(false);
    const t = setTimeout(() => {
      if (!loadedRef.current) autoAdvanceRef.current();
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, episodeKey, key]);

  const url = getEmbedUrl(server, type, tmdbId, season, episode);

  // Sync TV position back to the URL so refresh / share opens the same episode.
  const syncUrl = (s: number, e: number) => {
    if (type !== 'tv') return;
    try {
      router.replace(`${pathname}?s=${s}&e=${e}`, { scroll: false });
    } catch {
      /* non-fatal */
    }
  };

  const loadServer = (id: string, resetTried = false) => {
    if (resetTried) triedRef.current = [id];
    else if (!triedRef.current.includes(id)) triedRef.current.push(id);
    setServer(id);
    markLoaded(false);
    setKey((k) => k + 1);
    setExhausted(false);
  };

  // Auto-switch: fires when the iframe itself fails to load (dead domain,
  // DNS block, connection reset) or the load timeout elapses. Note: errors
  // rendered *inside* a loaded player (e.g. "no copy for this title") are
  // cross-origin and invisible to us — use "Try next server" for those.
  const autoAdvance = () => {
    const remaining = list.map((s) => s.id).filter((id) => !triedRef.current.includes(id));
    if (!remaining.length) {
      setExhausted(true);
      return;
    }
    const next = remaining[0];
    triedRef.current.push(next);
    setServer(next);
    markLoaded(false);
    setKey((k) => k + 1);
  };
  const autoAdvanceRef = useRef(autoAdvance);
  autoAdvanceRef.current = autoAdvance;

  const nextUntried = list.map((s) => s.id).find((id) => !triedRef.current.includes(id));
  const nextName = list.find((s) => s.id === nextUntried)?.name;

  const persist = (s = season, e = episode) =>
    saveContinue({
      id: Number(tmdbId),
      mediaType: type,
      title,
      poster: posterPath,
      season: s,
      episode: e,
      updatedAt: Date.now(),
    });
  persistRef.current = persist;

  // Continue Watching gate — the entry is written only on genuine
  // engagement, never on mere page view / embed render:
  //   (a) loaded player visible for DWELL_MS (watching, not bouncing),
  //   (b) fullscreen entered (strongest playback signal available —
  //       cross-origin frames expose no play events, but the parent
  //       document still observes its own iframe going fullscreen),
  //   (c) user drives the player (server switch / episode change persist
  //       immediately at their call sites).
  useEffect(() => {
    const onFullscreen = () => {
      if (document.fullscreenElement && !dwellFiredRef.current) {
        dwellFiredRef.current = true;
        persistRef.current();
      }
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    const id = window.setInterval(() => {
      if (dwellFiredRef.current) return;
      if (document.visibilityState !== 'visible') return;
      if (!loadedRef.current) return;
      dwellAccumRef.current += DWELL_TICK_MS;
      if (dwellAccumRef.current >= DWELL_MS) {
        dwellFiredRef.current = true;
        persistRef.current();
      }
    }, DWELL_TICK_MS);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSeasonEp = (s: number, e: number) => {
    const safeS = Math.max(1, Math.min(40, Math.floor(s) || 1));
    const safeE = Math.max(1, Math.min(200, Math.floor(e) || 1));
    setSeason(safeS);
    setEpisode(safeE);
    setSeasonDraft(String(safeS));
    setEpisodeDraft(String(safeE));
    markLoaded(false);
    setKey((k) => k + 1);
    persist(safeS, safeE);
    syncUrl(safeS, safeE);
  };

  // Draft text for the S/E fields: committing on every keystroke used to
  // reload the iframe per character (and fight the user mid-typing).
  // Drafts commit on blur / Enter instead; invalid text snaps back.
  const commitDrafts = () => {
    const s = Math.max(1, Math.min(40, Math.floor(Number(seasonDraft)) || 1));
    const e = Math.max(1, Math.min(200, Math.floor(Number(episodeDraft)) || 1));
    if (s !== season || e !== episode) setSeasonEp(s, e);
    else {
      setSeasonDraft(String(s));
      setEpisodeDraft(String(e));
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/45">Video Sources</h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] tabular-nums text-white/40">
          {SERVERS.length} servers · auto-failover
        </span>
        {adult ? (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-300">
            18+ title — adult-resolving servers listed first, start with ★
          </span>
        ) : null}
      </div>
      <div
        role="radiogroup"
        aria-label="Video servers"
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-card/60 p-2.5 backdrop-blur"
      >
        {list.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={server === s.id}
            onClick={() => {
              loadServer(s.id, true);
              persist();
            }}
            className={cn(
              'rounded-full px-3 py-1.5 text-[13px] font-medium transition sm:px-3.5',
              server === s.id
                ? 'bg-accent font-bold text-black shadow-lg shadow-accent/30'
                : 'border border-white/10 bg-white/[0.03] text-white/70 hover:border-accent/40 hover:text-white'
            )}
          >
            {s.id === recommended ? '★ ' : null}
            {s.name}
            {s.ads === 'none' ? (
              <span className="ml-1.5 rounded bg-emerald-500/20 px-1 py-px text-[10px] font-extrabold text-emerald-300">
                Ad-free
              </span>
            ) : null}
            {s.ads === 'minimal' ? (
              <span className="ml-1.5 rounded bg-white/10 px-1 py-px text-[10px] font-bold text-white/60">
                Few ads
              </span>
            ) : null}
            {adult && s.adultOk ? (
              <span className="ml-1.5 rounded bg-red-500/25 px-1 py-px text-[10px] font-extrabold text-red-200">
                18+
              </span>
            ) : null}
          </button>
        ))}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] text-white/70 transition hover:border-accent/40 hover:text-white"
          title="Open player in new tab — use this to test if a blank iframe is an X-Frame/CSP block vs dead source"
        >
          <SquareArrowOutUpRight size={13} aria-hidden /> Open
        </a>
        <button
          onClick={toggleBlocker}
          aria-pressed={blocker}
          title="Sandboxed frame blocks popups and tab-hijacks. Turn off if a player refuses to load inside it."
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition',
            blocker
              ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
              : 'border-white/10 text-white/70 hover:border-accent/40 hover:text-white'
          )}
        >
          {blocker ? <ShieldCheck size={14} aria-hidden /> : <ShieldOff size={14} aria-hidden />}
          <span aria-hidden className={cn('h-2 w-2 rounded-full', blocker ? 'bg-emerald-400' : 'bg-white/25')} />
          Blocker {blocker ? 'on' : 'off'}
        </button>
        <button
          onClick={() => {
            markLoaded(false);
            setKey((k) => k + 1);
          }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] text-white/70 transition hover:border-accent/40 hover:text-white"
        >
          <RotateCcw size={13} aria-hidden /> Reload
        </button>
      </div>
      {blocker && current?.noSandbox ? (
        <p className="mt-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-xs leading-relaxed text-amber-200/90">
          {current.name} plays direct — it refuses sandboxed frames, so the
          popup-blocker can&apos;t apply here. Switch server for full blocking.
        </p>
      ) : null}

      {type === 'tv' && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2.5 rounded-2xl border border-white/[0.07] bg-card/60 px-3 py-2.5 text-sm backdrop-blur">
          <label htmlFor="player-season" className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Season
          </label>
          <input
            id="player-season"
            type="number"
            min={1}
            max={40}
            value={seasonDraft}
            onChange={(e) => setSeasonDraft(e.target.value)}
            onBlur={commitDrafts}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="w-16 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-center tabular-nums outline-none focus:border-accent/60"
          />
          <label htmlFor="player-episode" className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Episode
          </label>
          <input
            id="player-episode"
            type="number"
            min={1}
            max={200}
            value={episodeDraft}
            onChange={(e) => setEpisodeDraft(e.target.value)}
            onBlur={commitDrafts}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="w-16 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-center tabular-nums outline-none focus:border-accent/60"
          />
          <button
            onClick={() => setSeasonEp(season, episode + 1)}
            className="ml-auto rounded-full bg-accent/15 px-4 py-1.5 font-semibold text-accent transition hover:bg-accent/25"
          >
            Next episode →
          </button>
        </div>
      )}

      <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-card ring-1 ring-white/5">
        {!loaded && !exhausted && (
          <div aria-hidden className="shimmer absolute inset-0 z-10 grid place-items-center bg-white/[0.03]">
            <p className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-medium text-white/60 backdrop-blur">
              Loading player…
            </p>
          </div>
        )}
        <iframe
          key={`${server}-${season}-${episode}-${key}-${sandboxed ? 'sb' : 'open'}`}
          src={url}
          onError={autoAdvance}
          onLoad={() => {
            // Embed rendered — starts the engagement clock (dwell timer),
            // but does NOT itself write Continue Watching.
            markLoaded(true);
          }}
          className="relative z-0 aspect-video w-full"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin"
          sandbox={sandboxed ? 'allow-scripts allow-same-origin allow-forms allow-presentation' : undefined}
          title={`${title} player${type === 'tv' ? `, season ${season} episode ${episode}` : ''}`}
        />
      </div>
      {exhausted ? (
        <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-200">
          Tried every server and none loaded. The title may be region-blocked or missing
          everywhere right now.{' '}
          <button
            onClick={() => {
              triedRef.current = [server];
              setExhausted(false);
              markLoaded(false);
              setKey((k) => k + 1);
            }}
            className="font-bold underline hover:text-amber-100"
          >
            Retry all servers
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="flex-1 text-xs leading-relaxed text-white/35">
            Auto-switches when a server fails to load. If the player loads but shows its
            own error, use “Try next server”.
          </p>
          {nextUntried && (
            <button
              onClick={() => {
                autoAdvance();
                persist();
              }}
              className="rounded-full bg-accent/15 px-4 py-1.5 text-xs font-bold text-accent transition hover:bg-accent/25"
            >
              Try {nextName} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
