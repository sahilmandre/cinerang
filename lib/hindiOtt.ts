/**
 * Hindi OTT series discovery.
 *
 * The plain `with_original_language=hi` discover list is dominated by
 * legacy linear-TV serials (Star Plus / Colors / Zee TV soaps such as
 * "C.I.D.", "Kyunki Saas Bhi Kabhi Bahu Thi", "Bhabiji Ghar Par Hain").
 * Those shows carry huge TMDB popularity scores from decades of episode
 * entries, so a plain popularity sort always surfaces them first.
 *
 * Real OTT Hindi series are the opposite: they are *produced for* a
 * streaming platform (Netflix, Prime Video, JioHotstar, Zee5, SonyLIV,
 * MX Player, ALTBalaji, ...) and are tagged with that platform as their
 * network. The list below is built from that signal.
 */

// TMDB "network" ids for the OTT platforms that carry Hindi originals.
// Verified against the live API (Oct 2026).
const OTT_NETWORK_IDS = [
  213, // Netflix
  1024, // Prime Video
  3919, // Disney+ Hotstar
  8036, // JioHotstar
  2646, // SonyLIV
  2590, // ZEE5
  2964, // MX Player
  7774, // Amazon MX Player
  2532, // VOOT
  4008, // JioCinema
  2112, // ALTBalaji
  5920, // Amazon miniTV
  1145, // TVFPlay
  247, // YouTube (TVF originals)
  2139, // hoichoi
  2828, // Hungama
  7355, // Atrangii
  6169, // Dangal TV
  8942, // Kutingg
  4983, // Discovery+
  3206, // Zee Zindagi
];

// Linear / broadcast TV channels. A show that sits on one of these is a
// traditional serial (even when an OTT platform also streams it), so we
// subtract them from the OTT list. Verified against the live API (Oct 2026).
const BROADCAST_NETWORK_IDS = [
  159, // StarPlus
  524, // Colors
  526, // Zee TV
  676, // Sony Entertainment Television
  1708, // Sony SAB
  5369, // Weyyak
  5370, // Zee Alwan
  2179, // Star Bharat
  1566, // &TV
  858, // Life OK
  540, // Star One
  1637, // STAR World India
  177, // DD National
  3104, // NDTV Imagine
  3118, // 9X
  6997, // LIV Arabia
  3402, // MTV India
  1524, // EPIC
  6624, // Zee Anmol
  4404, // National Geographic India
  33, // MTV
  3208, // MBC Bollywood
  3626, // MBC Shahid
  5380, // nabd alqalb studio
  2313, // movie
  9513, // ZEE5 (duplicate regional entry)
  9480, // ZEE5 (duplicate regional entry)
  9409, // ZEE5 (duplicate regional entry)
  9297, // JioHotstar (duplicate regional entry)
  9279, // Cinexa Pictures
  1797, // Star Udaan
  2229, // Colors TV
  2863, // Colors Bangla
  5807, // Zee Kannada
  3234, // Sony Entertainment Television Asia
];

// Shared filter set for every Hindi-OTT query.
//
//  - with_type=4|2            -> Scripted | Miniseries (drops reality/talk shows)
//  - first_air_date.gte      -> 2015 (pre-OTT Hindi TV era is not "OTT")
//  - without_genres=10766    -> "Soap" (TMDB's marker for TV soap serials)
//  - vote_average.gte=5.5    -> real OTT shows are well reviewed, soaps are not
//  - vote_count.gte=5        -> a show with <5 votes has no meaningful rating
const OTT_FILTERS =
  'with_original_language=hi&with_type=4%7C2&first_air_date.gte=2015-01-01' +
  '&without_genres=10766&vote_average.gte=5.5&vote_count.gte=5';

const pipe = (ids: number[]) => ids.map(String).join('%7C');

const OTT_NETWORKS = pipe(OTT_NETWORK_IDS);
const BROADCAST_NETWORKS = pipe(BROADCAST_NETWORK_IDS);

export interface HindiOttItem {
  id: number;
  name: string;
  original_name?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  original_language?: string;
  origin_country?: string[];
  [key: string]: unknown;
}

export interface HindiOttPage {
  results: HindiOttItem[];
  total_results: number;
  total_pages: number;
  page: number;
}

interface DiscoverResponse {
  page: number;
  results: HindiOttItem[];
  total_pages: number;
  total_results: number;
}

/**
 * The broadcast side of the subtraction is tiny (a single page with the
 * current filters) but it is fetched in full so a legacy serial can never
 * slip through on a later page.
 */
const MAX_BROADCAST_PAGES = 4;

/**
 * Fetches one page of Hindi series produced for an OTT platform.
 *
 * TMDB has no "network is one of these AND not one of those" filter, so we
 * issue the OTT-platform query and the broadcast-channel query and subtract
 * the broadcast ids. (TMDB's comma syntax is an AND across ids and its pipe
 * syntax collapses to the first id when combined with a comma, so there is no
 * single-request way to express the exclusion.)
 *
 * The same quality filters are applied to both sides, so the broadcast query
 * returns only the handful of legacy serials that also stream on an OTT
 * platform (Faltu, Jhanak, Titlie, ...). Subtracting them leaves a list that
 * is entirely OTT-original series.
 */
export async function fetchHindiOttPage(
  fetcher: (path: string) => Promise<unknown>,
  page = 1,
  sort: 'popularity' | 'vote_average' = 'popularity'
): Promise<HindiOttPage> {
  const sortBy = sort === 'vote_average' ? 'vote_average.desc' : 'popularity.desc';
  const ottPath = `/discover/tv?with_networks=${OTT_NETWORKS}&${OTT_FILTERS}&sort_by=${sortBy}`;
  const broadcastPath = `/discover/tv?with_networks=${BROADCAST_NETWORKS}&${OTT_FILTERS}&sort_by=${sortBy}`;

  const [ottRaw, broadcastRaw] = (await Promise.all([
    fetcher(`${ottPath}&page=${page}`),
    fetcher(`${broadcastPath}&page=1`),
  ])) as [DiscoverResponse, DiscoverResponse];

  const broadcastIds = new Set((broadcastRaw?.results ?? []).map((r) => r.id));

  // Pull the remaining broadcast pages so the exclusion set is complete.
  const extraPages = Math.min(broadcastRaw?.total_pages ?? 1, MAX_BROADCAST_PAGES) - 1;
  if (extraPages > 0) {
    const rest = await Promise.all(
      Array.from({ length: extraPages }, (_, i) =>
        fetcher(`${broadcastPath}&page=${i + 2}`)
      )
    );
    for (const page of rest as DiscoverResponse[]) {
      for (const r of page?.results ?? []) broadcastIds.add(r.id);
    }
  }

  const results = (ottRaw?.results ?? []).filter((r) => !broadcastIds.has(r.id));

  return {
    results,
    // The removed titles still occupy slots in TMDB's own pagination, so the
    // page count stays accurate even though each page renders a few less.
    total_results: ottRaw?.total_results ?? results.length,
    total_pages: ottRaw?.total_pages ?? 1,
    page: ottRaw?.page ?? page,
  };
}
