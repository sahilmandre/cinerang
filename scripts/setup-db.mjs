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
    // Watch history: one row per account × title × episode (lib/history.ts).
    ['watch_history', { userId: 1, mediaType: 1, tmdbId: 1, season: 1, episode: 1 }, { unique: true }],
    ['watch_history', { userId: 1, lastAt: -1 }, {}],
    ['watch_history', { lastAt: -1 }, {}],
    ['activity', { userId: 1, at: -1 }, {}],
    ['activity', { at: -1 }, {}],
    ['user', { createdAt: -1 }, {}],
  ];
  for (const [collection, keys, options] of indexes) {
    const name = await db.collection(collection).createIndex(keys, options);
    console.log(`✓ ${collection}.${name}`);
  }

  // Seed the watch history from Continue Watching saved before it existed.
  // $setOnInsert only: rows recorded since are never touched.
  let seeded = 0;
  for await (const profile of db.collection('profiles').find({}, { projection: { continue: 1 } })) {
    const writes = (profile.continue ?? [])
      .filter((item) => !item.upNext)
      .map((item) => {
        const movie = item.mediaType === 'movie';
        const at = new Date(Math.min(item.updatedAt || Date.now(), Date.now()));
        return {
          updateOne: {
            filter: {
              userId: profile._id,
              mediaType: item.mediaType,
              tmdbId: item.id,
              season: movie ? null : (item.season ?? 1),
              episode: movie ? null : (item.episode ?? 1),
            },
            update: {
              $setOnInsert: {
                title: item.title,
                poster: item.poster ?? null,
                ...(item.server ? { server: item.server } : {}),
                ...(item.time != null ? { maxTime: item.time } : {}),
                ...(item.duration ? { duration: item.duration } : {}),
                completed: false,
                saves: 1,
                firstAt: at,
                lastAt: at,
              },
            },
            upsert: true,
          },
        };
      });
    if (writes.length) {
      const result = await db.collection('watch_history').bulkWrite(writes, { ordered: false });
      seeded += result.upsertedCount;
    }
  }
  console.log(`✓ watch_history seeded from Continue Watching: ${seeded} new rows`);
  await db.command({ ping: 1 });
  console.log('Database ready.');
} finally {
  await client.close();
}
