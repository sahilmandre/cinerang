// Server only. Read-side queries for the admin panel. Better Auth's own
// collections (user, session) are read directly; changes to accounts go
// through Better Auth (app/api/admin/users/[id]).
import { ObjectId } from 'mongodb';
import { getMongo, profiles, type ProfileDoc } from './db';
import { activity, watchHistory, type ActivityDoc, type HistoryDoc } from './history';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  createdAt: Date;
}

interface UserDoc {
  _id: ObjectId;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  createdAt: Date;
}

interface SessionDoc {
  _id: ObjectId;
  userId: ObjectId | string;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

const users = () => getMongo().db.collection<UserDoc>('user');
const sessions = () => getMongo().db.collection<SessionDoc>('session');

const toUser = (u: UserDoc): AdminUser => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  image: u.image,
  role: u.role,
  banned: u.banned,
  banReason: u.banReason,
  createdAt: u.createdAt,
});

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function findUser(id: string): Promise<AdminUser | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await users().findOne({ _id: new ObjectId(id) });
  return doc ? toUser(doc) : null;
}

export interface TopTitle {
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  title: string;
  poster: string | null;
  viewers: number;
  plays: number;
}

export async function overview() {
  const week = daysAgo(7);
  const [total, newThisWeek, banned, activeIds, rows, finished, watched, top, recent] =
    await Promise.all([
      users().countDocuments(),
      users().countDocuments({ createdAt: { $gte: week } }),
      users().countDocuments({ banned: true }),
      watchHistory().distinct('userId', { lastAt: { $gte: week } }),
      watchHistory().estimatedDocumentCount(),
      watchHistory().countDocuments({ completed: true }),
      watchHistory()
        .aggregate<{ seconds: number }>([
          { $match: { maxTime: { $gt: 0 } } },
          {
            $group: {
              _id: null,
              seconds: { $sum: { $min: ['$maxTime', { $ifNull: ['$duration', '$maxTime'] }] } },
            },
          },
        ])
        .toArray(),
      watchHistory()
        .aggregate<TopTitle>([
          { $match: { lastAt: { $gte: daysAgo(30) } } },
          {
            $group: {
              _id: { mediaType: '$mediaType', tmdbId: '$tmdbId' },
              title: { $last: '$title' },
              poster: { $last: '$poster' },
              viewers: { $addToSet: '$userId' },
              plays: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              mediaType: '$_id.mediaType',
              tmdbId: '$_id.tmdbId',
              title: 1,
              poster: 1,
              plays: 1,
              viewers: { $size: '$viewers' },
            },
          },
          { $sort: { viewers: -1, plays: -1 } },
          { $limit: 10 },
        ])
        .toArray(),
      watchHistory().find({}).sort({ lastAt: -1 }).limit(15).toArray(),
    ]);
  const names = await namesFor(recent.map((r) => r.userId));
  return {
    total,
    newThisWeek,
    banned,
    activeThisWeek: activeIds.length,
    historyRows: rows,
    finished,
    hoursWatched: Math.round((watched[0]?.seconds ?? 0) / 360) / 10,
    top,
    recent: recent.map((r) => ({ ...r, userName: names.get(r.userId) ?? 'Deleted user' })),
  };
}

async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids)).filter((id) => ObjectId.isValid(id));
  if (!unique.length) return new Map();
  const docs = await users()
    .find({ _id: { $in: unique.map((id) => new ObjectId(id)) } }, { projection: { name: 1, email: 1 } })
    .toArray();
  return new Map(docs.map((d) => [String(d._id), d.name || d.email]));
}

export const PAGE_SIZE = 25;

export interface UserRow extends AdminUser {
  watched: number;
  lastWatchedAt?: Date;
  likes: number;
  watchlist: number;
}

export async function listUsers({ q, page }: { q?: string; page: number }) {
  const filter = q?.trim()
    ? {
        $or: [
          { email: { $regex: escapeRegExp(q.trim()), $options: 'i' } },
          { name: { $regex: escapeRegExp(q.trim()), $options: 'i' } },
        ],
      }
    : {};
  const [count, docs] = await Promise.all([
    users().countDocuments(filter),
    users()
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray(),
  ]);
  const ids = docs.map((d) => String(d._id));
  const [stats, counts] = await Promise.all([
    watchHistory()
      .aggregate<{ _id: string; watched: number; lastAt: Date }>([
        { $match: { userId: { $in: ids } } },
        { $group: { _id: '$userId', watched: { $sum: 1 }, lastAt: { $max: '$lastAt' } } },
      ])
      .toArray(),
    profiles()
      .aggregate<{ _id: string; likes: number; watchlist: number }>([
        { $match: { _id: { $in: ids } } },
        {
          $project: {
            likes: {
              $add: [
                { $size: { $ifNull: ['$taste.likedMovieIds', []] } },
                { $size: { $ifNull: ['$taste.likedTvIds', []] } },
              ],
            },
            watchlist: { $size: { $ifNull: ['$watchlist', []] } },
          },
        },
      ])
      .toArray(),
  ]);
  const byStats = new Map(stats.map((s) => [s._id, s]));
  const byCounts = new Map(counts.map((c) => [c._id, c]));
  const rows: UserRow[] = docs.map((d) => {
    const id = String(d._id);
    return {
      ...toUser(d),
      watched: byStats.get(id)?.watched ?? 0,
      lastWatchedAt: byStats.get(id)?.lastAt,
      likes: byCounts.get(id)?.likes ?? 0,
      watchlist: byCounts.get(id)?.watchlist ?? 0,
    };
  });
  return { rows, count, pages: Math.max(1, Math.ceil(count / PAGE_SIZE)) };
}

export interface UserDetail {
  user: AdminUser;
  profile: ProfileDoc | null;
  history: HistoryDoc[];
  activity: ActivityDoc[];
  sessions: SessionDoc[];
  totals: { watched: number; finished: number; hours: number };
}

export async function userDetail(id: string): Promise<UserDetail | null> {
  const user = await findUser(id);
  if (!user) return null;
  const [profile, history, events, devices, totals] = await Promise.all([
    profiles().findOne({ _id: id }, { projection: { appliedOps: 0 } }),
    watchHistory().find({ userId: id }).sort({ lastAt: -1 }).limit(500).toArray(),
    activity().find({ userId: id }).sort({ at: -1 }).limit(100).toArray(),
    sessions()
      .find({ userId: { $in: [new ObjectId(id), id] }, expiresAt: { $gt: new Date() } })
      .sort({ updatedAt: -1 })
      .toArray(),
    watchHistory()
      .aggregate<{ watched: number; finished: number; seconds: number }>([
        { $match: { userId: id } },
        {
          $group: {
            _id: null,
            watched: { $sum: 1 },
            finished: { $sum: { $cond: ['$completed', 1, 0] } },
            seconds: {
              $sum: { $min: [{ $ifNull: ['$maxTime', 0] }, { $ifNull: ['$duration', '$maxTime'] }] },
            },
          },
        },
      ])
      .toArray(),
  ]);
  const t = totals[0];
  return {
    user,
    profile,
    history,
    activity: events,
    sessions: devices,
    totals: {
      watched: t?.watched ?? 0,
      finished: t?.finished ?? 0,
      hours: Math.round((t?.seconds ?? 0) / 360) / 10,
    },
  };
}
