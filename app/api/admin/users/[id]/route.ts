import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { getAdminSession, isOwnerEmail } from '@/lib/admin';
import { findUser } from '@/lib/admin-data';
import { profiles } from '@/lib/db';
import { deleteHistory } from '@/lib/history';
import { sameOrigin } from '@/lib/http';

// POST   → block / unblock / make or remove admin / sign out everywhere
// DELETE → delete the account and everything stored for it
export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ban'), reason: z.string().trim().max(200).optional() }),
  z.object({ action: z.literal('unban') }),
  z.object({ action: z.literal('set-role'), role: z.enum(['admin', 'user']) }),
  z.object({ action: z.literal('revoke-sessions') }),
]);

async function guard(req: NextRequest, id: string) {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  const admin = await getAdminSession(req.headers);
  // Not an admin: the panel's routes don't exist.
  if (!admin) return json({ error: 'not_found' }, 404);
  const target = await findUser(id);
  if (!target) return json({ error: 'User not found.' }, 404);
  return { admin, target, protectedReason: protectedReason(admin.user.id, target) };
}

/** Accounts the panel may not block, demote or delete. */
function protectedReason(adminId: string, target: { id: string; email: string }) {
  if (target.id === adminId) return "You can't do that to your own account.";
  if (isOwnerEmail(target.email)) return 'Owners (ADMIN_EMAILS) can only be changed in the env settings.';
  return null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(req, params.id);
  if (g instanceof Response) return g;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Invalid action.' }, 400);
  const action = parsed.data;
  const destructive =
    action.action === 'ban' || (action.action === 'set-role' && action.role === 'user');
  if (destructive && g.protectedReason) return json({ error: g.protectedReason }, 400);

  const { internalAdapter } = await getAuth().$context;
  const id = g.target.id;
  switch (action.action) {
    case 'ban':
      // Blocked accounts can't sign in again (admin plugin) and lose every session now.
      await internalAdapter.updateUser(id, {
        banned: true,
        banReason: action.reason || null,
        banExpires: null,
      });
      await internalAdapter.deleteUserSessions(id);
      break;
    case 'unban':
      await internalAdapter.updateUser(id, { banned: false, banReason: null, banExpires: null });
      break;
    case 'set-role':
      await internalAdapter.updateUser(id, { role: action.role });
      break;
    case 'revoke-sessions':
      await internalAdapter.deleteUserSessions(id);
      break;
  }
  return json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(req, params.id);
  if (g instanceof Response) return g;
  if (g.protectedReason) return json({ error: g.protectedReason }, 400);
  const id = g.target.id;
  const { internalAdapter } = await getAuth().$context;
  // User, sessions and Google link (Better Auth), then CineRang's own data.
  await internalAdapter.deleteUser(id);
  await Promise.all([profiles().deleteOne({ _id: id }), deleteHistory(id)]);
  return json({ ok: true });
}
