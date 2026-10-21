// Server only — imported by route handlers, never by components.
import { betterAuth } from 'better-auth/minimal'; // adapter-only entry: excludes Kysely
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { getMongo } from './db';
import { isAllowedEmail } from './allowlist';

/** Error code the client turns into "this account isn't invited". */
export const NOT_INVITED = 'not_invited';

function createAuth() {
  const { client, db } = getMongo();
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    // Atlas is a replica set, so passing the client enables transactions.
    database: mongodbAdapter(db, { client }),
    // Google is the only way in — no email/password. No forced account
    // chooser: a returning user with one Google account gets one-click
    // sign-in (Google still shows its picker when several are signed in).
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refreshed at most daily
      // Session checks are answered from a signed cookie: no DB read on
      // most requests, while DB sessions still allow "sign out everywhere".
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    user: {
      // Runs on sign-up and on every Google sign-in, with the fresh email.
      // Lets everyone in unless ALLOWED_EMAILS is set (lib/allowlist.ts).
      validateUserInfo: ({ user }) =>
        isAllowedEmail(user.email)
          ? undefined
          : { error: NOT_INVITED, errorDescription: 'This Google account is not invited.' },
    },
  });
}

type Auth = ReturnType<typeof createAuth>;

const cache = globalThis as typeof globalThis & { __cinerangAuth?: Auth };

/** Created on first request, so builds don't need secrets or the database. */
export function getAuth(): Auth {
  cache.__cinerangAuth ??= createAuth();
  return cache.__cinerangAuth;
}
