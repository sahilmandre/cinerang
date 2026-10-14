// How cinejoy-style sites work: they do NOT host video.
// They show TMDB metadata + embed a 3rd-party player in an <iframe>
// using the TMDB id (+ season/episode for TV).
//
// LEGAL WARNING: Most public embed providers listed in FMHY stream
// copyrighted content without a license. Self-hosting / publicly
// operating such a site can violate copyright law in your country,
// plus TMDB ToS and the embed providers' ToS. Only embed content you
// have rights to, or use licensed / public-domain sources.
// This template defaults to providers being user-configurable —
// you are responsible for what you enable.

export type MediaType = 'movie' | 'tv';

export interface VideoServer {
  id: string;
  name: string;
  /** Full-catalog embeds that also resolve explicit/adult TMDB ids. */
  adultOk?: boolean;
  movieUrl: (tmdbId: string) => string;
  tvUrl: (tmdbId: string, season: number, episode: number) => string;
}

export const SERVERS: VideoServer[] = [
  {
    id: '2embed',
    name: '2Embed',
    movieUrl: (id) => `https://www.2embed.cc/embed/${id}`,
    tvUrl: (id, s, e) => `https://www.2embed.cc/embedtv/${id}?s=${s}&e=${e}`,
  },
  {
    id: 'vidlink',
    name: 'VidLink',
    movieUrl: (id) => `https://vidlink.pro/movie/${id}`,
    tvUrl: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidfast',
    name: 'VidFast',
    movieUrl: (id) => `https://vidfast.pro/movie/${id}`,
    tvUrl: (id, s, e) => `https://vidfast.pro/tv/${id}/${s}/${e}`,
  },
  {
    // Per https://superembed.stream/#install — player domain is
    // multiembed.mov, NOT superembed.stream (that's just the landing page).
    // Simple way: paste this URL into an iframe, keep &tmdb=1 for TMDB ids.
    id: 'superembed',
    name: 'SuperEmbed',
    movieUrl: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tvUrl: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  },
  {
    // VIP player: single popup, multi-quality HLS + subtitles.
    // Falls back to normal player if VIP has no copy (&check=1 returns 0/1).
    id: 'superembed-vip',
    name: 'SuperEmbed VIP',
    movieUrl: (id) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`,
    tvUrl: (id, s, e) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  },
  {
    // Docs: screenscape.me/embed — multi-server failover, multi-language
    // audio. lan=hindi prefers Hindi audio (also their default when available).
    // Verified Oct 2026: HTTP 200 for movie + TV embeds from PK+VPN.
    id: 'screenscape',
    name: 'Screenscape',
    movieUrl: (id) => `https://nxsha.screenscape.me/embed?tmdb=${id}&type=movie&lan=hindi`,
    tvUrl: (id, s, e) => `https://nxsha.screenscape.me/embed?tmdb=${id}&type=tv&s=${s}&e=${e}&lan=hindi`,
  },
  {
    // Verified Oct 2026: HTTP 200 from PK, no bot challenge, documented at
    // github.com/enikqi/yapgrid. Ad-free, 50+ UI languages, in-player
    // subtitle translation — best pick for Hindi-speaking viewers
    // (Hindi subtitles/UI, not dubbed audio).
    id: 'yapgrid',
    name: 'YapGrid',
    movieUrl: (id) => `https://yapgrid.com/embed/movie/${id}`,
    tvUrl: (id, s, e) => `https://yapgrid.com/embed/tv/${id}/${s}/${e}`,
  },
  {
    // Parses multi-audio HLS tracks — Hindi audio shows up here when the
    // copy has it. Reachable from PK (HTTP 403 challenge to bots, like
    // SuperEmbed) but vidsrc.to times out entirely.
    id: 'vixsrc',
    name: 'VixSrc',
    movieUrl: (id) => `https://vixsrc.to/movie/${id}`,
    tvUrl: (id, s, e) => `https://vixsrc.to/tv/${id}/${s}/${e}`,
  },
  {
    // Canonical format per docs is vidsrc.to/embed/...
    // vidsrc.xyz is dead. Often ISP/DNS-blocked in PK — use VPN if blank.
    id: 'vidsrc',
    name: 'VidSrc',
    movieUrl: (id) => `https://vidsrc.to/embed/movie/${id}`,
    tvUrl: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
  {
    // V2 embed, same TMDB-id model with a wide catalog including
    // adult titles. Verified Oct 2026 via DNS-over-HTTPS: resolves
    // (Cloudflare). Default player for 18+ titles.
    // NOTE: embed.su was removed — its domain is parked (no DNS
    // records) as of Oct 2026. Re-add if it returns.
    id: 'vidsrc-cc',
    name: 'VidSrc.cc',
    adultOk: true,
    movieUrl: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`,
    tvUrl: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
  },
];

/** Default player for 18+ titles (full-catalog, adult-resolving). */
export const ADULT_DEFAULT_SERVER = 'vidsrc-cc';

/** Button order: adult-resolving servers first for 18+ titles. */
export function orderedServers(adult = false): VideoServer[] {
  if (!adult) return SERVERS;
  return [...SERVERS].sort((a, b) => Number(b.adultOk ?? false) - Number(a.adultOk ?? false));
}

export function getEmbedUrl(
  serverId: string,
  type: MediaType,
  tmdbId: string,
  season = 1,
  episode = 1
): string {
  const s = SERVERS.find((x) => x.id === serverId) ?? SERVERS[0];
  return type === 'movie' ? s.movieUrl(tmdbId) : s.tvUrl(tmdbId, season, episode);
}
