import { NextResponse } from 'next/server';

// Proxy for VidVault's download-link API + file bytes.
//
// Why a full proxy (not a 302 redirect): the file host
// (cvt.*.workers.dev) enforces hotlink protection — it only serves the
// .mkv when Referer is the vidvault.to page. Verified Oct 2026 on
// movie 1218637: vidvault referer -> 206, localhost/no referer -> 403.
// A redirect leaks our origin as Referer, so the browser gets Forbidden.
// Streaming the bytes server-side with the correct Referer fixes it.
//
// Verified Oct 2026:
//   page:    https://vidvault.to/movie/{tmdbId}
//           https://vidvault.to/tv/{tmdbId}/{season}/{episode}
//   api:     /download-link/movie/{id}/{quality}
//           /download-link/tv/{id}/{s}/{e}/{quality}
//   file:    200/206 video/x-matroska + Content-Disposition: attachment
//   missing conversion -> upstream 404
//
// NOTE: proxied downloads use this server's bandwidth. Fine for
// self-hosting; for public traffic put it behind auth/rate-limits.

const VV = 'https://vidvault.to';
const QUALS = ['360p', '480p', '720p', '1080p'];

function pageUrl(type: string, id: string, s?: string, e?: string) {
  return type === 'tv' && s && e ? `${VV}/tv/${id}/${s}/${e}` : `${VV}/movie/${id}`;
}

function apiUrl(type: string, id: string, s: string | null, e: string | null, q: string) {
  return type === 'tv' && s && e
    ? `${VV}/download-link/tv/${id}/${s}/${e}/${q}`
    : `${VV}/download-link/movie/${id}/${q}`;
}

async function fetchLink(type: string, id: string, s: string | null, e: string | null, q: string) {
  const res = await fetch(apiUrl(type, id, s, e, q), {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Referer: pageUrl(type, id, s ?? undefined, e ?? undefined),
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return typeof data?.url === 'string' ? (data.url as string) : null;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const type = u.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
  const id = (u.searchParams.get('id') ?? '').trim();
  const s = u.searchParams.get('s');
  const e = u.searchParams.get('e');
  const quality = u.searchParams.get('quality');
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  // Single quality -> mint fresh signed URL, then stream the file
  // through us with the vidvault Referer (hotlink protection).
  // Range is passed through so pause/resume + download managers work.
  if (quality) {
    const url = await fetchLink(type, id, s, e, quality).catch(() => null);
    if (!url) return NextResponse.json({ error: 'not converted yet' }, { status: 404 });
    const referer = pageUrl(type, id, s ?? undefined, e ?? undefined);
    const range = req.headers.get('range');
    const up = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: referer,
        ...(range ? { Range: range } : {}),
      },
      signal: AbortSignal.timeout(30000),
      cache: 'no-store',
    }).catch(() => null);
    if (!up || !up.ok || !up.body)
      return NextResponse.json({ error: 'file fetch failed' }, { status: 502 });
    const title = (u.searchParams.get('title') ?? '').trim().slice(0, 80) || `vidvault-${id}`;
    const safe = `${title.replace(/[^\w\- ]+/g, '').trim() || `vidvault-${id}`} [${quality}].mkv`;
    const out = new Headers();
    out.set('Content-Type', up.headers.get('Content-Type') ?? 'video/x-matroska');
    out.set('Content-Disposition', `attachment; filename="${safe}"`);
    out.set('Accept-Ranges', 'bytes');
    for (const h of ['Content-Length', 'Content-Range']) {
      const v = up.headers.get(h);
      if (v) out.set(h, v);
    }
    out.set('Cache-Control', 'no-store');
    return new Response(up.body, { status: up.status, headers: out });
  }

  // List mode -> which qualities are already converted.
  const settled = await Promise.allSettled(QUALS.map((q) => fetchLink(type, id, s, e, q)));
  const available = QUALS.filter((_, i) => settled[i].status === 'fulfilled' && settled[i].value);
  return NextResponse.json(
    { available, page: pageUrl(type, id, s ?? undefined, e ?? undefined) },
    { headers: { 'Cache-Control': 'public, max-age=120' } }
  );
}
