const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function tmdbPosterUrl(path: string | null | undefined, size: "w342" | "w500" = "w342") {
  if (!path) return null;
  // Anime posters (from Jikan/MAL) are stored as full URLs, not TMDB-style
  // relative paths -- pass them through as-is instead of double-prefixing.
  if (path.startsWith("http")) return path;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function tmdbProfileUrl(path: string | null | undefined, size: "w185" = "w185") {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function tmdbLogoUrl(path: string | null | undefined, size: "w45" | "w92" = "w45") {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function tmdbBackdropUrl(path: string | null | undefined, size: "w780" | "w1280" = "w1280") {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function hasTmdbKey() {
  return Boolean(process.env.TMDB_API_KEY);
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDB_API_KEY no está configurada. Ver .env.example.");
  }

  const url = new URL(`${TMDB_API_BASE}${path}`);
  // es-MX instead of es-ES: TMDB's Spain-Spanish translations read oddly to
  // most Latin American users (different title conventions, vocabulary).
  // es-MX is TMDB's best-covered Latin American Spanish locale.
  url.searchParams.set("language", "es-MX");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TMDB ${path} -> ${res.status}: ${body.slice(0, 200)}`);
  }

  return (await res.json()) as T;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbListItem {
  id: number;
  title?: string; // movie
  name?: string; // tv
  original_title?: string;
  original_name?: string;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  origin_country?: string[]; // present on /discover/tv results
}

export interface TmdbPersonCredit {
  id: number;
  name: string;
  profile_path: string | null;
  character?: string;
  order?: number;
  job?: string;
  known_for_department?: string;
}

export interface TmdbCredits {
  cast: TmdbPersonCredit[];
  crew: TmdbPersonCredit[];
}

export interface TmdbCountry {
  iso_3166_1: string;
  name: string;
}

export interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}

// Keyed by ISO 3166-1 country code. "flatrate" = included with a
// subscription (Netflix, HBO Max, etc) -- what we care about; rent/buy are
// intentionally not tracked for now.
export interface TmdbWatchProviders {
  results: Record<string, { flatrate?: TmdbWatchProvider[] }>;
}

// TMDB's own "if you liked this, try these" for the title -- combines their
// aggregate user behavior with content signals. Same media type as the
// source (a movie's recommendations are always movies).
export interface TmdbRecommendations {
  results: TmdbListItem[];
}

export interface TmdbCollection {
  id: number;
  name: string;
}

export interface TmdbMovieDetails extends TmdbListItem {
  genres: TmdbGenre[];
  production_countries: TmdbCountry[];
  budget: number; // USD, 0 when unknown -- TV has no equivalent field
  runtime: number | null; // minutes
  belongs_to_collection: TmdbCollection | null; // franchise/trilogy grouping
  credits: TmdbCredits;
  "watch/providers": TmdbWatchProviders;
  recommendations: TmdbRecommendations;
}

export interface TmdbCreatedBy {
  id: number;
  name: string;
  profile_path: string | null;
}

export interface TmdbTvDetails extends TmdbListItem {
  genres: TmdbGenre[];
  origin_country: string[];
  created_by: TmdbCreatedBy[];
  episode_run_time: number[]; // minutes; empty/varies for some shows
  credits: TmdbCredits;
  "watch/providers": TmdbWatchProviders;
  recommendations: TmdbRecommendations;
}

export interface TmdbDiscoverResponse {
  results: TmdbListItem[];
  page: number;
  total_pages: number;
  total_results: number;
}

export interface TmdbPersonDetails {
  id: number;
  biography: string;
  birthday: string | null; // "YYYY-MM-DD"
  deathday: string | null;
  place_of_birth: string | null;
}

export const tmdb = {
  movieGenres: () => tmdbFetch<{ genres: TmdbGenre[] }>("/genre/movie/list"),
  tvGenres: () => tmdbFetch<{ genres: TmdbGenre[] }>("/genre/tv/list"),
  // Popular movies/series released from `fromDate` onward (optionally capped
  // at `toDate`, so a bounded era like 1990-1999 doesn't re-walk through
  // everything from 2000-present that's already imported), most popular
  // first. Used instead of /movie|tv/top_rated so we can cover a whole date
  // range rather than a fixed top-N list.
  discoverMovies: (page: number, fromDate: string, toDate?: string) =>
    tmdbFetch<TmdbDiscoverResponse>("/discover/movie", {
      page,
      "primary_release_date.gte": fromDate,
      ...(toDate ? { "primary_release_date.lte": toDate } : {}),
      "vote_count.gte": 50,
      sort_by: "popularity.desc",
      include_adult: "false",
    }),
  discoverTv: (page: number, fromDate: string, toDate?: string) =>
    tmdbFetch<TmdbDiscoverResponse>("/discover/tv", {
      page,
      "first_air_date.gte": fromDate,
      ...(toDate ? { "first_air_date.lte": toDate } : {}),
      "vote_count.gte": 50,
      sort_by: "popularity.desc",
    }),
  movieDetails: (id: number) =>
    tmdbFetch<TmdbMovieDetails>(`/movie/${id}`, { append_to_response: "credits,watch/providers,recommendations" }),
  tvDetails: (id: number) =>
    tmdbFetch<TmdbTvDetails>(`/tv/${id}`, { append_to_response: "credits,watch/providers,recommendations" }),
  // Bare details call (no append_to_response) for the one-time voteCount
  // backfill -- skips fetching/parsing credits/providers/recommendations
  // that titles already have, so more titles fit in one batch.
  movieVotes: (id: number) => tmdbFetch<Pick<TmdbListItem, "vote_average" | "vote_count">>(`/movie/${id}`),
  tvVotes: (id: number) => tmdbFetch<Pick<TmdbListItem, "vote_average" | "vote_count">>(`/tv/${id}`),
  // Same bare-call idea, for the one-time runtime/collection/budget backfill
  // (titles imported before those fields existed).
  movieAttributes: (id: number) =>
    tmdbFetch<Pick<TmdbMovieDetails, "budget" | "runtime" | "belongs_to_collection">>(`/movie/${id}`),
  tvAttributes: (id: number) => tmdbFetch<Pick<TmdbTvDetails, "episode_run_time">>(`/tv/${id}`),
  // Fetched lazily, once, the first time a person's detail page is opened
  // (see /api/people/[id]) -- not part of the catalog import, so there's no
  // batch backfill for it and no rate-limit budget spent on people nobody
  // ever clicks into.
  personDetails: (id: number) => tmdbFetch<TmdbPersonDetails>(`/person/${id}`),
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
