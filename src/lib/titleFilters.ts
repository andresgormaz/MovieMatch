import type { Prisma } from "@/generated/prisma/client";

// "Alta probabilidad de haber sido vistas" for "Calificar populares" -- a
// high TMDB vote count is the simplest proxy for mainstream-enough-that-
// you-probably-saw-it, without needing a separate curated list. Shared
// between the popular-rating page (query param) and the dashboard's
// pending-count badge, so the two never drift out of sync.
export const POPULAR_RATING_MIN_VOTES = 300;

export interface TitleFilterParams {
  q?: string;
  type?: "MOVIE" | "SERIES";
  yearFrom?: number;
  yearTo?: number;
  scoreFrom?: number;
  scoreTo?: number;
  votesMin?: number;
  budgetFrom?: number;
  budgetTo?: number;
  genreIds: number[];
  countries: string[];
  providerIds: number[];
  actorId?: string;
  directorId?: string;
}

function parseNum(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function parseTitleFilterParams(searchParams: URLSearchParams): TitleFilterParams {
  const typeParam = searchParams.get("type");
  const qParam = (searchParams.get("q") ?? "").trim();
  return {
    q: qParam.length > 0 ? qParam : undefined,
    type: typeParam === "MOVIE" || typeParam === "SERIES" ? typeParam : undefined,
    yearFrom: parseNum(searchParams.get("yearFrom")),
    yearTo: parseNum(searchParams.get("yearTo")),
    scoreFrom: parseNum(searchParams.get("scoreFrom")),
    scoreTo: parseNum(searchParams.get("scoreTo")),
    votesMin: parseNum(searchParams.get("votesMin")),
    budgetFrom: parseNum(searchParams.get("budgetFrom")),
    budgetTo: parseNum(searchParams.get("budgetTo")),
    genreIds: parseList(searchParams.get("genreIds")).map(Number).filter(Number.isFinite),
    countries: parseList(searchParams.get("countries")),
    providerIds: parseList(searchParams.get("providerIds")).map(Number).filter(Number.isFinite),
    actorId: searchParams.get("actorId") || undefined,
    directorId: searchParams.get("directorId") || undefined,
  };
}

// `userCountry` is per-user (from the session), not a URL param -- passed
// separately so the provider filter can be scoped to "available on one of
// these services IN THIS USER'S country" rather than any country.
export function buildTitleWhere(params: TitleFilterParams, userCountry?: string | null): Prisma.TitleWhereInput {
  return {
    ...(params.q ? { OR: [{ name: { contains: params.q } }, { originalName: { contains: params.q } }] } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.yearFrom !== undefined || params.yearTo !== undefined
      ? { releaseYear: { gte: params.yearFrom, lte: params.yearTo } }
      : {}),
    ...(params.scoreFrom !== undefined || params.scoreTo !== undefined
      ? { voteAverage: { gte: params.scoreFrom, lte: params.scoreTo } }
      : {}),
    ...(params.votesMin !== undefined ? { voteCount: { gte: params.votesMin } } : {}),
    ...(params.budgetFrom !== undefined || params.budgetTo !== undefined
      ? { budget: { gte: params.budgetFrom, lte: params.budgetTo } }
      : {}),
    ...(params.genreIds.length > 0 ? { genres: { some: { genreId: { in: params.genreIds } } } } : {}),
    ...(params.countries.length > 0 ? { originCountry: { in: params.countries } } : {}),
    ...(params.providerIds.length > 0 && userCountry
      ? { providers: { some: { providerId: { in: params.providerIds }, countryCode: userCountry } } }
      : {}),
    ...(params.actorId ? { cast: { some: { personId: params.actorId } } } : {}),
    ...(params.directorId
      ? { crew: { some: { personId: params.directorId, job: { in: ["Director", "Creator"] } } } }
      : {}),
  };
}
