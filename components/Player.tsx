'use client';
import { useState } from 'react';
import { SERVERS, getEmbedUrl, MediaType } from '@/lib/servers';
import { saveContinue } from '@/lib/storage';

export default function Player({
  tmdbId,
  type,
  title,
  posterPath,
  initialSeason = 1,
  initialEpisode = 1,
}: {
  tmdbId: string;
  type: MediaType;
  title: string;
  posterPath: string | null;
  initialSeason?: number;
  initialEpisode?: number;
}) {
  const [server, setServer] = useState('2embed');
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [key, setKey] = useState(0);

  const url = getEmbedUrl(server, type, tmdbId, season, episode);

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
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-card/60 p-2.5 backdrop-blur">
        {SERVERS.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setServer(s.id);
              setKey((k) => k + 1);
              persist();
            }}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
              server === s.id
                ? 'bg-accent font-bold text-black shadow-lg shadow-accent/30'
                : 'border border-white/10 bg-white/[0.03] text-white/70 hover:border-accent/40 hover:text-white'
            }`}
          >
            {s.name}
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
          className="aspect-video w-full"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin"
          title={`${title} player`}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/35">
        If one server fails, switch servers above. Blank + working “Open in new tab”
        usually means an embed block, not a dead source. uBlock Origin recommended.
      </p>
    </div>
  );
}
