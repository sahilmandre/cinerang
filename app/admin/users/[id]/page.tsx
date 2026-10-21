import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { requireAdmin, isOwnerEmail } from '@/lib/admin';
import { userDetail } from '@/lib/admin-data';
import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES } from '@/lib/categories';
import { formatTime } from '@/lib/playback';
import { SERVERS } from '@/lib/servers';
import type { ActivityType } from '@/lib/history';
import UserActions from '@/components/admin/UserActions';
import {
  Avatar,
  Badge,
  EmptyState,
  Meter,
  Section,
  StatStrip,
  TableShell,
  UserBadges,
  When,
  th,
  td,
} from '@/components/admin/ui';

const MOVIE_GENRES = new Map(TMDB_MOVIE_GENRES.map((g) => [String(g.id), g.name]));
const TV_GENRES = new Map(TMDB_TV_GENRES.map((g) => [String(g.id), g.name]));
const LANGUAGES = new Intl.DisplayNames(['en'], { type: 'language' });
const serverName = (id?: string) => SERVERS.find((s) => s.id === id)?.name ?? id ?? '—';

const EVENTS: Record<ActivityType, string> = {
  like: 'Liked',
  unlike: 'Took back a like',
  dislike: 'Disliked',
  'watchlist.add': 'Added to watchlist',
  'watchlist.remove': 'Removed from watchlist',
  'continue.remove': 'Removed from Continue Watching',
};

function topScores(scores: Record<string, number> | undefined, names: (key: string) => string, n: number) {
  return Object.entries(scores ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, score]) => ({ name: names(key), score: Math.round(score * 10) / 10 }));
}

function languageName(code: string) {
  try {
    return LANGUAGES.of(code) ?? code;
  } catch {
    return code;
  }
}

/** "Chrome on Android" — enough to tell a user's devices apart. */
function device(ua?: string | null) {
  if (!ua) return 'Unknown device';
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'unknown OS';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';
  return `${browser} on ${os}`;
}

