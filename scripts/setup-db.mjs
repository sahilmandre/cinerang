// One-time (and safe to re-run): creates the indexes Better Auth and the
// sync API rely on. Run with `npm run db:setup` (reads .env.local).
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set (expected in .env.local)');
  process.exit(1);
}

const client = new MongoClient(uri, { appName: 'cinerang-setup' });
try {
  const db = client.db('cinerang');
  const indexes = [
    ['user', { email: 1 }, { unique: true }],
    ['session', { token: 1 }, { unique: true }],
    ['session', { userId: 1 }, {}],
    // Mongo deletes expired sessions / OAuth state on its own.
    ['session', { expiresAt: 1 }, { expireAfterSeconds: 0 }],
    ['account', { userId: 1 }, {}],
    ['account', { providerId: 1, accountId: 1 }, {}],
    ['verification', { identifier: 1 }, {}],
    ['verification', { expiresAt: 1 }, { expireAfterSeconds: 0 }],
    // profiles: all access is by _id (built-in index) — nothing to add.
  ];
  for (const [collection, keys, options] of indexes) {
    const name = await db.collection(collection).createIndex(keys, options);
    console.log(`✓ ${collection}.${name}`);
  }
  await db.command({ ping: 1 });
  console.log('Database ready.');
} finally {
  await client.close();
}
