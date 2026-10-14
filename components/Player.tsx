'use client';
import { useEffect, useRef, useState } from 'react';
import { SERVERS, getEmbedUrl, MediaType, ADULT_DEFAULT_SERVER, orderedServers } from '@/lib/servers';
import { saveContinue } from '@/lib/storage';

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
  const fallback = defaultServer ?? (adult ? ADULT_DEFAULT_SERVER : '2embed');
  // 18+ titles: adult-resolving servers are listed first so the user
  // starts where the copy is most likely to exist — no blind trial.
  const list = orderedServers(adult);
  const recommended = adult ? (defaultServer ?? ADULT_DEFAULT_SERVER) : null;
  const [server, setServer] = useState(fallback);
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [key, setKey] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  // Servers already tried for this title/episode. Auto-failover walks this
  // list so one dead embed doesn't trap the viewer; stops after all tried.
  const triedRef = useRef<string[]>([fallback]);

  const episodeKey = `${tmdbId}-${season}-${episode}`;
  useEffect(() => {
    triedRef.current = [server];
    setExhausted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeKey]);

  const url = getEmbedUrl(server, type, tmdbId, season, episode);

  const loadServer = (id: string, resetTried = false) => {
    if (resetTried) triedRef.current = [id];
    else if (!triedRef.current.includes(id)) triedRef.current.push(id);
    setServer(id);
    setKey((k) => k + 1);
    setExhausted(false);
  };

  // Auto-switch: fires when the iframe itself fails to load (dead domain,
  // DNS block, connection reset). Note: errors rendered *inside* a loaded
  // player (e.g. "no copy for this title") are cross-origin and invisible
  // to us — use "Try next server" for those.
  const autoAdvance = () => {
    const remaining = list.map((s) => s.id).filter((id) => !triedRef.current.includes(id));
    if (!remaining.length) {
      setExhausted(true);
      return;
    }
    const next = remaining[0];
    triedRef.current.push(next);
    setServer(next);
    setKey((k) => k + 1);
  };

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

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/45">Video Sources</h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/40">
          {SERVERS.length} servers · auto-failover
        </span>
        {adult ? (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-300">
            18+ title — adult-resolving servers listed first, start with ★
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-card/60 p-2.5 backdrop-blur">
        {list.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              loadServer(s.id, true);
              persist();
            }}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
              server === s.id
                ? 'bg-accent font-bold text-black shadow-lg shadow-accent/30'
                : 'border border-white/10 bg-white/[0.03] text-white/70 hover:border-accent/40 hover:text-white'
            }`}
          >
            {s.id === recommended ? '★ ' : null}
            {s.name}
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
          className="rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] text-white/70 transition hover:border-accent/40 hover:text-white"
          title="Open player in new tab — use this to test if a blank iframe is an X-Frame/CSP block vs dead source"
        >
          ↗ Open
        </a>
        <button
          onClick={() => setKey((k) => k + 1)}
          className="ml-auto rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] text-white/70 transition hover:border-accent/40 hover:text-white"
        >
          ↻ Reload
        </button>
      </div>

      {type === 'tv' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-card/60 px-3 py-2.5 text-sm backdrop-blur">
          <label className="text-xs font-semibold uppercase tracking-wide text-white/50">Season</label>
          <input
            type="number"
            min={1}
            max={40}
            value={season}
            onChange={(e) => {
              const s = Number(e.target.value) || 1;
              setSeason(s);
              setKey((k) => k + 1);
              persist(s, episode);
            }}
            className="w-16 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-center outline-none focus:border-accent/60"
          />
          <label className="text-xs font-semibold uppercase tracking-wide text-white/50">Episode</label>
          <input
            type="number"
            min={1}
            max={200}
            value={episode}
            onChange={(e) => {
              const ep = Number(e.target.value) || 1;
              setEpisode(ep);
              setKey((k) => k + 1);
              persist(season, ep);
            }}
            className="w-16 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-center outline-none focus:border-accent/60"
          />
          <button
            onClick={() => {
              const ep = episode + 1;
              setEpisode(ep);
              setKey((k) => k + 1);
              persist(season, ep);
            }}
            className="ml-auto rounded-full bg-accent/15 px-4 py-1.5 font-semibold text-accent transition hover:bg-accent/25"
          >
            Next episode →
          </button>
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/60 ring-1 ring-white/5">
        <iframe
          key={`${server}-${season}-${episode}-${key}`}
          src={url}
          onError={autoAdvance}
          className="aspect-video w-full"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin"
          title={`${title} player`}
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
