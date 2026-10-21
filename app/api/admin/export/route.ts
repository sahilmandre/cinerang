import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAdminSession } from '@/lib/admin';
import { profiles } from '@/lib/db';
import { activity, watchHistory } from '@/lib/history';

// GET /api/admin/export?data=history|activity|taste[&user=<id>]
// JSON Lines (one record per line) — the training-data format most
// recommendation / LLM tooling reads directly. Users appear by id only,
// never by email.
export const dynamic = 'force-dynamic';

const DATASETS = ['history', 'activity', 'taste'] as const;
type Dataset = (typeof DATASETS)[number];

function cursorFor(data: Dataset, user: string | null) {
  switch (data) {
    case 'history':
      return watchHistory()
        .find(user ? { userId: user } : {}, { projection: { _id: 0 } })
        .sort({ lastAt: 1 });
    case 'activity':
      return activity()
        .find(user ? { userId: user } : {}, { projection: { _id: 0 } })
        .sort({ at: 1 });
    case 'taste':
      return profiles().find(user ? { _id: user } : {}, {
        projection: { taste: 1, watchlist: 1, updatedAt: 1 },
      });
  }
}

/** Taste rows: renames `_id` and keeps only watchlist ids. */
function shape(data: Dataset, doc: Record<string, any>) {
  if (data !== 'taste') return doc;
  return {
    userId: doc._id,
    taste: doc.taste,
    watchlist: (doc.watchlist ?? []).map((x: any) => ({ mediaType: x.mediaType, tmdbId: x.id })),
    updatedAt: doc.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  if (!(await getAdminSession(req.headers))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const data = req.nextUrl.searchParams.get('data') as Dataset;
  if (!DATASETS.includes(data)) {
    return NextResponse.json({ error: 'data must be history, activity or taste' }, { status: 400 });
  }
  const user = req.nextUrl.searchParams.get('user');
  if (user && !ObjectId.isValid(user)) {
    return NextResponse.json({ error: 'invalid user id' }, { status: 400 });
  }

  const cursor = cursorFor(data, user);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const doc = await cursor.next();
      if (!doc) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(`${JSON.stringify(shape(data, doc))}\n`));
    },
    async cancel() {
      await cursor.close();
    },
  });
  const day = new Date().toISOString().slice(0, 10);
  const scope = user ? `-${user}` : '';
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Content-Disposition': `attachment; filename="cinerang-${data}${scope}-${day}.jsonl"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
