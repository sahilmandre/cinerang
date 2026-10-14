# Cinejoy Clone (Next.js)

Streaming UI like `cinejoy.pk/watch/movie/350` — TMDB for catalog + multi-server iframe player.

## How cinejoy-style sites work
1. URL holds the **TMDB id**: `/watch/movie/350` = TMDB movie 350.
2. Metadata, posters, search, trending come from **TMDB API** (free key).
3. Video is **not hosted** — an `<iframe>` embeds a 3rd-party player (`vidsrc`, `superembed`, …) with `movie/{tmdbId}` or `tv/{tmdbId}/{s}/{e}`.
4. Multiple servers = fallbacks if one is down. Auto-next just increments episode number.
5. This repo is **SvelteKit on cinejoy, Next.js here** — same idea, Next.js is better for SEO + image optimization.

## Run
```bash
npm install
cp .env.example .env.local
# add NEXT_PUBLIC_TMDB_API_KEY from https://www.themoviedb.org/settings/api
npm run dev
```
Open http://localhost:3000

## Routes
- `/` trending / popular / top-rated / anime
- `/search?q=...`
- `/watch/movie/[tmdbId]` e.g. `/watch/movie/350`
- `/watch/tv/[tmdbId]?s=1&e=1`

## Servers
Edit `lib/servers.ts` to add/remove embed providers. Player auto-switches + reloads.

### Hindi dubbed / South movies
- Homepage has **Hindi / Bollywood** and **South Indian (Tamil + Telugu)** rows
  (TMDB `discover` with `with_original_language=hi/ta/te`, region IN).
- New **VixSrc** server (`vixsrc.to`) parses multi-audio HLS tracks, so a Hindi
  audio option appears when that copy includes it.
- New **YapGrid** server (verified HTTP 200, ad-free, 50+ UI languages, in-player
  subtitle translation) — best for Hindi-speaking viewers via Hindi subtitles.
- About the VixSrc **"REQUEST FAILED WITH STATUS CODE 404"**: that styled error is
  rendered by VixSrc's own player, which means our embed URL is correct and the page
  loaded — VixSrc simply has **no copy of that particular title**. Test VixSrc on a
  Hollywood title (e.g. `/watch/movie/550`) to confirm; per-title gaps are normal.
- Rejected candidates: **SmashyStream** (`embed.smashystream.com` times out from PK),
  **VidCore** (unreachable), **NetMirror** (no iframe player, scraper API only).
- Honest limit: no TMDB-keyed iframe API guarantees Hindi dubbing. Hollywood-centric
  providers carry Hindi audio only sporadically per title. Dedicated Hindi/South
  libraries (HydraHD, MultiMovies, Movi.pk, Einthusan per FMHY) are full sites, not
  embeddable players — link out to them rather than iframing.
- **NetMirror** (Hindi-focused) has no simple iframe player — only a scraper API
  returning direct stream JSON, which needs a backend resolver + custom player.
  Out of scope for this iframe template.

### Server notes (measured Oct 2026, Pakistan network)
- **SuperEmbed redirect is normal.** The iframe URL is `multiembed.mov/?video_id=…&tmdb=1`
  (per `superembed.stream/#install`); it then redirects to a `streamingnow.mov/?play=…`
  player link. Seeing `streamingnow.mov` after pressing ↗ Open = working as designed.
- `multiembed.mov` / `streamingnow.mov` return **403 to bots/curl** (Cloudflare) but load
  in a real browser — curl failing does NOT mean the server is dead.
- **VidSrc (vidsrc.to / vidsrc.cc) is unreachable from this network** (timeouts / HTTP 522).
  That is ISP- or origin-side, not fixable in our code — use a VPN to confirm, or just
  rely on 2Embed / VidLink / VidFast, which return HTTP 200 here.
- 3-of-6 working is normal for aggregator sites (cinejoy etc. do the same) — that is
  exactly why the player has multiple fallback servers.

## Legal
> Only embed content you have rights to distribute in your jurisdiction. Most public FMHY-listed players carry unlicensed content. Operating this publicly may violate copyright law. Template is for educational UI purposes. Metadata © TMDB.
