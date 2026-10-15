// Download sources, curated from https://fmhy.net/video#download-sites
//
// KEY POINT: the embeds in lib/servers.ts are STREAM-ONLY (cross-origin
// iframes serving HLS/blob segments). They expose no downloadable file,
// so a <a download> button pointed at them cannot work — browsers block
// cross-origin downloads and the video data is segmented + often DRM'd.
//
// Real downloads need SEPARATE sources:
//   1. DDL (direct-download) sites — VegaMovies, Pahe, DDLBase, etc.
//      These are title-search sites, NOT TMDB-id-keyed like embeds,
//      so we deep-link a pre-filled search for "<title> <year>".
//   2. Torrents — YTS (IMDb-keyed API, true 1-click magnet/.torrent),
//      1337x / EZTV search links for everything else.
//   3. HLS ripping (advanced) — N_m3u8DL-RE / mov-cli / PlayTorrio.
//
// This module builds those external links. Nothing is hosted or proxied
// by us — same legal model as the streaming embeds.

export interface DownloadContext {
  title: string;
  year?: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  imdbId?: string | null;
}

export interface DownloadLink {
  name: string;
  url: string;
  note: string;
  quality?: string;
}

const q = (s: string) => encodeURIComponent(s);

function baseQuery(ctx: DownloadContext): string {
  return [ctx.title, ctx.year].filter(Boolean).join(' ').trim();
}

function tvQuery(ctx: DownloadContext): string {
  const base = baseQuery(ctx);
  if (ctx.type !== 'tv') return base;
  const se =
    ctx.season && ctx.episode
      ? ` S${String(ctx.season).padStart(2, '0')}E${String(ctx.episode).padStart(2, '0')}`
      : '';
  return `${base}${se}`.trim();
}

/** DDL search links (FMHY video#download-sites). Title-search based. */
export function ddlLinks(ctx: DownloadContext): DownloadLink[] {
  const query = tvQuery(ctx);
  return [
    {
      name: 'Pahe',
      url: `https://pahe.ink/?s=${q(query)}`,
      note: 'Movies / TV / 4K — main DDL pick',
    },
    {
      name: 'VegaMovies',
      url: `https://1vegamovies.baby/?s=${q(query)}`,
      note: 'Movies / TV / Anime / 4K',
    },
    {
      name: 'DDLBase',
      url: `https://ddlbase.com/?s=${q(query)}`,
      note: 'Movies / TV / 4K / Remuxes',
    },
    {
      name: 'MovieParadise',
      url: `https://movieparadise.org/?s=${q(query)}`,
      note: 'Movies / TV',
    },
    {
      name: 'MultiShows',
      url: `https://multishows.top/?s=${q(query)}`,
      note: 'Red download button below video',
    },
    {
      name: 'OlaMovies',
      url: `https://olamovies.dad/?s=${q(query)}`,
      note: '4K — needs Google login',
    },
    {
      name: 'FMHY Download CSE',
      url: `https://cse.google.com/cse?cx=006516753008110874046:wevn3lkn9rr&q=${q(query)}`,
      note: 'Multi-site DDL search',
    },
  ];
}

/** Torrent search links. YTS magnets are resolved live via its API instead. */
export function torrentLinks(ctx: DownloadContext): DownloadLink[] {
  const query = tvQuery(ctx);
  const imdb = ctx.imdbId;
  return [
    {
      name: 'YTS',
      url: imdb
        ? `https://yts.lt/movie/${q(imdb)}`
        : `https://yts.lt/browse-movies/${q(query)}/All/All/0/latest/0/All`,
      note: ctx.type === 'movie' ? 'Direct .torrent per quality' : 'Movies only — use 1337x for TV',
    },
    {
      name: '1337x',
      url: `https://1337x.to/search/${q(query)}/1/`,
      note: 'Movies / TV / Anime',
    },
    {
      name: 'EZTV',
      url: `https://eztvx.to/search/${q(query)}`,
      note: 'TV shows',
    },
    {
      name: 'Nyaa',
      url: `https://nyaa.si/?q=${q(query)}`,
      note: 'Anime',
    },
    {
      name: 'RuTracker',
      url: `https://rutracker.org/forum/index.php?c=2&q=${q(query)}`,
      note: 'Movies / TV — needs signup',
    },
  ];
}

