'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Check, Shuffle } from 'lucide-react';
import {
  addQuizSignals,
  genreScoresFor,
  getTaste,
  saveTaste,
  type TasteKind,
  type UserTaste,
} from '@/lib/preferences';
import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES } from '@/lib/categories';
import { poster } from '@/lib/tmdb-image';
import { cn } from '@/lib/utils';

interface QuizTitle {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average?: number;
  genre_ids: number[];
  release_date?: string;
  original_language?: string;
  media_type: TasteKind;
}

type QuizStep = 'welcome' | 'genres' | 'titles' | 'done';

/** How many title-choice rounds the quiz runs. More rounds → richer profile. */
const TOTAL_ROUNDS = 20;

/** Max titles the user can pick in a single round (they may love 2 of 5). */
const MAX_PICKS = 2;

/**
 * How many candidates come back per round. Sized to fill one full row at
 * every breakpoint (2-up mobile / 3-up tablet / 5-up desktop) so no screen
 * space is left empty on the right.
 */
const ROUND_SIZE = 5;

// Genres mixed into later rounds for discovery so the profile keeps growing
// even when the user started with only a couple of genres.
const MOVIE_DISCOVERY_GENRES = [878, 18, 35]; // Sci-Fi, Drama, Comedy
const TV_DISCOVERY_GENRES = [10765, 18, 35]; // Sci-Fi & Fantasy, Drama, Comedy

// Fallbacks if no genres were selected (shouldn't normally happen).
const DEFAULT_MOVIE_GENRES = [28, 35, 878];
const DEFAULT_TV_GENRES = [18, 35, 10765];

function originBadge(title: QuizTitle): string | null {
  const language = title.original_language?.toLowerCase();
  if (language === 'hi') {
    return title.media_type === 'tv' ? 'Hindi series' : 'Bollywood';
  }
  if (language === 'ko') {
    return title.media_type === 'tv' ? 'K-drama' : 'K-movie';
  }
  if (language && language !== 'en') return language.toUpperCase();
  return null;
}

