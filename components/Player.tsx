'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Play, RotateCcw, ShieldCheck, ShieldOff, SquareArrowOutUpRight } from 'lucide-react';
import { SERVERS, getEmbedUrl, MediaType, ADULT_DEFAULT_SERVER, orderedServers } from '@/lib/servers';
import {
  getPopupBlock,
  lastServerFor,
  saveContinue,
  setPopupBlock,
  subscribeContinue,
} from '@/lib/storage';
import { cn } from '@/lib/utils';

// If a frame neither loads nor errors within this window, treat it as dead
// (iframe onError rarely fires cross-browser for network failures).
const LOAD_TIMEOUT_MS = 15000;

// A resume point synced from another device can land just after the page
// opens; within this window (and before the viewer picks a server) the
// player switches to the server saved with it.
const ADOPT_WINDOW_MS = 15000;

// Continue Watching gating: a title counts as "being watched" only after
// sustained visible engagement. Cross-origin embeds expose no play events,
// so these two observable proxies are used instead.
const DWELL_MS = 150000; // 2.5 min of visible, loaded player
const DWELL_TICK_MS = 5000;

export interface SeasonInfo {
  number: number;
  /** Episode count; 0 when TMDB doesn't know yet. */
  episodes: number;
}

export default function Player({
  tmdbId,
  type,
  title,
  posterPath,
  initialSeason = 1,
  initialEpisode = 1,
  seasons = [],
  defaultServer,
  adult = false,
}: {
  tmdbId: string;
  type: MediaType;
  title: string;
  posterPath: string | null;
  initialSeason?: number;
  initialEpisode?: number;
  /** The show's seasons in order — bounds S/E input and "Next episode". */
  seasons?: SeasonInfo[];
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
  // Defaults off; VidFast/VidLink refuse sandboxed frames and load direct.
  const [blocker, setBlocker] = useState(false);
  // The frame isn't rendered until the saved preferences are read —
  // otherwise it starts loading unsandboxed (or on the default server),
  // then remounts (double load).
  const [prefReady, setPrefReady] = useState(false);
  const toggleBlocker = () => {
    const next = !blocker;
    setBlocker(next);
    setPopupBlock(next);
    // No setKey needed: the iframe key includes the sandbox state, because
    // a changed sandbox attribute only applies when the frame navigates.
  };
  const [server, setServer] = useState(fallback);
  const serverRef = useRef(server);
  serverRef.current = server;
  // Set once the viewer chooses a server themselves; a synced resume point
  // must never override that choice.
  const userPickedRef = useRef(false);
  const savedServerRef = useRef<string | undefined>(undefined);
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [seasonDraft, setSeasonDraft] = useState(String(initialSeason));
  const [episodeDraft, setEpisodeDraft] = useState(String(initialEpisode));
  const [key, setKey] = useState(0);
  const [shield, setShield] = useState(true);
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
  // Direct frames sit under the click-to-play cover until the user clicks
  // it — nothing can be playing before then, so the dwell clock waits.
  const canPlayRef = useRef(false);
  canPlayRef.current = sandboxed || !shield;

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

  // A title resumes on the server it was last watched on (saved with
  // Continue Watching and synced to the account). Read after mount —
  // localStorage isn't available during SSR — and declared after the
  // episode reset above, which seeds triedRef with the default server.
  useEffect(() => {
    setBlocker(getPopupBlock());
    const saved = lastServerFor(Number(tmdbId), type);
    savedServerRef.current = saved;
    if (saved && saved !== serverRef.current && list.some((s) => s.id === saved)) {
      triedRef.current = [saved];
      setServer(saved);
    }
    setPrefReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbId, type]);

  // Load-timeout failover: complements onError for silent network failures.
  // Reads loadedRef instead of a setState updater (updaters must be pure —
  // StrictMode double-invokes them, which used to skip a server).
  useEffect(() => {
    markLoaded(false);
    const t = setTimeout(() => {
      if (!loadedRef.current) autoAdvanceRef.current();
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
    // `sandboxed` is in the iframe key, so a toggle remounts the frame and
    // needs a fresh loading state + timeout too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, episodeKey, key, sandboxed]);

  // Ad-click shield: covers direct (unsandboxed) frames so the first click
  // — the one most likely to call window.open() — hits our button, not the
  // 3rd-party player. Re-armed on every server/episode/reload/blocker change.
  useEffect(() => {
    setShield(true);
  }, [server, episodeKey, key, sandboxed]);

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
  const autoAdvance = (): string | null => {
    const remaining = list.map((s) => s.id).filter((id) => !triedRef.current.includes(id));
    if (!remaining.length) {
      setExhausted(true);
      return null;
    }
    const next = remaining[0];
    triedRef.current.push(next);
    setServer(next);
    markLoaded(false);
    setKey((k) => k + 1);
    return next;
  };
  const autoAdvanceRef = useRef(autoAdvance);
  autoAdvanceRef.current = autoAdvance;

  const nextUntried = list.map((s) => s.id).find((id) => !triedRef.current.includes(id));
  const nextName = list.find((s) => s.id === nextUntried)?.name;

  const persist = (s = season, e = episode, srv = server) =>
    saveContinue({
      id: Number(tmdbId),
      mediaType: type,
      title,
      poster: posterPath,
      season: s,
      episode: e,
      server: srv,
      updatedAt: Date.now(),
    });
  persistRef.current = persist;

  // First visit on another device: the account's resume point (and its
  // server) can arrive a moment after the page opens. Switch to it unless
  // the viewer already chose a server or has been watching a while.
  useEffect(() => {
    const openedAt = Date.now();
    return subscribeContinue(() => {
      if (userPickedRef.current || Date.now() - openedAt > ADOPT_WINDOW_MS) return;
      const saved = lastServerFor(Number(tmdbId), type);
      if (!saved || saved === savedServerRef.current) return;
      savedServerRef.current = saved;
      if (saved !== serverRef.current && list.some((s) => s.id === saved)) {
        loadServer(saved, true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbId, type]);

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
      if (!loadedRef.current || !canPlayRef.current) return;
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

  const seasonInfo = (s: number) => seasons.find((x) => x.number === s);

  /** Snaps S/E to the show's real seasons and episode counts. */
  const clampSeasonEp = (s: number, e: number): [number, number] => {
    let safeS = Math.max(0, Math.floor(s) || 0);
    if (seasons.length && !seasonInfo(safeS)) {
      // Unknown season: snap to the nearest season that exists.
      safeS = seasons.reduce((best, x) =>
        Math.abs(x.number - safeS) < Math.abs(best.number - safeS) ? x : best
      ).number;
    }
    if (!seasons.length) safeS = Math.max(1, safeS);
    const max = seasonInfo(safeS)?.episodes || Infinity;
    const safeE = Math.min(max, Math.max(1, Math.floor(e) || 1));
    return [safeS, safeE];
  };

  // Next episode, rolling over to the next season's first episode; null on
  // the series finale. Unknown episode counts allow stepping forward.
  const nextPosition = ((): [number, number] | null => {
    const info = seasonInfo(season);
    if (!info || !info.episodes || episode < info.episodes) return [season, episode + 1];
    const following = seasons[seasons.indexOf(info) + 1];
    return following ? [following.number, 1] : null;
  })();

  const setSeasonEp = (s: number, e: number) => {
    const [safeS, safeE] = clampSeasonEp(s, e);
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
    const [s, e] = clampSeasonEp(
      seasonDraft.trim() ? Number(seasonDraft) : season,
      Number(episodeDraft)
    );
    if (s !== season || e !== episode) setSeasonEp(s, e);
    else {
      setSeasonDraft(String(s));
      setEpisodeDraft(String(e));
    }
  };

  return (
    <div>
      {/* Source toolbar — servers left, utility controls right */}
      <div className="rounded-2xl glass p-2 sm:p-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <span className="pl-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
            Sources
          </span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] tabular-nums text-white/40">
            {SERVERS.length} · auto-failover
          </span>
          {adult ? (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-300">
              18+ — start with ★
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-1.5">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open player in new tab"
              title="Open player in new tab — use this to test if a blank iframe is an X-Frame/CSP block vs dead source"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/60 transition hover:border-accent/50 hover:text-white"
            >
              <SquareArrowOutUpRight size={14} aria-hidden />
            </a>
            <button
              onClick={toggleBlocker}
              aria-pressed={blocker}
              title="Sandboxed frame blocks popups and tab-hijacks. Turn on for blocking; turn off if a player refuses to load inside it."
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition',
                blocker
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/10 text-white/60 hover:border-accent/50 hover:text-white'
              )}
            >
              {blocker ? <ShieldCheck size={13} aria-hidden /> : <ShieldOff size={13} aria-hidden />}
              Blocker {blocker ? 'on' : 'off'}
            </button>
            <button
              onClick={() => {
                markLoaded(false);
                setKey((k) => k + 1);
              }}
              aria-label="Reload player"
              title="Reload the current server"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/60 transition hover:border-accent/50 hover:text-white"
            >
              <RotateCcw size={14} aria-hidden />
            </button>
          </div>
        </div>

        {/* Server chips — scrollable strip on narrow screens */}
        <div
          role="radiogroup"
          aria-label="Video servers"
          className="no-scrollbar -mx-1 mt-2 flex snap-x items-center gap-1.5 overflow-x-auto px-1 pb-0.5"
        >
          {list.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={server === s.id}
              onClick={() => {
                userPickedRef.current = true;
                loadServer(s.id, true);
                persist(season, episode, s.id);
              }}
              className={cn(
                'shrink-0 snap-start rounded-full px-3 py-1.5 text-[13px] font-medium transition',
                server === s.id
                  ? 'bg-aurora font-bold text-black shadow-lg shadow-accent/25'
                  : 'border border-white/10 bg-white/[0.03] text-white/70 hover:border-accent/50 hover:text-white'
              )}
            >
              {s.id === recommended ? '★ ' : null}
              {s.name}
              {s.hindi ? (
                <span className="ml-1.5 rounded bg-sky-500/20 px-1 py-px text-[10px] font-extrabold text-sky-300">
                  Hindi
                </span>
              ) : null}
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
        </div>

        {blocker && current?.noSandbox ? (
          <p className="mx-1 mt-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-xs leading-relaxed text-amber-200/90">
            {current.name} plays direct — it refuses sandboxed frames, so the
            popup-blocker can&apos;t apply here. Switch server for full blocking.
          </p>
        ) : null}
      </div>

      {/* Season / episode controls */}
      {type === 'tv' && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-2xl glass px-3 py-2.5 text-sm">
          <label htmlFor="player-season" className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
            Season
          </label>
          <input
            id="player-season"
            type="number"
            min={seasons[0]?.number ?? 1}
            max={seasons[seasons.length - 1]?.number}
            value={seasonDraft}
            onChange={(e) => setSeasonDraft(e.target.value)}
            onBlur={commitDrafts}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="w-16 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-center text-sm tabular-nums outline-none transition focus:border-accent/60"
          />
          <label htmlFor="player-episode" className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
            Episode
          </label>
          <input
            id="player-episode"
            type="number"
            min={1}
            max={seasonInfo(season)?.episodes || undefined}
            value={episodeDraft}
            onChange={(e) => setEpisodeDraft(e.target.value)}
            onBlur={commitDrafts}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="w-16 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-center text-sm tabular-nums outline-none transition focus:border-accent/60"
          />
          {nextPosition ? (
            <button
              onClick={() => setSeasonEp(nextPosition[0], nextPosition[1])}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-4 py-1.5 text-[13px] font-bold text-accent transition hover:bg-accent/25"
            >
              {nextPosition[0] !== season ? `Season ${nextPosition[0]}` : 'Next episode'}{' '}
              <span aria-hidden>→</span>
            </button>
          ) : (
            <span className="ml-auto text-xs font-semibold text-white/40">Series finale</span>
          )}
        </div>
      )}

      {/* Player frame */}
      <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-card ring-1 ring-white/5">
        {!loaded && !exhausted && (
          <div aria-hidden className="shimmer absolute inset-0 z-10 grid place-items-center bg-white/[0.03]">
            <p className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Loading player…
            </p>
          </div>
        )}
        {prefReady ? (
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
        ) : (
          <div className="aspect-video w-full" />
        )}
        {!sandboxed && shield && !exhausted && (
          <button
            type="button"
            onClick={() => setShield(false)}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center transition hover:bg-black/70"
            aria-label="Start playback — blocks the first ad popup click"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-aurora text-black shadow-lg shadow-accent/30 transition hover:scale-105">
              <Play size={26} aria-hidden className="ml-1 fill-black" />
            </span>
            <span className="text-sm font-bold text-white">Click to play</span>
            <span className="max-w-md text-xs leading-relaxed text-white/60">
              {current?.name} plays direct, so the popup-blocker can&apos;t apply.
              This cover absorbs the first click that usually opens an ad tab.
            </span>
          </button>
        )}
        {!sandboxed && !shield && !exhausted && (
          <button
            type="button"
            onClick={() => setShield(true)}
            title="Re-cover the player — use this if controls start opening ad tabs again"
            className="absolute right-2 top-2 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-bold text-white/80 backdrop-blur transition hover:bg-black/90 hover:text-white"
          >
            <ShieldCheck size={12} aria-hidden /> Ad shield
          </button>
        )}
      </div>

      {/* Failover status */}
      {exhausted ? (
        <div className="mt-2.5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3.5 text-xs leading-relaxed text-amber-200">
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
        <div className="mt-2.5 flex flex-wrap items-center gap-2 px-1">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-white/30">
            Auto-switches when a server fails to load. If the player loads but shows its
            own error, use “Try next server”.
          </p>
          {nextUntried && (
            <button
              onClick={() => {
                userPickedRef.current = true;
                persist(season, episode, autoAdvance() ?? server);
              }}
              className="shrink-0 rounded-full bg-accent/15 px-4 py-1.5 text-xs font-bold text-accent transition hover:bg-accent/25"
            >
              Try {nextName} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