/** Stream-server pages that FMHY notes as downloadable (right-click / button). */
export function streamDownloadLinks(ctx: DownloadContext, tmdbId: string): DownloadLink[] {
  const s = ctx.season ?? 1;
  const e = ctx.episode ?? 1;
  const tvPath = ctx.type === 'tv' ? ` (S${s}E${e} — pick episode on site)` : '';
  return [
    {
      name: 'Levidia',
      url: `https://www.levidia.ch/search?q=${q(baseQuery(ctx))}`,
      note: `Right-click video → Save${tvPath}`,
    },
    {
      name: 'downloads-anymovies',
      url: `https://www.downloads-anymovies.co/?s=${q(baseQuery(ctx))}`,
      note: `Right-click → Save${tvPath}`,
    },
    {
      name: 'ShowBox file page',
      url: `https://www.showbox.media/search?q=${q(baseQuery(ctx))}`,
      note: 'Has file-download option',
    },
  ];
}

// --- VidVault: TMDB-keyed DIRECT download server (verified Oct 2026) ---
//
// Unlike every FMHY download-site (title-search DDL needing scrapers),
// VidVault works exactly like the streaming embeds: URL-keyed by TMDB id.
//   page: https://vidvault.to/movie/{tmdbId}
//         https://vidvault.to/tv/{tmdbId}/{season}/{episode}
//   api:  /download-link/.../{quality} -> { url: "<signed .mkv>" }
// File HEAD: 200 video/x-matroska + Content-Disposition: attachment.
// Missing conversion -> upstream 404 (probe via /api/vidvault list mode,
// since browsers can't call vidvault.to directly due to CORS).

export const VIDVAULT_QUALS = ['360p', '480p', '720p', '1080p'];

export function vidvaultPage(ctx: DownloadContext, tmdbId: string): string {
  return ctx.type === 'tv'
    ? `https://vidvault.to/tv/${tmdbId}/${ctx.season ?? 1}/${ctx.episode ?? 1}`
    : `https://vidvault.to/movie/${tmdbId}`;
}

function vidvaultParams(ctx: DownloadContext, tmdbId: string): string {
  const p = new URLSearchParams({ type: ctx.type, id: tmdbId });
  if (ctx.type === 'tv') {
    p.set('s', String(ctx.season ?? 1));
    p.set('e', String(ctx.episode ?? 1));
  }
  return p.toString();
}

/** Which VidVault qualities are already converted (via our proxy). */
export async function fetchVidVaultAvailability(
  ctx: DownloadContext,
  tmdbId: string
): Promise<{ available: string[]; page: string }> {
  const res = await fetch(`/api/vidvault?${vidvaultParams(ctx, tmdbId)}`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`VidVault ${res.status}`);
  return res.json();
}

/** Direct-download URL for one quality (proxied + streamed, fresh signed URL). */
export function vidvaultFileUrl(ctx: DownloadContext, tmdbId: string, quality: string): string {
  const p = new URLSearchParams(vidvaultParams(ctx, tmdbId));
  p.set('quality', quality);
  if (ctx.title) p.set('title', filenameBase(ctx));
  return `/api/vidvault?${p.toString()}`;
}

function filenameBase(ctx: DownloadContext): string {
  const base = [ctx.title, ctx.year].filter(Boolean).join(' ');
  if (ctx.type !== 'tv') return base;
  return `${base} S${String(ctx.season ?? 1).padStart(2, '0')}E${String(ctx.episode ?? 1).padStart(2, '0')}`;
}

export interface YtsTorrent {
  quality: string;
  type: string;
  size: string;
  url: string; // .torrent file
  magnet: string;
}

// --- YTS API (IMDb-keyed torrent download, no separate server needed) ---

export async function fetchYtsTorrents(imdbOrTitle: string): Promise<YtsTorrent[]> {
  // Public YTS API: query_term accepts an IMDb id (tt1234567) or a title.
  // Try mirrors in order — yts.mx/am are DNS-blocked or reset on some
  // networks (verified Oct 2026: mx DNS fail, am conn reset, lt HTTP 200).
  const mirrors = ['https://yts.lt', 'https://yts.mx', 'https://yts.am'];
  let lastErr: unknown = null;
  for (const m of mirrors) {
    try {
      const res = await fetch(
        `${m}/api/v2/list_movies.json?query_term=${q(imdbOrTitle)}&limit=3&sort_by=like_count&order_by=desc`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) throw new Error(`YTS ${res.status}`);
      const json = await res.json();
      const movie = json?.data?.movies?.[0];
      if (!movie) return [];
      const torrents: any[] = movie?.torrents ?? [];
      return torrents.map((t: any) => ({
        quality: t.quality,
        type: t.type,
        size: t.size,
        url: t.url,
        magnet: `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(movie.title_long ?? movie.title ?? 'movie')}&tr=udp://open.demonii.com:1337/announce&tr=udp://tracker.openbittorrent.com:80&tr=udp://tracker.coppersurfer.tk:6969`,
      }));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('YTS unreachable');
}
