import { MongoClient, type Db } from 'mongodb';
import { attachDatabasePool } from '@vercel/functions';
import type { SyncData } from './sync/types';

export const DB_NAME = 'cinerang';

interface Mongo {
  client: MongoClient;
  db: Db;
}

const cache = globalThis as typeof globalThis & { __cinerangMongo?: Mongo };

/**
 * One MongoClient per server instance, cached on globalThis so it survives
 * dev hot reloads and warm serverless invocations. Created on first use, so
 * `next build` never needs the database.
 */
export function getMongo(): Mongo {
  if (cache.__cinerangMongo) return cache.__cinerangMongo;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set — see .env.example');
  const client = new MongoClient(uri, {
    maxPoolSize: 5,
    maxIdleTimeMS: 10_000,
    serverSelectionTimeoutMS: 5_000,
    appName: 'cinerang',
  });
  // Keeps a Vercel function alive just long enough to close idle
  // connections before it suspends. No-op outside Vercel.
  attachDatabasePool(client);
  cache.__cinerangMongo = { client, db: client.db(DB_NAME) };
  return cache.__cinerangMongo;
}

/** `profiles` collection: one document per user, keyed by Better Auth user id. */
export interface ProfileDoc extends SyncData {
  _id: string;
  /** +1 per applied batch; served as the ETag. */
  rev: number;
  /** Last applied op ids, so retried uploads are idempotent. */
  appliedOps: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function profiles() {
  return getMongo().db.collection<ProfileDoc>('profiles');
}
