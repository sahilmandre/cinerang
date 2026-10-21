import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/auth';

// Sign-in, OAuth callback, get-session, sign-out, revoke-sessions.
export const dynamic = 'force-dynamic';

export const { GET, POST } = toNextJsHandler((request) => getAuth().handler(request));