export default function TasteQuiz() {
  const router = useRouter();
  const [step, setStep] = useState<QuizStep>('welcome');
  const [kind, setKind] = useState<TasteKind>('movie');
  const [round, setRound] = useState(1);
  const [sessionKey, setSessionKey] = useState(0);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [likedTitles, setLikedTitles] = useState<number[]>([]);
  const [currentTitles, setCurrentTitles] = useState<QuizTitle[]>([]);
  const [pickedIds, setPickedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [hadSavedTaste, setHadSavedTaste] = useState(false);

  // Refs mirror the latest state for the fetch effect so it depends ONLY on
  // kind/session/round/reload — otherwise updating shown/liked ids re-creates
  // the effect and the fetch refires, hammering the API in a loop.
  const genresRef = useRef<number[]>([]);
  genresRef.current = selectedGenres;
  const likedRef = useRef<number[]>([]);
  likedRef.current = likedTitles;
  const shownRef = useRef<number[]>([]);
  // Token = which "kind:session:round:reload" is the newest in-flight request.
  const fetchedRef = useRef('');
  const tokenRef = useRef('');
  // One entry per finished round, so Back can show that round's titles
  // again and restore the profile exactly as it was before its picks.
  const historyRef = useRef<
    { titles: QuizTitle[]; pickedIds: number[]; tasteBefore: UserTaste }[]
  >([]);

  // Check once for an existing profile; kind-specific values load when the
  // user chooses Movies or Series below.
  useEffect(() => {
    const saved = getTaste();
    if (
      saved.favoriteGenres.length ||
      saved.favoriteTvGenres.length ||
      saved.likedMovieIds.length ||
      saved.likedTvIds.length
    ) {
      setHadSavedTaste(true);
    }
  }, []);

  const startQuiz = (nextKind: TasteKind) => {
    const saved = getTaste();
    setKind(nextKind);
    setSelectedGenres(
      nextKind === 'movie' ? saved.favoriteGenres : saved.favoriteTvGenres
    );
    setLikedTitles(
      nextKind === 'movie' ? saved.likedMovieIds : saved.likedTvIds
    );
    setRound(1);
    setPickedIds([]);
    setCurrentTitles([]);
    shownRef.current = [];
    fetchedRef.current = '';
    if (
      saved.favoriteGenres.length ||
      saved.favoriteTvGenres.length ||
      saved.likedMovieIds.length ||
      saved.likedTvIds.length
    ) {
      setHadSavedTaste(true);
    }
    setStep('genres');
  };

  // Fetch titles exactly once per round (guarded against StrictMode
  // double-invokes and re-renders; Shuffle/retry bumps reloadKey to a new
  // token without advancing the round).
  useEffect(() => {
    if (step !== 'titles') return;
    const token = `${kind}:${sessionKey}:${round}:${reloadKey}`;
    if (fetchedRef.current === token) return;
    fetchedRef.current = token;
    tokenRef.current = token;

    const defaults =
      kind === 'movie' ? DEFAULT_MOVIE_GENRES : DEFAULT_TV_GENRES;
    const base = genresRef.current.length ? genresRef.current : defaults;
    const discovery =
      kind === 'movie' ? MOVIE_DISCOVERY_GENRES : TV_DISCOVERY_GENRES;
    const pool =
      round > 5 ? Array.from(new Set([...base, ...discovery])) : base;

    const savedTaste = getTaste();
    const disliked =
      kind === 'movie'
        ? savedTaste.dislikedMovieIds
        : savedTaste.dislikedTvIds;
    const params = new URLSearchParams({
      media: kind,
      genres: pool.join(','),
      // The server keeps the first 600 ids: this session's titles first,
      // then dislikes (must never resurface), then older likes.
      exclude: Array.from(
        new Set([...shownRef.current, ...disliked, ...likedRef.current])
      ).join(','),
      count: String(ROUND_SIZE),
    });

    setPickedIds([]);
    setLoading(true);
    fetch(`/api/quiz-candidates?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (tokenRef.current !== token) return; // a newer request took over
        const picked = ((data.results ?? []) as QuizTitle[]).slice(
          0,
          ROUND_SIZE
        );
        setCurrentTitles(picked);
        shownRef.current = [...shownRef.current, ...picked.map((m) => m.id)];
      })
      .catch(() => {
        if (tokenRef.current === token) setCurrentTitles([]);
      })
      .finally(() => {
        if (tokenRef.current === token) setLoading(false);
      });
  }, [step, kind, sessionKey, round, reloadKey]);

  const toggleGenre = (id: number) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const togglePick = (id: number) => {
    setPickedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PICKS) return prev; // cap at 2 per round
      return [...prev, id];
    });
  };

  const finishQuiz = (genres: number[], liked: number[]) => {
    saveTaste(
      kind === 'movie'
        ? { favoriteGenres: genres, likedMovieIds: liked }
        : { favoriteTvGenres: genres, likedTvIds: liked }
    );
    setPickedIds([]);
    setCurrentTitles([]);
    setStep('done');
    router.refresh();
  };

  /** Move to the next round (or finish) — refs already hold fresh values. */
  const advanceRound = () => {
    setPickedIds([]);
    setCurrentTitles([]);
    if (round >= TOTAL_ROUNDS) finishQuiz(genresRef.current, likedRef.current);
    else setRound((r) => r + 1);
  };

  /** Confirm this round's 1–2 picks, then advance. */
  const confirmRound = () => {
    const picked = currentTitles.filter((m) => pickedIds.includes(m.id));
    if (!picked.length) return;
    historyRef.current.push({
      titles: currentTitles,
      pickedIds: picked.map((m) => m.id),
      tasteBefore: getTaste(),
    });
    const updated = addQuizSignals({
      kind,
      titleIds: picked.map((m) => m.id),
      genreIds: picked.flatMap((m) => m.genre_ids),
      languages: picked.map((m) => m.original_language),
    });
    const nextGenres =
      kind === 'movie' ? updated.favoriteGenres : updated.favoriteTvGenres;
    const nextLiked =
      kind === 'movie' ? updated.likedMovieIds : updated.likedTvIds;
    // Update refs immediately so the next round's fetch uses fresh values.
    genresRef.current = nextGenres;
    likedRef.current = nextLiked;
    setSelectedGenres(nextGenres);
    setLikedTitles(nextLiked);
    advanceRound();
  };

  // "None of these" — advance without recording anything.
  const skipRound = () => {
    historyRef.current.push({
      titles: currentTitles,
      pickedIds: [],
      tasteBefore: getTaste(),
    });
    advanceRound();
  };

  const backRound = () => {
    const previous = historyRef.current.pop();
    if (round <= 1 || !previous) {
      setPickedIds([]);
      setCurrentTitles([]);
      setStep('genres');
      return;
    }
    // Undo that round's picks so re-picking doesn't count twice.
    const restored = saveTaste(previous.tasteBefore);
    const nextGenres =
      kind === 'movie' ? restored.favoriteGenres : restored.favoriteTvGenres;
    const nextLiked =
      kind === 'movie' ? restored.likedMovieIds : restored.likedTvIds;
    genresRef.current = nextGenres;
    likedRef.current = nextLiked;
    setSelectedGenres(nextGenres);
    setLikedTitles(nextLiked);
    // Claim the earlier round's fetch token: the effect then keeps the
    // restored titles, and any in-flight fetch for this round is ignored.
    const token = `${kind}:${sessionKey}:${round - 1}:${reloadKey}`;
    fetchedRef.current = token;
    tokenRef.current = token;
    setLoading(false);
    setCurrentTitles(previous.titles);
    setPickedIds(previous.pickedIds);
    setRound((r) => r - 1);
  };

  /** Saves the step-1 genres, then starts the title rounds. */
  const beginRounds = () => {
    // Rounds rebuild favorites from storage, so an unsaved step-1 choice
    // would be lost after the first pick. Deselected genres also lose their
    // learned weight — otherwise the scorer keeps favoring them.
    const saved = getTaste();
    const previous =
      kind === 'movie' ? saved.favoriteGenres : saved.favoriteTvGenres;
    const scores = { ...genreScoresFor(saved, kind) };
    for (const id of previous) {
      if (!selectedGenres.includes(id)) delete scores[String(id)];
    }
    saveTaste(
      kind === 'movie'
        ? { favoriteGenres: selectedGenres, genreScores: scores }
        : { favoriteTvGenres: selectedGenres, tvGenreScores: scores }
    );
    historyRef.current = [];
    setRound(1);
    setSessionKey((k) => k + 1);
    setPickedIds([]);
    setCurrentTitles([]);
    setStep('titles');
  };

  // Shuffle replaces this round's three options without recording or
  // advancing. Shown titles stay excluded, so the new set is always fresh.
  const shuffleRound = () => {
    setPickedIds([]);
    setCurrentTitles([]);
    setReloadKey((k) => k + 1);
  };

  const endEarly = () => finishQuiz(genresRef.current, likedRef.current);

  const refineTaste = () => {
    setRound(1);
    setPickedIds([]);
    setCurrentTitles([]);
    setStep('genres');
  };

  const genreOptions =
    kind === 'movie' ? TMDB_MOVIE_GENRES : TMDB_TV_GENRES;
  const genreById = new Map(genreOptions.map((g) => [g.id, g.name]));

  const statusOf = (rating: number | undefined) => {
    if (rating == null) return null;
    if (rating >= 7.5)
      return { label: 'Hit', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
    if (rating >= 5.5)
      return { label: 'Average', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
    return { label: 'Flop', cls: 'text-red-400 border-red-500/30 bg-red-500/10' };
  };

  const kindNoun = kind === 'movie' ? 'movie' : 'series';
  const kindPlural = kind === 'movie' ? 'movies' : 'series';
  const recommendedHref =
    kind === 'movie' ? '/recommended' : '/recommended/series';

  const progress =
    step === 'welcome'
      ? 0
      : step === 'genres'
        ? 5
        : step === 'done'
          ? 100
          : Math.round((round / TOTAL_ROUNDS) * 100);

  // --- Welcome ---
  if (step === 'welcome') {
    return (
      <section className="mx-auto mt-10 max-w-2xl text-center sm:mt-14">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-aurora-soft text-3xl ring-1 ring-accent/30">
          🎬
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Build your taste
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-white/60">
          Choose Movies or Series, then play {TOTAL_ROUNDS} quick rounds. We
          show {ROUND_SIZE} titles — including Bollywood and Korean picks —
          and you select up to {MAX_PICKS} per round. The more you pick, the
          sharper your recommendations get.
        </p>
        {hadSavedTaste ? (
          <p className="mt-4 rounded-full glass px-4 py-2.5 text-sm text-white/50">
            You already have a saved taste — retaking either quiz updates it.
          </p>
        ) : null}
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <button
            onClick={() => startQuiz('movie')}
            className="flex-1 rounded-full bg-aurora px-8 py-3.5 text-sm font-bold text-black shadow-lg shadow-accent/25 transition hover:shadow-glow"
          >
            Movie quiz
          </button>
          <button
            onClick={() => startQuiz('tv')}
            className="flex-1 rounded-full border border-accent/40 px-8 py-3.5 text-sm font-bold text-accent transition hover:bg-accent/10"
          >
            Series quiz
          </button>
          <Link
            href="/"
            className="flex-1 rounded-full border border-white/10 px-8 py-3.5 text-sm font-semibold text-white/60 transition hover:border-white/25 hover:text-white"
          >
            Skip
          </Link>
        </div>
      </section>
    );
  }

  // --- Done ---
  if (step === 'done') {
    return (
      <section className="mx-auto mt-10 max-w-2xl text-center sm:mt-14">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-aurora-soft text-3xl ring-1 ring-accent/30">
          ✨
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Taste saved
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-white/60">
          We&apos;ve learned {selectedGenres.length} favorite genres and{' '}
          {likedTitles.length}{' '}
          {likedTitles.length === 1 ? kindNoun : kindPlural} you like. See your
          personalized recommendations next.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={recommendedHref}
            className="rounded-full bg-aurora px-8 py-3.5 text-sm font-bold text-black shadow-lg shadow-accent/25 transition hover:shadow-glow"
          >
            See recommendations
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/10 px-8 py-3.5 text-sm font-semibold text-white/60 transition hover:border-white/25 hover:text-white"
          >
            Go to Home
          </Link>
          <button
            onClick={refineTaste}
            className="rounded-full border border-white/10 px-8 py-3.5 text-sm font-semibold text-white/60 transition hover:border-white/25 hover:text-white"
          >
            Refine taste
          </button>
        </div>
      </section>
    );
  }

  // --- Genres ---
  if (step === 'genres') {
    return (
      <section className="mt-6">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1 w-3 rounded bg-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
              {kind === 'movie' ? 'Movie quiz' : 'Series quiz'} — Step 1: your
              genres
            </span>
          </div>
          <h2 className="font-display text-xl font-bold tracking-tight">
            Which {kind === 'movie' ? 'movie' : 'series'} genres do you love?
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Select all that apply — then we&apos;ll run {TOTAL_ROUNDS} rounds of
            quick {kindPlural} picks to fine-tune your taste.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {genreOptions.map((g) => {
            const active = selectedGenres.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGenre(g.id)}
                aria-pressed={active}
                className={cn(
                  'rounded-xl border px-4 py-3 text-sm font-medium transition',
                  active
                    ? 'border-transparent bg-accent text-black shadow-lg shadow-accent/30'
                    : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-accent/50 hover:text-accent'
                )}
              >
                {g.name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep('welcome')}
            className="text-sm text-white/50 hover:text-white"
          >
            Back
          </button>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-white/40">
              {selectedGenres.length} selected
            </span>
            <button
              onClick={beginRounds}
              disabled={!selectedGenres.length}
              className={cn(
                'rounded-full px-8 py-3 text-sm font-bold transition',
                !selectedGenres.length
                  ? 'cursor-not-allowed border border-white/10 bg-white/5 text-white/40'
                  : 'bg-aurora text-black shadow-lg shadow-accent/25 hover:shadow-glow'
              )}
            >
              Continue →
            </button>
          </div>
        </div>
      </section>
    );
  }

  // --- Title choice rounds ---
  return (
    <section className="mt-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-1 w-3 rounded bg-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
            {kind === 'movie' ? 'Movie quiz' : 'Series quiz'} — Round {round} of{' '}
            {TOTAL_ROUNDS}
          </span>
        </div>
        <h2 className="font-display text-xl font-bold tracking-tight">
          Which of these would you watch?
        </h2>
        <p className="mt-2 text-sm text-white/60">
          Pick up to {MAX_PICKS} {kindPlural} you&apos;d love — shuffle for a
          fresh set, or skip this round if none appeal to you.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-wrap justify-center gap-4">
          {Array.from({ length: ROUND_SIZE }).map((_, i) => (
            <div
              key={i}
              className="flex w-[calc(50%-10px)] min-w-0 flex-col items-center gap-3 sm:w-[calc(33.333%-12px)] lg:w-[calc(20%-14px)]"
            >
              <div className="shimmer aspect-[2/3] w-full rounded-2xl bg-white/5" />
              <div className="shimmer h-4 w-32 rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : currentTitles.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-white/50">
            No {kindPlural} found for this round.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              onClick={shuffleRound}
              className="text-sm font-semibold text-accent hover:underline"
            >
              Shuffle choices
            </button>
            <button
              onClick={skipRound}
              className="text-sm text-white/50 hover:text-white"
            >
              Skip round →
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-4">
          {currentTitles.map((m) => {
            const picked = pickedIds.includes(m.id);
            const blocked = !picked && pickedIds.length >= MAX_PICKS;
            const badge = originBadge(m);
            const status = statusOf(m.vote_average);
            const year = m.release_date
              ? new Date(m.release_date).getFullYear()
              : null;
            const genres = m.genre_ids
              .slice(0, 2)
              .map((gid) => genreById.get(gid))
              .filter(Boolean);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => togglePick(m.id)}
                disabled={blocked}
                aria-pressed={picked}
                aria-label={`${picked ? 'Unpick' : 'Pick'} ${m.title}`}
                className={cn(
                  'group block w-[calc(50%-10px)] min-w-0 overflow-hidden rounded-2xl border bg-card shadow-card transition sm:w-[calc(33.333%-12px)] lg:w-[calc(20%-14px)]',
                  picked
                    ? 'border-accent shadow-lg shadow-accent/20 ring-2 ring-accent/60'
                    : 'border-white/10 hover:border-accent/50 hover:shadow-glow',
                  blocked && 'cursor-not-allowed opacity-40'
                )}
              >
                <div className="relative aspect-[2/3] overflow-hidden bg-white/[0.04]">
                  <Image
                    src={poster(m.poster_path, 'w500')}
                    alt={m.title}
                    width={360}
                    height={540}
                    loading="lazy"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  {picked ? (
                    <span
                      aria-hidden
                      className="absolute inset-0 grid place-items-center bg-black/45"
                    >
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-black shadow-xl shadow-accent/40">
                        <Check size={22} strokeWidth={3} />
                      </span>
                    </span>
                  ) : (
                    <>
                      <div
                        aria-hidden
                        className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100"
                      />
                      <span
                        aria-hidden
                        className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100"
                      >
                        <span className="grid h-12 w-12 scale-90 place-items-center rounded-full border-2 border-white/80 text-white shadow-xl transition-transform group-hover:scale-100">
                          +
                        </span>
                      </span>
                    </>
                  )}
                  {m.vote_average ? (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold backdrop-blur">
                      <span className="fill-amber-400 text-amber-400">★</span>
                      {m.vote_average.toFixed(1)}
                    </span>
                  ) : null}
                  {badge ? (
                    <span className="absolute right-2 top-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-black">
                      {badge}
                    </span>
                  ) : null}
                </div>
                <div className="p-2">
                  <p className="w-full truncate text-center text-sm font-semibold">
                    {m.title}
                  </p>
                  <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                    {year ? (
                      <span
                        className="inline-flex items-center rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70"
                      >
                        {year}
                      </span>
                    ) : null}
                    {genres.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70"
                      >
                        {name}
                      </span>
                    ))}
                    {status ? (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold',
                          status.cls
                        )}
                      >
                        {status.label}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button
            onClick={backRound}
            className="text-sm text-white/50 hover:text-white"
          >
            ← Back
          </button>
          <button
            onClick={endEarly}
            className="text-sm text-white/40 hover:text-white"
            title="Finish now and save your taste"
          >
            End quiz & save
          </button>
        </div>
        <div className="flex items-center gap-4">
          {!loading && currentTitles.length > 0 ? (
            <button
              onClick={shuffleRound}
              className="inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-accent"
            >
              <Shuffle size={14} aria-hidden />
              Shuffle
            </button>
          ) : null}
          {!loading && currentTitles.length > 0 ? (
            <button
              onClick={skipRound}
              className="text-sm text-white/40 hover:text-white"
            >
              None of these
            </button>
          ) : null}
          <button
            onClick={confirmRound}
            disabled={!pickedIds.length}
            className={cn(
              'rounded-full px-7 py-2.5 text-sm font-bold transition',
              !pickedIds.length
                ? 'cursor-not-allowed border border-white/10 bg-white/5 text-white/40'
                : 'bg-aurora text-black shadow-lg shadow-accent/25 hover:shadow-glow'
            )}
          >
            {round >= TOTAL_ROUNDS ? 'Finish' : 'Next'} →
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div
        aria-hidden
        className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/5"
      >
        <div
          className="h-full rounded-full bg-aurora transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-right text-xs font-semibold tabular-nums text-white/40">
        {pickedIds.length > 0
          ? `${pickedIds.length} of ${MAX_PICKS} picked this round`
          : `${MAX_PICKS} picks allowed this round`}
      </p>
    </section>
  );
}
