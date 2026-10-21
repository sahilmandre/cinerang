// Server only. Watch history and taste activity, kept per account for the
// admin panel and as training data for future recommendations.
//
// Nothing extra is uploaded for it: every resume point and every like
// already reaches the server as a sync op, and the ops applied in a batch
// are filed here as well.
import type { AnyBulkWriteOperation, ObjectId } from 'mongodb';
import { getMongo } from './db';
import { isFinished } from './playback';
import type { ContinueItem, Kind, Op } from './sync/types';

/** One row per account × title × episode (movies: season/episode null). */
export interface HistoryDoc {
  _id?: ObjectId;
  userId: string;
  mediaType: Kind;
  tmdbId: number;
  season: number | null;
  episode: number | null;
  title: string;
  poster: string | null;
  /** Last server it played on. */
  server?: string;
  /** Furthest point reached, in seconds (players that report time). */
  maxTime?: number;
  duration?: number;
  completed: boolean;
  /** Resume points saved — a rough measure of how long it held attention. */
  saves: number;
  firstAt: Date;
  lastAt: Date;
}

export type ActivityType =
  | 'like'
  | 'unlike'
  | 'dislike'
  | 'watchlist.add'
  | 'watchlist.remove'
  | 'continue.remove';

/** Explicit taste signals, timestamped (append-only). */
export interface ActivityDoc {
  _id?: ObjectId;
  userId: string;
  at: Date;
  type: ActivityType;
  mediaType: Kind;
  tmdbIds: number[];
  genreIds?: number[];
  languages?: string[];
  title?: string;
}

export const watchHistory = () => getMongo().db.collection<HistoryDoc>('watch_history');
export const activity = () => getMongo().db.collection<ActivityDoc>('activity');

/** Device clocks can run ahead; history never claims the future. */
const when = (ms: number) => new Date(Math.min(ms, Date.now()));

function historyWrite(
  userId: string,
  item: ContinueItem,
  at: Date
): AnyBulkWriteOperation<HistoryDoc> | null {
  // Queued after the previous episode finished: not watched yet.
  if (item.upNext) return null;
  const movie = item.mediaType === 'movie';
  const completed = item.time != null && isFinished(item.time, item.duration);
  return {
    updateOne: {
      filter: {
        userId,
        mediaType: item.mediaType,
        tmdbId: item.id,
        season: movie ? null : (item.season ?? 1),
        episode: movie ? null : (item.episode ?? 1),
      },
      update: {
        $setOnInsert: { firstAt: at, ...(completed ? {} : { completed: false }) },
        $set: {
          title: item.title,
          poster: item.poster,
          ...(item.server ? { server: item.server } : {}),
          ...(item.duration ? { duration: item.duration } : {}),
          ...(completed ? { completed: true } : {}),
        },
        $max: { lastAt: at, ...(item.time != null ? { maxTime: item.time } : {}) },
        $inc: { saves: 1 },
      },
      upsert: true,
    },
  };
}

function activityOf(userId: string, op: Op): ActivityDoc | null {
  const base = { userId, at: when(op.at) };
  switch (op.t) {
    case 'taste.like':
      return {
        ...base,
        type: 'like',
        mediaType: op.kind,
        tmdbIds: op.titleIds,
        genreIds: op.genreIds,
        languages: op.languages,
      };
    case 'taste.unlike':
      return {
        ...base,
        type: 'unlike',
        mediaType: op.kind,
        tmdbIds: [op.titleId],
        genreIds: op.genreIds,
        languages: op.languages,
      };
    case 'taste.dislike':
      return {
        ...base,
        type: 'dislike',
        mediaType: op.kind,
        tmdbIds: [op.titleId],
        genreIds: op.genreIds,
      };
    case 'watchlist.add':
      return {
        ...base,
        type: 'watchlist.add',
        mediaType: op.item.mediaType,
        tmdbIds: [op.item.id],
        title: op.item.title,
      };
    case 'watchlist.remove':
      return { ...base, type: 'watchlist.remove', mediaType: op.mediaType, tmdbIds: [op.titleId] };
    case 'continue.remove':
      return { ...base, type: 'continue.remove', mediaType: op.mediaType, tmdbIds: [op.titleId] };
    default:
      return null;
  }
}

/**
 * Files the ops a sync batch applied (only fresh ones — a retried upload
 * is never counted twice). Failures are logged, never surfaced: history
 * must not break sync.
 */
export async function recordHistory(userId: string, ops: Op[]): Promise<void> {
  const writes: AnyBulkWriteOperation<HistoryDoc>[] = [];
  const events: ActivityDoc[] = [];
  for (const op of ops) {
    if (op.t === 'continue.upsert') {
      const write = historyWrite(userId, op.item, when(op.at));
      if (write) writes.push(write);
    } else if (op.t === 'import') {
      // Guest viewing on this device before the first sign-in.
      for (const item of op.snapshot.continue) {
        const write = historyWrite(userId, item, when(item.updatedAt || op.at));
        if (write) writes.push(write);
      }
    } else {
      const event = activityOf(userId, op);
      if (event) events.push(event);
    }
  }
  try {
    await Promise.all([
      writes.length ? watchHistory().bulkWrite(writes, { ordered: true }) : null,
      events.length ? activity().insertMany(events, { ordered: false }) : null,
    ]);
  } catch (error) {
    console.error('[history] could not record', error);
  }
}

/** Removes everything kept for an account (account deletion). */
export async function deleteHistory(userId: string): Promise<void> {
  await Promise.all([watchHistory().deleteMany({ userId }), activity().deleteMany({ userId })]);
}
