/**
 * Content-based recommendation engine.
 *
 * The previous scorer double-counted genre similarity and let global
 * popularity dominate taste. This version fixes both problems:
 *
 *   - Genre affinity is a single frequency-weighted recall score (55 points).
 *     Repeated quiz picks weigh more than a genre selected once.
 *   - Quality uses a fixed vote scale (20 points), not pool-relative values.
 *   - Popularity is only familiarity tie-breaking (8 points), not relevance.
 *   - Recency is modest (7 points), with no penalty for acclaimed classics.
 *   - Original-language affinity is explicit and separate (10 points), so
 *     Bollywood/Hindi and Korean preferences are learned rather than ignored.
 *
 * Scores are normalized by the available signals, so 0–100 remains comparable
 * whether or not a language profile exists yet.
 */

export type RecommendationMedia = 'movie' | 'tv';

export interface CandidateTitle {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average?: number;
  popularity?: number;
  genre_ids: number[];
  release_date?: string;
  original_language?: string;
  media_type?: RecommendationMedia | string;
}

export interface UserProfile {
  favoriteGenres: number[];
  watchedIds: number[];
  likedIds: number[];
  dislikedIds?: number[];
  /** Genre id -> learned pick frequency. Falls back to favoriteGenres. */
  genreWeights?: Record<string, number>;
  /** Original language -> learned pick frequency. */
  languageScores?: Record<string, number>;
}

export interface ScoredTitle extends CandidateTitle {
  score: number;
  reasons: string[];
}

const GENRE_POINTS = 55;
const QUALITY_POINTS = 20;
const FAMILIARITY_POINTS = 8;
const RECENCY_POINTS = 7;
const LANGUAGE_POINTS = 10;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function cleanGenreId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

interface GenreAffinity {
  affinity: number;
  matched: number[];
  weights: Map<number, number>;
}

function genreAffinity(
  profile: UserProfile,
  titleGenres: number[]
): GenreAffinity {
  const weights = new Map<number, number>();

  if (profile.genreWeights) {
    for (const [rawId, rawWeight] of Object.entries(profile.genreWeights)) {
      const id = cleanGenreId(rawId);
      const weight = Number(rawWeight);
      if (id != null && Number.isFinite(weight) && weight > 0) {
        weights.set(id, weight);
      }
    }
  }

  // Baseline: every explicitly selected genre counts once. Learned quiz
  // frequencies replace/augment this baseline when available.
  if (weights.size === 0) {
    for (const id of profile.favoriteGenres) {
      const cleanId = cleanGenreId(id);
      if (cleanId != null) weights.set(cleanId, 1);
    }
  } else {
    for (const id of profile.favoriteGenres) {
      const cleanId = cleanGenreId(id);
      if (cleanId != null && !weights.has(cleanId)) weights.set(cleanId, 1);
    }
  }

  let totalWeight = 0;
  for (const weight of Array.from(weights.values())) totalWeight += weight;

  const matched: number[] = [];
  let matchedWeight = 0;
  for (const genreId of Array.from(new Set(titleGenres.map(cleanGenreId)))) {
    if (genreId == null) continue;
    const weight = weights.get(genreId) ?? 0;
    if (weight > 0) {
      matched.push(genreId);
      matchedWeight += weight;
    }
  }

  return {
    affinity: totalWeight > 0 ? matchedWeight / totalWeight : 0,
    matched,
    weights,
  };
}

function languageAffinity(
  languageScores: UserProfile['languageScores'],
  language?: string
): number {
  if (!language) return 0;
  if (!languageScores) return 0;

  let best = 0;
  for (const score of Object.values(languageScores)) {
    const value = Number(score);
    if (Number.isFinite(value) && value > best) best = value;
  }
  if (best <= 0) return 0;

  const value = Number(languageScores[language.toLowerCase()] ?? 0);
  return value > 0 ? value / best : 0;
}

/** Fixed 5.0–8.5 quality scale, so niche and mainstream titles compare fairly. */
function qualityScore(voteAverage?: number): number {
  if (voteAverage == null || !Number.isFinite(voteAverage)) return 0.35;
  return clamp01((voteAverage - 5) / 3.5);
}

