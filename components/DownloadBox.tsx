'use client';
import { useEffect, useState } from 'react';
import { Download, ExternalLink, Magnet } from 'lucide-react';
import { ddlLinks, torrentLinks, streamDownloadLinks, fetchYtsTorrents, fetchVidVaultAvailability, vidvaultFileUrl, vidvaultPage, type YtsTorrent } from '@/lib/downloads';
import { cn } from '@/lib/utils';

export default function DownloadBox({
  title,
  year,
  type,
  tmdbId,
  imdbId,
  season = 1,
  episode = 1,
}: {
  title: string;
  year?: string;
  type: 'movie' | 'tv';
  tmdbId: string;
  imdbId?: string | null;
  season?: number;
  episode?: number;
}) {
  const ctx = { title, year, type, season, episode, imdbId };
  const [tab, setTab] = useState<'quick' | 'ddl' | 'torrent' | 'hls'>('quick');
  const [yts, setYts] = useState<YtsTorrent[] | null>(null);
  const [ytsError, setYtsError] = useState(false);
  const [vv, setVv] = useState<string[] | null>(null);

  // VidVault: TMDB-keyed direct MKV. Probe which qualities are converted.
  useEffect(() => {
    let live = true;
    fetchVidVaultAvailability(ctx, tmdbId)
      .then((r) => {
        if (live) setVv(r.available);
      })
      .catch(() => {
        if (live) setVv([]);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbId, type, season, episode]);

  // Movies: live YTS lookup by IMDb id (falls back to title). TV has no
  // YTS catalog, so the quick tab shows DDL shortcuts instead.
  useEffect(() => {
    if (type !== 'movie') return;
    const key = imdbId || (title && year ? `${title} ${year}` : title);
    if (!key) {
      setYtsError(true);
      return;
    }
    let live = true;
    fetchYtsTorrents(key)
      .then((t) => {
        if (live) setYts(t.length ? t : []);
      })
      .catch(() => {
        if (live) setYtsError(true);
      });
    return () => {
      live = false;
    };
  }, [type, imdbId, title, year]);

  const ddls = ddlLinks(ctx);
  const torrents = torrentLinks(ctx);
  const streams = streamDownloadLinks(ctx, tmdbId);

  const tabs = [
    { id: 'quick', label: type === 'movie' ? 'Quick download' : 'Download' },
    { id: 'ddl', label: 'DDL sites' },
    { id: 'torrent', label: 'Torrents' },
    { id: 'hls', label: 'Stream rip' },
  ] as const;

  return (
    <section aria-label="Download options" className="mt-4 rounded-2xl border border-white/[0.07] bg-card/60 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-white/50">
          <Download size={13} aria-hidden /> Download
        </h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/40">
          separate sources — embeds are stream-only
        </span>
      </div>

      <div role="tablist" aria-label="Download methods" className="mt-3 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition',
              tab === t.id
                ? 'bg-accent font-bold text-black shadow-lg shadow-accent/30'
                : 'border border-white/10 bg-white/[0.03] text-white/70 hover:border-accent/40 hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'quick' && (
        <div className="mt-3">
          {/* VidVault: true 1-click MKV, TMDB-keyed like the stream embeds */}
          <div className="rounded-xl border border-accent/25 bg-accent/[0.06] p-3">
            <p className="text-sm font-bold text-white">
              Direct MKV <span className="ml-1 rounded bg-emerald-500/20 px-1.5 py-px text-[10px] font-extrabold text-emerald-300">1-click</span>
              <span className="ml-1.5 text-xs font-medium text-white/45">via VidVault</span>
            </p>
            {vv === null ? (
              <p className="mt-1.5 text-sm text-white/50">Checking converted qualities…</p>
            ) : vv.length ? (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  {vv.map((q) => (
                    <a
                      key={q}
                      href={vidvaultFileUrl(ctx, tmdbId, q)}
                      className="inline-flex items-center gap-1 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-bold text-black transition hover:brightness-110"
                    >
                      <Download size={13} aria-hidden /> {q} .mkv
                    </a>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/35">
                  Button not starting?{' '}
                  <a
                    href={vidvaultPage(ctx, tmdbId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                  >
                    Open VidVault page <ExternalLink size={11} aria-hidden />
                  </a>{' '}
                  and download from there instead.
                </p>
              </>
            ) : (
              <div className="mt-1.5 text-[13px] leading-relaxed text-white/60">
                <p>Not converted yet for this {type === 'movie' ? 'movie' : 'episode'}. Open VidVault once to queue the conversion (takes seconds), then come back:</p>
                <a
                  href={vidvaultPage(ctx, tmdbId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 rounded-full border border-accent/40 px-3.5 py-1.5 text-[13px] font-semibold text-accent transition hover:bg-accent/10"
                >
                  Open VidVault page <ExternalLink size={12} aria-hidden />
                </a>
              </div>
            )}
          </div>

          <div className="mt-3">
          {type === 'movie' ? (
            yts === null && !ytsError ? (
              <p className="text-sm text-white/50">Checking YTS for direct torrents…</p>
            ) : yts?.length ? (
              <ul className="grid gap-2">
                {yts.map((t) => (
                  <li
                    key={`${t.quality}-${t.type}`}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-black/30 p-2.5 text-sm"
                  >
                    <span className="rounded-md bg-accent/15 px-2 py-0.5 font-bold tabular-nums text-accent">
                      {t.quality} {t.type}
                    </span>
                    <span className="text-xs tabular-nums text-white/50">{t.size}</span>
                    <span className="ml-auto flex gap-2">
                      <a
                        href={t.url}
                        className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-bold text-black transition hover:brightness-110"
                      >
                        <Download size={12} aria-hidden /> .torrent
                      </a>
                      <a
                        href={t.magnet}
                        className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/80 transition hover:border-accent/50 hover:text-white"
                      >
                        <Magnet size={12} aria-hidden /> Magnet
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm leading-relaxed text-white/60">
                <p>No YTS copy found{imdbId ? '' : ' (no IMDb id — title search only)'}. Use DDL/torrent tabs:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ddls.slice(0, 3).map((d) => (
                    <ExtBtn key={d.name} name={d.name} url={d.url} />
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="text-sm leading-relaxed text-white/60">
              <p>
                TV has no single direct-torrent API. Search DDL for S{String(season).padStart(2, '0')}E
                {String(episode).padStart(2, '0')}:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ddls.slice(0, 4).map((d) => (
                  <ExtBtn key={d.name} name={d.name} url={d.url} />
                ))}
              </div>
            </div>
          )}
          <p className="mt-2 text-xs leading-relaxed text-white/35">
            Needs a torrent client (qBittorrent) or Debrid (TorBox / Real-Debrid). Use a VPN before torrenting.
          </p>
          </div>
        </div>
      )}

      {tab === 'ddl' && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {ddls.map((d) => (
            <li key={d.name} className="rounded-xl border border-white/[0.07] bg-black/30 p-2.5 text-sm">
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-white hover:text-accent">
                {d.name} <ExternalLink size={12} aria-hidden />
              </a>
              <p className="mt-0.5 text-xs text-white/50">{d.note} — pre-searched for this title.</p>
            </li>
          ))}
        </ul>
      )}

      {tab === 'torrent' && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {torrents.map((d) => (
            <li key={d.name} className="rounded-xl border border-white/[0.07] bg-black/30 p-2.5 text-sm">
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-white hover:text-accent">
                {d.name} <ExternalLink size={12} aria-hidden />
              </a>
              <p className="mt-0.5 text-xs text-white/50">{d.note}.</p>
            </li>
          ))}
        </ul>
      )}

      {tab === 'hls' && (
        <div className="mt-3 text-sm leading-relaxed text-white/60">
          <p>Rip the current stream server copy (advanced):</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[13px]">
            <li>
              Open the embed URL in a new tab, play the video, then copy the <code className="text-white/80">.m3u8</code>{' '}
              URL from DevTools → Network (filter “m3u8”).
            </li>
            <li>
              Download with{' '}
              <a href="https://github.com/nilaoda/N_m3u8DL-RE" target="_blank" rel="noopener noreferrer" className="font-bold text-accent hover:underline">
                N_m3u8DL-RE
              </a>{' '}
              or the{' '}
              <a href="https://mov-cli.github.io/" target="_blank" rel="noopener noreferrer" className="font-bold text-accent hover:underline">
                mov-cli
              </a>{' '}
              /{' '}
              <a href="https://playtorrio.xyz/" target="_blank" rel="noopener noreferrer" className="font-bold text-accent hover:underline">
                PlayTorrio
              </a>{' '}
              downloader.
            </li>
            <li>Or try a server FMHY flags as saveable:</li>
          </ol>
          <div className="mt-2 flex flex-wrap gap-2">
            {streams.map((d) => (
              <ExtBtn key={d.name} name={d.name} url={d.url} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ExtBtn({ name, url }: { name: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[13px] text-white/70 transition hover:border-accent/40 hover:text-white"
    >
      {name} <ExternalLink size={12} aria-hidden />
    </a>
  );
}
