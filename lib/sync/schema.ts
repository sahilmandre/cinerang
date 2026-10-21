/**
 * Server-side validation for uploaded ops. Kept out of types.ts so zod is
 * never pulled into the browser bundle.
 */
import { z } from 'zod';
import { CAPS } from './reducer';
import type { Op } from './types';

export const MAX_OPS_PER_BATCH = 100;

const kind = z.enum(['movie', 'tv']);
const positiveId = z.number().int().positive().max(2_147_483_647);
const language = z.string().min(1).max(12);
const scores = z
  .record(z.string().min(1).max(16), z.number().nonnegative().max(1_000_000))
  .refine((value) => Object.keys(value).length <= 300, 'Too many score keys');

const item = z.object({
  id: positiveId,
  mediaType: kind,
  title: z.string().max(500),
  poster: z
    .string()
    .max(300)
    .nullish()
    .transform((value) => value ?? null),
  season: z.number().int().min(0).max(10_000).optional(),
  episode: z.number().int().min(0).max(100_000).optional(),
  server: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .optional(),
  time: z.number().int().min(0).max(86_400).optional(),
  duration: z.number().int().positive().max(86_400).optional(),
  updatedAt: z.number().int().nonnegative(),
});

const tasteFields = z.object({
  favoriteGenres: z.array(positiveId).max(CAPS.favorites),
  favoriteTvGenres: z.array(positiveId).max(CAPS.favorites),
  likedMovieIds: z.array(positiveId).max(CAPS.ids),
  likedTvIds: z.array(positiveId).max(CAPS.ids),
  dislikedMovieIds: z.array(positiveId).max(CAPS.ids),
  dislikedTvIds: z.array(positiveId).max(CAPS.ids),
  watchedMovieIds: z.array(positiveId).max(CAPS.ids),
  watchedTvIds: z.array(positiveId).max(CAPS.ids),
  genreScores: scores,
  tvGenreScores: scores,
  languageScores: scores,
});

const snapshot = z.object({
  taste: tasteFields.extend({ updatedAt: z.number().nonnegative() }),
  watchlist: z.array(item).max(CAPS.watchlist),
  continue: z.array(item).max(CAPS.continue),
  prefs: z.object({ popupBlock: z.boolean() }),
});

const base = {
  id: z.string().min(8).max(64),
  at: z.number().int().nonnegative(),
};
const genreIds = z.array(positiveId).max(100);
const languages = z.array(language).max(50);

const opSchema = z.discriminatedUnion('t', [
  z.object({
    ...base,
    t: z.literal('taste.like'),
    kind,
    titleIds: z.array(positiveId).max(50),
    genreIds,
    languages,
  }),
  z.object({ ...base, t: z.literal('taste.unlike'), kind, titleId: positiveId, genreIds, languages }),
  z.object({ ...base, t: z.literal('taste.dislike'), kind, titleId: positiveId, genreIds }),
  z.object({ ...base, t: z.literal('taste.set'), fields: tasteFields.partial() }),
  z.object({ ...base, t: z.literal('watchlist.add'), item }),
  z.object({ ...base, t: z.literal('watchlist.remove'), mediaType: kind, titleId: positiveId }),
  z.object({ ...base, t: z.literal('continue.upsert'), item }),
  z.object({ ...base, t: z.literal('continue.remove'), mediaType: kind, titleId: positiveId }),
  z.object({ ...base, t: z.literal('continue.clear') }),
  z.object({ ...base, t: z.literal('prefs.set'), popupBlock: z.boolean() }),
  z.object({ ...base, t: z.literal('import'), snapshot }),
]);

const batchSchema = z.object({
  ops: z.array(z.unknown()).min(1).max(MAX_OPS_PER_BATCH),
});

/**
 * Validates each op on its own. An invalid op is reported back and dropped
 * rather than failing the batch — otherwise one bad op would block that
 * device's outbox forever.
 */
export function parseBatch(body: unknown): { ops: Op[]; rejected: number } | null {
  const batch = batchSchema.safeParse(body);
  if (!batch.success) return null;
  const ops: Op[] = [];
  let rejected = 0;
  for (const raw of batch.data.ops) {
    const parsed = opSchema.safeParse(raw);
    if (parsed.success) ops.push(parsed.data as Op);
    else rejected++;
  }
  return { ops, rejected };
}