/** Familiarity only — popularity must not override genre/language affinity. */
function familiarityScore(popularity?: number): number {
  if (popularity == null || !Number.isFinite(popularity)) return 0.3;
  return clamp01(Math.log10(popularity + 1) / 2.2);
}

function recencyScore(releaseDate?: string): number {
  const year = releaseDate ? Number(releaseDate.slice(0, 4)) : NaN;
  if (!Number.isFinite(year)) return 0.2;
  if (year >= 2022) return 1;
  if (year >= 2018) return 0.72;
  if (year >= 2010) return 0.45;
  if (year >= 2000) return 0.22;
  return 0.12;
}

function languageReason(
  language: string | undefined,
  media: RecommendationMedia
): string | null {
  if (!language) return null;
  const code = language.toLowerCase();
  if (code === 'hi') {
    return media === 'tv' ? 'Hindi series' : 'Bollywood movies';
  }
  if (code === 'ko') {
    return media === 'tv' ? 'K-dramas' : 'Korean movies';
  }
  if (code === 'ja') return media === 'tv' ? 'Japanese series' : 'Japanese movies';
  if (code === 'es') return media === 'tv' ? 'Spanish series' : 'Spanish movies';
  return null;
}

export function scoreTitles(
  candidates: CandidateTitle[],
  profile: UserProfile,
  genreLookup: Map<number, string>,
  media: RecommendationMedia
): ScoredTitle[] {
  const watchedSet = new Set(profile.watchedIds);
  const likedSet = new Set(profile.likedIds);
  const dislikedSet = new Set(profile.dislikedIds ?? []);
  const hasLanguageProfile = Object.values(profile.languageScores ?? {}).some(
    (score) => Number(score) > 0
  );
  const possible =
    GENRE_POINTS +
    QUALITY_POINTS +
    FAMILIARITY_POINTS +
    RECENCY_POINTS +
    (hasLanguageProfile ? LANGUAGE_POINTS : 0);

  return candidates
    .filter(
      (title) =>
        !watchedSet.has(title.id) &&
        !likedSet.has(title.id) &&
        !dislikedSet.has(title.id)
    )
    .map((title): ScoredTitle => {
      const { affinity, matched, weights } = genreAffinity(
        profile,
        title.genre_ids
      );
      const languageMatch = languageAffinity(
        profile.languageScores,
        title.original_language
      );

      const earned =
        affinity * GENRE_POINTS +
        qualityScore(title.vote_average) * QUALITY_POINTS +
        familiarityScore(title.popularity) * FAMILIARITY_POINTS +
        recencyScore(title.release_date) * RECENCY_POINTS +
        languageMatch * (hasLanguageProfile ? LANGUAGE_POINTS : 0);

      const reasons: string[] = [];
      const languageLabel = languageReason(title.original_language, media);
      if (hasLanguageProfile && languageMatch >= 0.35 && languageLabel) {
        reasons.push(languageLabel);
      }

      const matchedNames = matched
        .sort((a, b) => (weights.get(b) ?? 0) - (weights.get(a) ?? 0) || a - b)
        .slice(0, 3)
        .map((genreId) => genreLookup.get(genreId))
        .filter((name): name is string => Boolean(name));
      if (matchedNames.length > 0) reasons.push(matchedNames.join(', '));

      if ((title.vote_average ?? 0) >= 7.5) reasons.push('Highly rated');

      return {
        ...title,
        media_type: title.media_type ?? media,
        score: Math.round((earned / possible) * 100 * 100) / 100,
        reasons,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.vote_average ?? 0) - (a.vote_average ?? 0) ||
        (b.popularity ?? 0) - (a.popularity ?? 0)
    );
}

/** Backwards-compatible alias while callers migrate to scoreTitles. */
export const scoreMovies = scoreTitles;
export type CandidateMovie = CandidateTitle;
export type ScoredMovie = ScoredTitle;
