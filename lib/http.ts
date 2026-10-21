import type { NextRequest } from 'next/server';

/**
 * Same-site check for state-changing requests. The session cookie is
 * SameSite=Lax; this also rejects cross-site POSTs/DELETEs outright.
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const allowed = new Set([req.nextUrl.origin]);
  if (process.env.BETTER_AUTH_URL) allowed.add(new URL(process.env.BETTER_AUTH_URL).origin);
  return allowed.has(origin);
}
