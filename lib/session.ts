/**
 * Tiny client-side view of the Better Auth session, shared by the navbar,
 * sync and guest hints. Reads Better Auth's own GET /api/auth/get-session
 * (answered from the signed cookie cache — normally no DB call).
 *
 * The full Better Auth client (~13 KB gzip) is only needed to sign in or
 * out, so it is loaded on demand instead of on every page.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { KEYS } from './sync/local';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  /** "admin" for admin-panel users (Better Auth admin plugin). */
  role?: string | null;
}

export interface SessionState {
  /** `error`: the session couldn't be checked (offline, server down). */
  status: 'loading' | 'signed-in' | 'signed-out' | 'error';
  user: SessionUser | null;
}

/** Marks the return URL of a failed sign-in; Better Auth appends `error`. */
export const SIGN_IN_FAILED_PARAM = 'signin';

const LOADING: SessionState = { status: 'loading', user: null };
let state: SessionState = LOADING;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** Re-checks the session (after a 401, or a sign-in/out in another tab). */
export function refreshSession(): Promise<void> {
  inflight ??= fetch('/api/auth/get-session', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { user?: SessionUser } | null;
      set(body?.user ? { status: 'signed-in', user: body.user } : { status: 'signed-out', user: null });
    })
    // A failed check never signs anyone out; a known user stays signed in.
    .catch(() => set(state.user ? state : { status: 'error', user: null }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Another tab signed in or out (the sync owner changed): re-check here too. */
function onStorage(e: StorageEvent) {
  if (e.key !== KEYS.sync && e.key !== null) return;
  const owner = (raw: string | null) => {
    try {
      return (JSON.parse(raw ?? 'null') as { ownerId?: string } | null)?.ownerId ?? null;
    } catch {
      return null;
    }
  };
  if (owner(e.oldValue) !== owner(e.newValue)) void refreshSession();
}

export function useSession(): SessionState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => LOADING);
  useEffect(() => {
    if (state.status === 'loading') void refreshSession();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return snapshot;
}

export const loadAuthClient = () => import('./auth-client');

/** Warm the Better Auth client before a click (hover/focus on Sign in). */
export function prefetchAuthClient() {
  void loadAuthClient();
}

/** One-click Google sign-in through Better Auth. */
export async function signInWithGoogle() {
  const { signInWithGoogle: signIn } = await loadAuthClient();
  return signIn();
}