export default async function AdminUser({ params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const detail = await userDetail(params.id);
  if (!detail) notFound();
  const { user, profile, history, activity, sessions, totals } = detail;
  const owner = isOwnerEmail(user.email);
  const protectedReason =
    user.id === admin.user.id
      ? "This is your own account, so blocking, demoting and deleting are off."
      : owner
        ? 'Owner account (ADMIN_EMAILS): change it in the env settings, not here.'
        : null;

  const taste = profile?.taste;
  const likes = (taste?.likedMovieIds.length ?? 0) + (taste?.likedTvIds.length ?? 0);
  const dislikes = (taste?.dislikedMovieIds.length ?? 0) + (taste?.dislikedTvIds.length ?? 0);
  const movieGenres = topScores(taste?.genreScores, (k) => MOVIE_GENRES.get(k) ?? `Genre ${k}`, 6);
  const tvGenres = topScores(taste?.tvGenreScores, (k) => TV_GENRES.get(k) ?? `Genre ${k}`, 6);
  const languages = topScores(taste?.languageScores, languageName, 5);
  const lastActive = [sessions[0]?.updatedAt, history[0]?.lastAt]
    .filter(Boolean)
    .sort((a, b) => +new Date(b!) - +new Date(a!))[0];

  // Titles for the activity log, from everything else known about this account.
  const titles = new Map<string, string>();
  for (const h of history) titles.set(`${h.mediaType}:${h.tmdbId}`, h.title);
  for (const x of [...(profile?.watchlist ?? []), ...(profile?.continue ?? [])]) {
    titles.set(`${x.mediaType}:${x.id}`, x.title);
  }
  for (const a of activity) {
    if (a.title) titles.set(`${a.mediaType}:${a.tmdbIds[0]}`, a.title);
  }

  return (
    <div className="pb-6">
      <Link
        href="/admin/users"
        className="mt-6 inline-flex items-center gap-1.5 px-1 text-sm font-semibold text-white/60 transition-colors hover:text-white"
      >
        <ArrowLeft size={14} aria-hidden /> All accounts
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-4 px-1">
        <Avatar name={user.name || user.email} image={user.image} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            <span className="truncate">{user.name || 'No name'}</span>
            <UserBadges owner={owner} role={user.role} banned={user.banned} />
          </h2>
          <p className="truncate text-sm text-white/65">{user.email}</p>
          <p className="mt-1 text-xs text-white/55">
            Joined <When date={user.createdAt} /> · Last active <When date={lastActive} />
            {user.banned && user.banReason ? ` · Blocked: ${user.banReason}` : ''}
          </p>
        </div>
      </header>

      <div className="mt-5">
        <UserActions
          userId={user.id}
          name={user.name || user.email}
          banned={Boolean(user.banned)}
          role={owner ? 'admin' : (user.role ?? null)}
          protectedReason={protectedReason}
        />
      </div>

      <Section title="Summary">
        <StatStrip
          className="sm:grid-cols-3 lg:grid-cols-6"
          stats={[
            { label: 'Episodes & films', value: totals.watched },
            { label: 'Watched to the end', value: totals.finished },
            { label: 'Hours watched', value: totals.hours.toLocaleString('en') },
            { label: 'Likes', value: likes },
            { label: 'Dislikes', value: dislikes },
            { label: 'Watchlist', value: profile?.watchlist.length ?? 0 },
          ]}
        />
      </Section>

      <Section title="Taste" description="Learned from the quiz, likes and dislikes — what recommendations are built on.">
        {movieGenres.length || tvGenres.length || languages.length ? (
          <dl className="grid gap-4 rounded-2xl border border-white/[0.08] bg-[#0d130e] p-4 md:grid-cols-3">
            {[
              { label: 'Movie genres', items: movieGenres },
              { label: 'Series genres', items: tvGenres },
              { label: 'Languages', items: languages },
            ].map((group) => (
              <div key={group.label}>
                <dt className="text-xs font-medium text-white/60">{group.label}</dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {group.items.length ? (
                    group.items.map((g) => (
                      <span key={g.name} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/85">
                        {g.name} <span className="tabular-nums text-white/50">{g.score}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-white/50">None yet</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <EmptyState>No taste signals yet — they appear after the taste quiz or the first like.</EmptyState>
        )}
      </Section>

      <Section
        title="Watch history"
        description={history.length === 500 ? 'Latest 500 — export for the full history.' : undefined}
        action={<ExportLinks userId={user.id} />}
      >
        {history.length ? (
          <TableShell label="Watch history">
            <thead>
              <tr>
                <th scope="col" className={th}>Title</th>
                <th scope="col" className={th}>Server</th>
                <th scope="col" className={`${th} w-48`}>Progress</th>
                <th scope="col" className={th}>First watched</th>
                <th scope="col" className={th}>Last watched</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const tv = h.mediaType === 'tv';
                const href = tv
                  ? `/watch/tv/${h.tmdbId}?s=${h.season}&e=${h.episode}`
                  : `/watch/movie/${h.tmdbId}`;
                return (
                  <tr key={String(h._id)} className="transition-colors hover:bg-white/[0.03]">
                    <td className={td}>
                      <Link href={href} className="font-medium hover:text-accent">
                        {h.title}
                      </Link>
                      <span className="block text-xs text-white/55">
                        {tv ? `Series · S${h.season} · E${h.episode}` : 'Movie'}
                      </span>
                    </td>
                    <td className={`${td} text-white/70`}>{serverName(h.server)}</td>
                    <td className={td}>
                      {h.completed ? (
                        <Badge tone="admin">Finished</Badge>
                      ) : h.maxTime && h.duration ? (
                        <span className="block">
                          <Meter value={h.maxTime / h.duration} label={`${formatTime(h.maxTime)} of ${formatTime(h.duration)}`} />
                          <span className="mt-1 block text-xs tabular-nums text-white/60">
                            {formatTime(h.maxTime)} / {formatTime(h.duration)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-white/50">Time not reported</span>
                      )}
                    </td>
                    <td className={`${td} text-white/70`}><When date={h.firstAt} /></td>
                    <td className={`${td} text-white/70`}><When date={h.lastAt} /></td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState>Nothing watched yet while signed in.</EmptyState>
        )}
      </Section>

      <Section title="Activity" description="Likes, dislikes and watchlist changes, newest first.">
        {activity.length ? (
          <TableShell label="Activity">
            <thead>
              <tr>
                <th scope="col" className={th}>When</th>
                <th scope="col" className={th}>What</th>
                <th scope="col" className={th}>Title</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
                <tr key={String(a._id)}>
                  <td className={`${td} text-white/70`}><When date={a.at} /></td>
                  <td className={td}>{EVENTS[a.type]}</td>
                  <td className={td}>
                    {a.tmdbIds.map((id, i) => (
                      <span key={id}>
                        {i ? ', ' : ''}
                        <Link href={`/watch/${a.mediaType}/${id}`} className="hover:text-accent">
                          {titles.get(`${a.mediaType}:${id}`) ?? `${a.mediaType === 'tv' ? 'Series' : 'Movie'} #${id}`}
                        </Link>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState>No likes, dislikes or watchlist changes yet.</EmptyState>
        )}
      </Section>

      <Section title="Signed-in devices">
        {sessions.length ? (
          <TableShell label="Signed-in devices">
            <thead>
              <tr>
                <th scope="col" className={th}>Device</th>
                <th scope="col" className={th}>Signed in</th>
                <th scope="col" className={th}>Last active</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={String(s._id)}>
                  <td className={td}>{device(s.userAgent)}</td>
                  <td className={`${td} text-white/70`}><When date={s.createdAt} /></td>
                  <td className={`${td} text-white/70`}><When date={s.updatedAt} /></td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState>Not signed in on any device.</EmptyState>
        )}
      </Section>
    </div>
  );
}

function ExportLinks({ userId }: { userId: string }) {
  const links = [
    { data: 'history', label: 'History' },
    { data: 'activity', label: 'Activity' },
    { data: 'taste', label: 'Taste' },
  ];
  return (
    <div className="flex items-center gap-1.5">
      <Download size={14} aria-hidden className="text-white/55" />
      {links.map((l) => (
        <a
          key={l.data}
          href={`/api/admin/export?data=${l.data}&user=${userId}`}
          aria-label={`Download this account's ${l.label.toLowerCase()} as JSON Lines`}
          className="rounded-full border border-white/15 px-2.5 py-1 text-xs font-semibold text-white/80 transition-colors hover:border-accent/50 hover:text-white"
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}
