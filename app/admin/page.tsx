import Link from 'next/link';
import Image from 'next/image';
import { Download } from 'lucide-react';
import { requireAdmin } from '@/lib/admin';
import { overview } from '@/lib/admin-data';
import { poster } from '@/lib/tmdb-image';
import { formatTime } from '@/lib/playback';
import { SERVERS } from '@/lib/servers';
import { EmptyState, Section, StatStrip, TableShell, When, th, td } from '@/components/admin/ui';

const serverName = (id?: string) => SERVERS.find((s) => s.id === id)?.name ?? id ?? '—';
const episodeLabel = (s: number | null, e: number | null) => (s == null ? 'Movie' : `S${s} · E${e}`);

const EXPORTS = [
  {
    data: 'history',
    label: 'Watch history',
    detail: 'One line per account × title × episode: furthest point, length, finished, first and last watched.',
  },
  {
    data: 'activity',
    label: 'Taste activity',
    detail: 'Every like, unlike, dislike and watchlist change, with its time.',
  },
  {
    data: 'taste',
    label: 'Taste profiles',
    detail: 'Each account’s current genre and language scores, likes, dislikes and watchlist.',
  },
];

export default async function AdminOverview() {
  await requireAdmin();
  const o = await overview();
  const maxViewers = Math.max(1, ...o.top.map((t) => t.viewers));

  return (
    <div className="pb-6">
      <Section title="People">
        <StatStrip
          stats={[
            { label: 'Accounts', value: o.total },
            { label: 'New this week', value: o.newThisWeek },
            { label: 'Watched this week', value: o.activeThisWeek, hint: 'accounts with viewing in 7 days' },
            { label: 'Blocked', value: o.banned },
          ]}
        />
      </Section>

      <Section
        title="Viewing"
        description="Recorded for signed-in accounts. Time is known only from players that report it (VidLink)."
      >
        <StatStrip
          className="sm:grid-cols-3"
          stats={[
            { label: 'Episodes & films in history', value: o.historyRows },
            { label: 'Watched to the end', value: o.finished },
            { label: 'Hours watched', value: o.hoursWatched.toLocaleString('en') },
          ]}
        />
      </Section>

      <div className="grid gap-x-8 lg:grid-cols-5">
        <Section title="Most watched" description="Last 30 days, by accounts that watched" className="min-w-0 lg:col-span-3">
          {o.top.length ? (
            <TableShell label="Most watched titles" fit>
              <thead>
                <tr>
                  <th scope="col" className={th}>Title</th>
                  <th scope="col" className={`${th} w-[34%]`}>Accounts</th>
                  <th scope="col" className={`${th} w-16 text-right`}>Plays</th>
                </tr>
              </thead>
              <tbody>
                {o.top.map((t) => (
                  <tr key={`${t.mediaType}-${t.tmdbId}`} className="transition-colors hover:bg-white/[0.03]">
                    <td className={td}>
                      <Link href={`/watch/${t.mediaType}/${t.tmdbId}`} className="flex items-center gap-3 hover:text-accent">
                        <Image
                          src={poster(t.poster, 'w92')}
                          alt=""
                          width={28}
                          height={42}
                          className="h-[42px] w-7 shrink-0 rounded object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{t.title}</span>
                          <span className="text-xs text-white/55">{t.mediaType === 'tv' ? 'Series' : 'Movie'}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={td}>
                      <span className="flex items-center gap-2.5">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-accent/15">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${(t.viewers / maxViewers) * 100}%` }}
                          />
                        </span>
                        <span className="w-6 text-right tabular-nums">{t.viewers}</span>
                      </span>
                    </td>
                    <td className={`${td} text-right tabular-nums text-white/70`}>{t.plays}</td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          ) : (
            <EmptyState>
              Nothing watched in the last 30 days. Titles show up here once signed-in
              accounts start watching.
            </EmptyState>
          )}
        </Section>

        <Section title="Recent viewing" className="min-w-0 lg:col-span-2">
          {o.recent.length ? (
            <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#0d130e]">
              {o.recent.map((r) => (
                <li key={String(r._id)} className="px-4 py-2.5 text-sm">
                  <p className="flex items-baseline gap-2">
                    <Link href={`/admin/users/${r.userId}`} className="truncate font-medium hover:text-accent">
                      {r.userName}
                    </Link>
                    <span className="ml-auto shrink-0 text-xs text-white/55">
                      <When date={r.lastAt} />
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-white/70">
                    {r.title} <span className="text-white/50">· {episodeLabel(r.season, r.episode)}</span>
                  </p>
                  <p className="text-xs text-white/50">
                    {serverName(r.server)}
                    {r.maxTime ? ` · at ${formatTime(r.maxTime)}` : ''}
                    {r.completed ? ' · finished' : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No viewing recorded yet.</EmptyState>
          )}
        </Section>
      </div>

      <Section
        title="Export for recommendations"
        description="JSON Lines, ready for a recommender or a local LLM. Accounts appear by id only — no emails."
      >
        <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#0d130e]">
          {EXPORTS.map((x) => (
            <li key={x.data} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{x.label}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-white/60">{x.detail}</p>
              </div>
              <a
                href={`/api/admin/export?data=${x.data}`}
                aria-label={`Download ${x.label.toLowerCase()} as JSON Lines`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-sm font-semibold text-white/85 transition-colors duration-150 hover:border-accent/50 hover:text-white"
              >
                <Download size={14} aria-hidden />
                Download
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
