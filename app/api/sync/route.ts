import { NextResponse, type NextRequest } from 'next/server';
import { getAuth } from '@/lib/auth';
import { isAllowedEmail } from '@/lib/allowlist';
import { profiles, type ProfileDoc } from '@/lib/db';
import { applyBatch, emptyData, normalizeData } from '@/lib/sync/reducer';
import { parseBatch } from '@/lib/sync/schema';
import type { SyncData } from '@/lib/sync/types';

// GET  → the signed-in user's profile (304 when the device is current).
// POST → apply a batch of ops; returns the new revision.
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 256 * 1024;
const WRITE_ATTEMPTS = 4;
const NO_STORE = { 'Cache-Control': 'private, no-store' };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });

const etag = (rev: number) => `"${rev}"`;

/** User id always comes from the session, never from the request. */
async function currentUser(req: NextRequest): Promise<{ id: string } | Response> {
  const session = await getAuth().api.getSession({ headers: req.headers });
  if (!session) return json({ error: 'unauthorized' }, 401);
  // Removed from the invite list after signing in: the client signs out.
  if (!isAllowedEmail(session.user.email)) return json({ error: 'not_invited' }, 403);
  return { id: session.user.id };
}

/** The session cookie is SameSite=Lax; this also rejects cross-site POSTs. */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const allowed = new Set([req.nextUrl.origin]);
  if (process.env.BETTER_AUTH_URL) allowed.add(new URL(process.env.BETTER_AUTH_URL).origin);
  return allowed.has(origin);
}

function dataOf(doc: ProfileDoc): SyncData {
  return normalizeData({
    taste: doc.taste,
    watchlist: doc.watchlist,
    continue: doc.continue,
    prefs: doc.prefs,
  });
}

const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;

export async function GET(req: NextRequest) {
  const user = await currentUser(req);
  if (user instanceof Response) return user;
  const collection = profiles();
  // Unchanged devices only cost a primary-key lookup returning `rev`.
  const head = await collection.findOne({ _id: user.id }, { projection: { rev: 1 } });
  const rev = head?.rev ?? 0;
  if (req.headers.get('if-none-match') === etag(rev)) {
    return new Response(null, { status: 304, headers: { ...NO_STORE, ETag: etag(rev) } });
  }
  const doc = head
    ? await collection.findOne({ _id: user.id }, { projection: { appliedOps: 0 } })
    : null;
  const current = doc?.rev ?? 0;
  return json(
    { rev: current, data: doc ? dataOf(doc) : emptyData() },
    200,
    { ETag: etag(current) }
  );
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  const user = await currentUser(req);
  if (user instanceof Response) return user;

  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return json({ error: 'too_large' }, 413);
  }
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const batch = parseBatch(body);
  if (!batch) return json({ error: 'invalid_batch' }, 400);
  if (batch.rejected) {
    console.warn(`[sync] dropped ${batch.rejected} invalid op(s) for user ${user.id}`);
  }

  // Read → apply with the shared reducer → write only if nobody else wrote
  // in between (rev guard). Another device winning the race just retries.
  const collection = profiles();
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    const doc = await collection.findOne({ _id: user.id });
    const rev = doc?.rev ?? 0;
    const result = applyBatch(
      { data: doc ? dataOf(doc) : emptyData(), appliedOps: doc?.appliedOps ?? [] },
      batch.ops
    );
    // Every op was a repeat (a retried upload): nothing to write.
    if (!result) return json({ rev, rejected: batch.rejected });

    const now = new Date();
    const next = {
      ...result.data,
      appliedOps: result.appliedOps,
      rev: rev + 1,
      createdAt: doc?.createdAt ?? now,
      updatedAt: now,
    };
    if (!doc) {
      try {
        await collection.insertOne({ _id: user.id, ...next });
        return json({ rev: next.rev, rejected: batch.rejected });
      } catch (error) {
        if (isDuplicateKey(error)) continue; // first write raced another device
        throw error;
      }
    }
    const { matchedCount } = await collection.replaceOne({ _id: user.id, rev }, next);
    if (matchedCount === 1) return json({ rev: next.rev, rejected: batch.rejected });
  }
  return json({ error: 'conflict' }, 409);
}
