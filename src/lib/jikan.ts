// Client for Jikan (https://jikan.moe), a free community-run REST API over
// MyAnimeList data. Used for anime instead of Crunchyroll, which has no
// public API for third-party apps -- integrating with it directly would
// mean scraping/reverse-engineered endpoints against their ToS.
const JIKAN_BASE = "https://api.jikan.moe/v4";

// Anime titles/people are stored in the same Title/Person tables as
// TMDB-sourced ones, namespaced by adding this to MAL's own id, so they can
// never collide with a real TMDB id (all comfortably under this value).
export const ANIME_ID_OFFSET = 900_000_000;
export const ANIME_PAGE_SIZE = 25; // fixed by the Jikan API

export interface JikanAnime {
  mal_id: number;
  title: string;
  title_english: string | null;
  synopsis: string | null;
  type: string | null; // "TV" | "Movie" | "OVA" | "ONA" | "Special" | "Music" | null
  score: number | null;
  scored_by: number | null;
  year: number | null;
  images: { jpg: { large_image_url: string | null } };
  genres: { mal_id: number; name: string }[];
  studios: { mal_id: number; name: string }[];
}

interface JikanListResponse {
  data: JikanAnime[];
  pagination: { has_next_page: boolean; current_page: number };
}

async function jikanFetch(path: string, params: Record<string, string | number>): Promise<JikanListResponse> {
  const url = new URL(`${JIKAN_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jikan ${path} -> ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as JikanListResponse;
}

export const jikan = {
  // Most popular first (MAL's "popularity" field is a rank -- 1 is most
  // popular -- so ascending sort surfaces it first). sfw=true excludes
  // adult content.
  listAnime: (page: number) => jikanFetch("/anime", { page, order_by: "popularity", sort: "asc", sfw: "true" }),
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Jikan genre names are in English and use MAL's own taxonomy (including
// demographics like "Shounen"), which doesn't line up with TMDB's Spanish
// genre list. Map the ones with an obvious equivalent onto the existing
// genre so filtering "Comedia" also catches anime comedies; anything else
// gets created as its own genre the first time it's seen.
const GENRE_NAME_MAP: Record<string, string> = {
  Action: "Acción",
  Adventure: "Aventura",
  Comedy: "Comedia",
  Drama: "Drama",
  Fantasy: "Fantasía",
  Horror: "Terror",
  Mystery: "Misterio",
  Romance: "Romance",
  "Sci-Fi": "Ciencia ficción",
  Suspense: "Suspense",
  Thriller: "Suspense",
  Music: "Música",
  Historical: "Historia",
  Military: "Bélica",
  Police: "Crimen",
};

export function translateAnimeGenre(name: string): string {
  return GENRE_NAME_MAP[name] ?? name;
}
