const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function tmdbPosterUrl(path: string | null | undefined, size: "w92" | "w342" | "w500" = "w342") {
  if (!path) return null;
  // Anime posters (from Jikan/MAL) are stored as full URLs, not TMDB-style
  // relative paths -- pass them through as-is instead of double-prefixing.
  if (path.startsWith("http")) return path;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function tmdbProfileUrl(path: string | null | undefined, size: "w45" | "w185" = "w185") {
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

// TMDB review avatars are a known quirk: sometimes a normal TMDB-hosted
// path (like any other profile image), sometimes a full external URL
// (usually a Gravatar link) stuffed into the same field with a leading
// slash -- e.g. "/https://secure.gravatar.com/avatar/xxx.jpg". Detect and
// unwrap the latter instead of double-prefixing it with TMDB's image host.
export function tmdbReviewAvatarUrl(path: string | null | undefined) {
  if (!path) return null;
  const withoutLeadingSlash = path.replace(/^\//, "");
  if (withoutLeadingSlash.startsWith("http")) return withoutLeadingSlash;
  return tmdbProfileUrl(path, "w45");
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
  // TMDB convention: 0 = not set, 1 = female, 2 = male, 3 = non-binary.
  gender?: number;
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
  number_of_seasons: number;
  number_of_episodes: number;
  // "Returning Series" | "Planned" | "In Production" | "Ended" | "Canceled" | "Pilot"
  status: string;
  in_production: boolean;
  last_air_date: string | null; // "YYYY-MM-DD"
  next_episode_to_air: { air_date: string | null } | null;
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
  // TMDB convention: 0 = not set, 1 = female, 2 = male, 3 = non-binary.
  gender: number;
}

export interface TmdbVideo {
  key: string; // YouTube video id
  site: string; // "YouTube" | "Vimeo" | ...
  type: string; // "Trailer" | "Teaser" | "Clip" | ...
  official: boolean;
  published_at: string;
}

export interface TmdbVideosResponse {
  results: TmdbVideo[];
}

export interface TmdbReview {
  id: string;
  author: string;
  author_details: { avatar_path: string | null; rating: number | null };
  content: string;
  url: string;
  created_at: string;
}

export interface TmdbReviewsResponse {
  results: TmdbReview[];
}

// Best "Trailer" (falling back to "Teaser") among a title's YouTube videos --
// official over fan-made, most recently published first. Null when TMDB has
// nothing embeddable for this title.
export function pickTrailerKey(videos: TmdbVideo[]): string | null {
  const youtube = videos.filter((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
  youtube.sort((a, b) => {
    if (a.type !== b.type) return a.type === "Trailer" ? -1 : 1;
    if (a.official !== b.official) return a.official ? -1 : 1;
    return (b.published_at || "").localeCompare(a.published_at || "");
  });
  return youtube[0]?.key ?? null;
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
  tvAttributes: (id: number) =>
    tmdbFetch<
      Pick<
        TmdbTvDetails,
        | "episode_run_time"
        | "number_of_seasons"
        | "number_of_episodes"
        | "status"
        | "in_production"
        | "last_air_date"
        | "next_episode_to_air"
      >
    >(`/tv/${id}`),
  // Upcoming theatrical releases, region-scoped (see UPCOMING_REGION in
  // seedCatalog.ts) -- "Próximos estrenos" home section, cinema side.
  upcomingMovies: (page: number, region: string) =>
    tmdbFetch<TmdbDiscoverResponse>("/movie/upcoming", { page, region }),
  // Fetched lazily, once, the first time a person's detail page is opened
  // (see /api/people/[id]) -- not part of the catalog import, so there's no
  // batch backfill for it and no rate-limit budget spent on people nobody
  // ever clicks into.
  personDetails: (id: number) => tmdbFetch<TmdbPersonDetails>(`/person/${id}`),
  // Same lazy-fetch-on-view idea as personDetails, for trailers (see
  // /api/titles/[id]). `include_video_language` widens beyond just the
  // es-MX videos `language` would otherwise restrict to -- most trailers on
  // TMDB are only tagged "en", so without it most titles would show none.
  movieVideos: (id: number) =>
    tmdbFetch<TmdbVideosResponse>(`/movie/${id}/videos`, { include_video_language: "es,en,null" }),
  tvVideos: (id: number) =>
    tmdbFetch<TmdbVideosResponse>(`/tv/${id}/videos`, { include_video_language: "es,en,null" }),
  // Same lazy-fetch-once idea, for the "Reseñas" tab (see lib/reviews.ts).
  // Overrides the default es-MX `language` -- TMDB's review corpus is
  // overwhelmingly written in English regardless of the title's language,
  // and filtering to es-MX leaves almost every title with zero reviews.
  movieReviews: (id: number) => tmdbFetch<TmdbReviewsResponse>(`/movie/${id}/reviews`, { language: "en-US" }),
  tvReviews: (id: number) => tmdbFetch<TmdbReviewsResponse>(`/tv/${id}/reviews`, { language: "en-US" }),
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
