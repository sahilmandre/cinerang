import { getMongo } from '@/lib/db';

// Daily Vercel cron (vercel.json). Atlas M0 pauses a cluster only after 60
// days with zero connections; one ping a day means that never happens.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  await getMongo().db.command({ ping: 1 });
  return Response.json({ ok: true });
}
