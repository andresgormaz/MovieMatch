const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function tmdbPosterUrl(path: string | null | undefined, size: "w342" | "w500" = "w342") {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function tmdbProfileUrl(path: string | null | undefined, size: "w185" = "w185") {
  if (!path) return null;
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
  url.searchParams.set("language", "es-ES");
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

export interface TmdbMovieDetails extends TmdbListItem {
  genres: TmdbGenre[];
  production_countries: TmdbCountry[];
  credits: TmdbCredits;
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
  credits: TmdbCredits;
}

export const tmdb = {
  movieGenres: () => tmdbFetch<{ genres: TmdbGenre[] }>("/genre/movie/list"),
  tvGenres: () => tmdbFetch<{ genres: TmdbGenre[] }>("/genre/tv/list"),
  topRatedMovies: (page: number) =>
    tmdbFetch<{ results: TmdbListItem[]; total_pages: number }>("/movie/top_rated", { page }),
  topRatedTv: (page: number) =>
    tmdbFetch<{ results: TmdbListItem[]; total_pages: number }>("/tv/top_rated", { page }),
  movieDetails: (id: number) =>
    tmdbFetch<TmdbMovieDetails>(`/movie/${id}`, { append_to_response: "credits" }),
  tvDetails: (id: number) =>
    tmdbFetch<TmdbTvDetails>(`/tv/${id}`, { append_to_response: "credits" }),
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
