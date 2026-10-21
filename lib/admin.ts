// Server only. Who may use the admin panel, and the guards for its pages
// and API routes.
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getAuth } from './auth';
import { isOwnerEmail } from './allowlist';

export { isOwnerEmail };

export function isAdminUser(user: {
  email?: string | null;
  role?: string | null;
  banned?: boolean | null;
}): boolean {
  if (user.banned) return false;
  return isOwnerEmail(user.email) || user.role === 'admin';
}

/**
 * The signed-in admin, or null. Reads the session from the database rather
 * than the 5-minute cookie cache, so a removed admin loses access at once.
 */
export async function getAdminSession(requestHeaders: Headers) {
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  });
  return session && isAdminUser(session.user) ? session : null;
}

/** Admin pages: everyone else gets a plain 404 — the panel isn't advertised. */
export async function requireAdmin() {
  const session = await getAdminSession(headers());
  if (!session) notFound();
  return session;
}
