import { createAuthClient } from 'better-auth/react';
import { SIGN_IN_FAILED_PARAM } from './session';

// Loaded on demand (sign-in / sign-out) via lib/session.ts — keeps Better
// Auth's browser client off every page's first load.

/** Browser auth client — talks to /api/auth on the current origin. */
export const authClient = createAuthClient();

/**
 * One-click Google sign-in: redirects to Google and back to the page the
 * user was on. Google is the only sign-in method.
 */
export function signInWithGoogle() {
  const here = window.location.pathname + window.location.search;
  return authClient.signIn.social({
    provider: 'google',
    callbackURL: here,
    errorCallbackURL: `${window.location.pathname}?${SIGN_IN_FAILED_PARAM}=failed`,
  });
}
