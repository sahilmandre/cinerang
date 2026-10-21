import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireAdmin, isOwnerEmail } from '@/lib/admin';
import { listUsers } from '@/lib/admin-data';
import { Avatar, EmptyState, TableShell, UserBadges, When, th, td } from '@/components/admin/ui';
import { cn } from '@/lib/utils';

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  await requireAdmin();
  const q = (searchParams.q ?? '').slice(0, 100);
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1);
  const { rows, count, pages } = await listUsers({ q, page });
  const pageHref = (p: number) =>
    `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="pb-6">
      <form role="search" action="/admin/users" className="mt-6 flex flex-wrap items-center gap-3 px-1">
        <label className="relative min-w-[16rem] flex-1 sm:max-w-sm">
          <span className="sr-only">Search accounts by name or email</span>
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name or email"
            className="h-10 w-full rounded-full border border-white/10 bg-black/40 pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-white/50 focus:border-accent/60"
          />
        </label>
        <button
          type="submit"
          className="h-10 rounded-full border border-white/15 px-4 text-sm font-semibold text-white/85 transition-colors hover:border-accent/50 hover:text-white"
        >
          Search
        </button>
        <p className="ml-auto text-sm text-white/60">
          {count.toLocaleString('en')} {count === 1 ? 'account' : 'accounts'}
          {q ? ` matching “${q}”` : ''}
        </p>
      </form>

      <div className="mt-4">
        {rows.length ? (
          <TableShell label="Accounts">
            <thead>
              <tr>
                <th scope="col" className={th}>Account</th>
                <th scope="col" className={th}>Joined</th>
                <th scope="col" className={th}>Last watched</th>
                <th scope="col" className={`${th} text-right`}>Watched</th>
                <th scope="col" className={`${th} text-right`}>Likes</th>
                <th scope="col" className={`${th} text-right`}>Watchlist</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className={td}>
                    <Link href={`/admin/users/${u.id}`} className="group flex items-center gap-3">
                      <Avatar name={u.name || u.email} image={u.image} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium group-hover:text-accent">
                            {u.name || 'No name'}
                          </span>
                          <UserBadges owner={isOwnerEmail(u.email)} role={u.role} banned={u.banned} />
                        </span>
                        <span className="block truncate text-xs text-white/55">{u.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={`${td} text-white/70`}><When date={u.createdAt} /></td>
                  <td className={`${td} text-white/70`}><When date={u.lastWatchedAt} /></td>
                  <td className={`${td} text-right tabular-nums`}>{u.watched}</td>
                  <td className={`${td} text-right tabular-nums`}>{u.likes}</td>
                  <td className={`${td} text-right tabular-nums`}>{u.watchlist}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState>
            {q
              ? `No account matches “${q}”. Search looks at names and emails.`
              : 'No accounts yet. People appear here after their first Google sign-in.'}
          </EmptyState>
        )}
      </div>

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between px-1 text-sm">
          <PageLink href={pageHref(page - 1)} disabled={page <= 1}>← Newer</PageLink>
          <span className="text-white/60">Page {page} of {pages}</span>
          <PageLink href={pageHref(page + 1)} disabled={page >= pages}>Older →</PageLink>
        </nav>
      ) : null}
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const cls = 'rounded-full border px-3.5 py-1.5 font-semibold transition-colors';
  if (disabled) {
    return (
      <span aria-disabled className={cn(cls, 'border-white/[0.06] text-white/35')}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={cn(cls, 'border-white/15 text-white/85 hover:border-accent/50 hover:text-white')}>
      {children}
    </Link>
  );
}
