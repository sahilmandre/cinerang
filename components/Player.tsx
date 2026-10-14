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
      <div className="flex flex-wrap items-center gap-2">
        {SERVERS.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setServer(s.id);
              setKey((k) => k + 1);
              persist();
            }}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              server === s.id
                ? 'border-accent bg-accent text-black font-semibold'
                : 'border-white/15 bg-card text-white/70 hover:border-accent/50'
            }`}
          >
            {s.name}
          </button>
        ))}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:border-accent/50"
          title="Open player in new tab — use this to test if a blank iframe is an X-Frame/CSP block vs dead source"
        >
          ↗ Open
        </a>
        <button
          onClick={() => setKey((k) => k + 1)}
          className="ml-auto rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:border-accent/50"
        >
          ↻ Reload
        </button>
      </div>

      {type === 'tv' && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <label className="text-white/60">S:</label>
          <input
            type="number"
            min={1}
            max={20}
            value={season}
            onChange={(e) => {
              const s = Number(e.target.value) || 1;
              setSeason(s);
              setKey((k) => k + 1);
              persist(s, episode);
            }}
            className="w-16 rounded border border-white/15 bg-card px-2 py-1"
          />
          <label className="text-white/60">E:</label>
          <input
            type="number"
            min={1}
            max={100}
            value={episode}
            onChange={(e) => {
              const ep = Number(e.target.value) || 1;
              setEpisode(ep);
              setKey((k) => k + 1);
              persist(season, ep);
            }}
            className="w-16 rounded border border-white/15 bg-card px-2 py-1"
          />
          <button
            onClick={() => {
              const ep = episode + 1;
              setEpisode(ep);
              setKey((k) => k + 1);
              persist(season, ep);
            }}
            className="rounded border border-accent/40 px-3 py-1 text-accent"
          >
            Next episode →
          </button>
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
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
      <p className="mt-2 text-xs text-white/40">
        If one server fails, switch servers above. multiembed.mov blocks bots (curl
        gets 403) but works in a real browser iframe — blank + working “Open in new
        tab” means an adblock/CSP issue, not a dead source. uBlock Origin recommended.
      </p>
    </div>
  );
}
