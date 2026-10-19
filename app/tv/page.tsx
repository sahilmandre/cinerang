import { tmdb, hindiOtt } from '@/lib/tmdb';
import Row from '@/components/Row';
import ContinueWatching from '@/components/ContinueWatching';
import PageHeader from '@/components/PageHeader';
import LoadError from '@/components/LoadError';

// One flaky endpoint (e.g. an ECONNRESET mid-request) empties just its row
// instead of failing the whole page.
const empty = { results: [] as any[] };
const quiet = (p: Promise<any>) => p.catch(() => empty);

export default async function TVPage() {
  const [english, hindi, hindiTop, korean, anime, action, crime, mystery, scifi] =
    await Promise.all([
      quiet(tmdb.tvByLang('en')),
      // Hindi rows are OTT-only (Netflix / Prime / JioHotstar / Zee5 / ...),
      // not the legacy linear-TV serials a plain language query returns.
      quiet(hindiOtt.page(1)),
      quiet(hindiOtt.page(1, 'vote_average')),
      quiet(tmdb.tvByLang('ko')),
      quiet(tmdb.anime()),
      quiet(tmdb.genreTV(10759)),
      quiet(tmdb.genreTV(80)),
      quiet(tmdb.genreTV(9648)),
      quiet(tmdb.genreTV(10765)),
    ]);
  const sections = [english, hindi, hindiTop, korean, anime, action, crime, mystery, scifi];
  if (sections.every((s) => !(s.results?.length))) {
    return <LoadError title="Could not load TV Series" retryHref="/tv" />;
  }
  return (
    <div className="mt-8">
      <PageHeader title="TV Series" />
      <Row title="English Series" items={english.results ?? []} type="tv" href="/browse/tv-english" />
      <Row title="Hindi Series" items={hindi.results ?? []} type="tv" href="/browse/tv-hindi" />
      <Row title="Top Rated Hindi Series" items={hindiTop.results ?? []} type="tv" href="/browse/tv-hindi-top" />
      <Row title="Korean Series" items={korean.results ?? []} type="tv" href="/browse/tv-korean" />
      <Row title="Anime" items={anime.results ?? []} type="tv" href="/browse/anime" />
      <Row title="Action & Adventure" items={action.results ?? []} type="tv" href="/browse/tv-action" />
      <Row title="Crime" items={crime.results ?? []} type="tv" href="/browse/tv-crime" />
      <Row title="Mystery" items={mystery.results ?? []} type="tv" href="/browse/tv-mystery" />
      <Row title="Sci-Fi & Fantasy" items={scifi.results ?? []} type="tv" href="/browse/tv-scifi" />
      <ContinueWatching />
    </div>
  );
}
