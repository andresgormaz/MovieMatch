// Plain types/constants shared between the client-side filter UI
// (src/components/explore/FilterPanel.tsx, which re-exports these for
// backward-compat) and server code that needs the same shape without
// pulling in a "use client" module (e.g. the saved-filters API routes).

export interface PersonOption {
  id: string;
  name: string;
  photoUrl: string | null;
}

export type SortOption = "popularity" | "year" | "score" | "votes";

export interface CatalogFilters {
  q: string;
  type: "" | "MOVIE" | "SERIES";
  yearFrom: number | "";
  yearTo: number | "";
  scoreFrom: number | "";
  scoreTo: number | "";
  votesMin: number | "";
  budgetFrom: number | "";
  budgetTo: number | "";
  genreIds: number[];
  countries: string[];
  providerIds: number[];
  actor: PersonOption | null;
  director: PersonOption | null;
  sort: SortOption;
}

export const EMPTY_CATALOG_FILTERS: CatalogFilters = {
  q: "",
  type: "",
  yearFrom: "",
  yearTo: "",
  scoreFrom: "",
  scoreTo: "",
  votesMin: "",
  budgetFrom: "",
  budgetTo: "",
  genreIds: [],
  countries: [],
  providerIds: [],
  actor: null,
  director: null,
  sort: "popularity",
};

export function buildCatalogQuery(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.type) params.set("type", filters.type);
  if (filters.yearFrom !== "") params.set("yearFrom", String(filters.yearFrom));
  if (filters.yearTo !== "") params.set("yearTo", String(filters.yearTo));
  if (filters.scoreFrom !== "") params.set("scoreFrom", String(filters.scoreFrom));
  if (filters.scoreTo !== "") params.set("scoreTo", String(filters.scoreTo));
  if (filters.votesMin !== "") params.set("votesMin", String(filters.votesMin));
  if (filters.budgetFrom !== "") params.set("budgetFrom", String(filters.budgetFrom));
  if (filters.budgetTo !== "") params.set("budgetTo", String(filters.budgetTo));
  if (filters.genreIds.length) params.set("genreIds", filters.genreIds.join(","));
  if (filters.countries.length) params.set("countries", filters.countries.join(","));
  if (filters.providerIds.length) params.set("providerIds", filters.providerIds.join(","));
  if (filters.actor) params.set("actorId", filters.actor.id);
  if (filters.director) params.set("directorId", filters.director.id);
  return params;
}
