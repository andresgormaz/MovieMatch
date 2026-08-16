import { prisma } from "@/lib/prisma";
import type { TitleType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const WEIGHTS = {
  genre: 2,
  country: 2,
  cast: 3,
  director: 3,
  popularity: 0.5,
  // TMDB's own "if you liked this, try these" (fetched alongside cast/crew
  // during import, see TitleSimilar) -- the closest free proxy to real
  // "users who liked X also liked Y" collaborative-filtering data.
  similar: 2.5,
};

// The catalog can be thousands of titles now (TMDB + anime import); scoring
// every single unrated one on every request doesn't scale and was timing
// out the recommendations endpoint. Rank the most popular slice first --
// a title with a handful of votes buried in the tail was unlikely to be a
// great recommendation anyway, and popularity already factors into scoring.
const CANDIDATE_POOL_SIZE = 600;

export interface RecommendationProvider {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface RecommendationResult {
  id: string;
  name: string;
  type: TitleType;
  releaseYear: number | null;
  posterPath: string | null;
  overview: string | null;
  genres: string[];
  directors: string[];
  voteAverage: number | null;
  providers: RecommendationProvider[];
  score: number;
  matchPercent: number;
  reasons: string[];
}

// Presentational "match %" (à la Netflix) derived from the raw score, not a
// calibrated probability -- just a friendlier way to show relative fit.
function toMatchPercent(score: number): number {
  return Math.max(35, Math.min(99, Math.round(50 + score * 6)));
}

type CandidateTitle = Awaited<ReturnType<typeof fetchCandidates>>[number];

// `userCountry` scopes the provider relation to one country -- without it
// every stored country's availability would come back for each title.
function fetchCandidates(where: Prisma.TitleWhereInput, userCountry?: string | null) {
  return prisma.title.findMany({
    where,
    orderBy: { popularity: "desc" },
    take: CANDIDATE_POOL_SIZE,
    include: {
      genres: { include: { genre: true } },
      cast: { include: { person: true }, orderBy: { order: "asc" }, take: 8 },
      crew: { include: { person: true } },
      // Empty placeholder country code when the user hasn't set one yet --
      // matches nothing, same effect as omitting providers entirely.
      providers: { where: { countryCode: userCountry ?? "" }, include: { provider: true } },
    },
  });
}

interface SimilarityBoost {
  boostByKey: Map<string, number>;
  reasonByKey: Map<string, { name: string; contribution: number }>;
}

// Combines TMDB's per-title "recommendations" (TitleSimilar, gathered during
// import) with the user's own ratings: for each title they rated highly,
// whatever TMDB says is similar to it gets a boost, proportional to how much
// they liked the source and how relevant TMDB ranked the relation. Titles
// recommended by several of the user's liked titles compound -- summing
// `likedRatings` per source instead of deduping also gives group scoring
// "more than one member liked this" weight for free.
async function buildSimilarityBoost(likedRatings: { titleId: string; score: number }[]): Promise<SimilarityBoost> {
  const boostByKey = new Map<string, number>();
  const reasonByKey = new Map<string, { name: string; contribution: number }>();

  const weightBySource = new Map<string, number>();
  for (const r of likedRatings) {
    const w = (r.score - 5) / 5; // 10 -> 1, 5 -> 0, below 5 contributes nothing
    if (w <= 0) continue;
    weightBySource.set(r.titleId, (weightBySource.get(r.titleId) ?? 0) + w);
  }
  if (weightBySource.size === 0) return { boostByKey, reasonByKey };

  const sourceIds = [...weightBySource.keys()];
  const [similarRows, sourceTitles] = await Promise.all([
    prisma.titleSimilar.findMany({ where: { titleId: { in: sourceIds } } }),
    prisma.title.findMany({ where: { id: { in: sourceIds } }, select: { id: true, name: true } }),
  ]);
  const nameBySource = new Map(sourceTitles.map((t) => [t.id, t.name]));

  for (const row of similarRows) {
    const ratingWeight = weightBySource.get(row.titleId);
    if (!ratingWeight) continue;
    const rankWeight = Math.max(0.1, 1 - row.rank / 20); // TMDB's most relevant pick counts most
    const contribution = WEIGHTS.similar * ratingWeight * rankWeight;

    const key = `${row.relatedTmdbId}:${row.relatedType}`;
    boostByKey.set(key, (boostByKey.get(key) ?? 0) + contribution);

    const existing = reasonByKey.get(key);
    if (!existing || contribution > existing.contribution) {
      reasonByKey.set(key, { name: nameBySource.get(row.titleId) ?? "", contribution });
    }
  }

  return { boostByKey, reasonByKey };
}

function scoreCandidates(
  candidates: CandidateTitle[],
  genreWeight: Map<number, number>,
  countryWeight: Map<string, number>,
  personScore: Map<string, number>,
  similarity: SimilarityBoost,
  reasonSuffix: string,
): RecommendationResult[] {
  const results: RecommendationResult[] = candidates.map((title) => {
    let score = 0;
    const reasons: string[] = [];

    for (const tg of title.genres) {
      const w = genreWeight.get(tg.genreId) ?? 0;
      if (w !== 0) {
        score += w * WEIGHTS.genre;
        if (w > 0) reasons.push(`Les gusta ${tg.genre.name}${reasonSuffix}`);
      }
    }

    if (title.originCountry) {
      const w = countryWeight.get(title.originCountry) ?? 0;
      score += w * WEIGHTS.country;
    }

    for (const c of title.cast) {
      const s = personScore.get(c.personId);
      if (s !== undefined && s !== 0) {
        score += s * WEIGHTS.cast;
        if (s > 0) reasons.push(`Actúa ${c.person.name}, que les gusta${reasonSuffix}`);
      }
    }

    for (const c of title.crew) {
      const s = personScore.get(c.personId);
      if (s !== undefined && s !== 0) {
        score += s * WEIGHTS.director;
        if (s > 0) reasons.push(`Dirige ${c.person.name}, que les gusta${reasonSuffix}`);
      }
    }

    if (title.voteAverage) {
      score += (title.voteAverage / 10) * WEIGHTS.popularity;
    }

    const simKey = `${title.tmdbId}:${title.type}`;
    const simBoost = similarity.boostByKey.get(simKey);
    if (simBoost) {
      score += simBoost;
      const reason = similarity.reasonByKey.get(simKey);
      if (reason?.name) reasons.push(`Se parece a "${reason.name}", que les gustó${reasonSuffix}`);
    }

    return {
      id: title.id,
      name: title.name,
      type: title.type,
      releaseYear: title.releaseYear,
      posterPath: title.posterPath,
      overview: title.overview,
      genres: title.genres.map((g) => g.genre.name),
      directors: title.crew.map((c) => c.person.name),
      voteAverage: title.voteAverage,
      providers: title.providers.map((p) => ({
        id: p.provider.id,
        name: p.provider.name,
        logoPath: p.provider.logoPath,
      })),
      score,
      matchPercent: toMatchPercent(score),
      reasons: reasons.slice(0, 3),
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
}

export async function getRecommendations(
  userId: string,
  opts: { filters?: Prisma.TitleWhereInput; limit?: number; userCountry?: string | null } = {},
): Promise<RecommendationResult[]> {
  const limit = opts.limit ?? 24;

  const [genrePrefs, countryPrefs, personRatings, titleRatings] = await Promise.all([
    prisma.userGenrePreference.findMany({ where: { userId } }),
    prisma.userCountryPreference.findMany({ where: { userId } }),
    prisma.userPersonRating.findMany({ where: { userId } }),
    prisma.userTitleRating.findMany({
      where: { userId, seen: true, score: { not: null } },
      select: { titleId: true, score: true },
    }),
  ]);

  const genreWeight = new Map(genrePrefs.map((g) => [g.genreId, g.weight]));
  const countryWeight = new Map(countryPrefs.map((c) => [c.countryCode, c.weight]));
  const personScore = new Map(personRatings.map((p) => [p.personId, p.score]));
  const similarity = await buildSimilarityBoost(
    titleRatings.map((r) => ({ titleId: r.titleId, score: r.score! })),
  );

  const candidates = await fetchCandidates(
    {
      ratings: { none: { userId } },
      wishlist: { none: { userId } },
      ...(opts.filters ?? {}),
    },
    opts.userCountry,
  );

  const results = scoreCandidates(candidates, genreWeight, countryWeight, personScore, similarity, "");
  return results.slice(0, limit);
}

// Joint recommendations for a group: preference/person weights are summed
// across members (so something several members like outranks something only
// one does), and anything any member has already seen is excluded outright
// -- the point is finding something new for the group to watch together.
export async function getGroupRecommendations(
  groupId: string,
  opts: { filters?: Prisma.TitleWhereInput; limit?: number; userCountry?: string | null } = {},
): Promise<RecommendationResult[]> {
  const limit = opts.limit ?? 24;

  const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } });
  const memberIds = members.map((m) => m.userId);
  if (memberIds.length === 0) return [];

  const [genrePrefs, countryPrefs, personRatings, titleRatings] = await Promise.all([
    prisma.userGenrePreference.findMany({ where: { userId: { in: memberIds } } }),
    prisma.userCountryPreference.findMany({ where: { userId: { in: memberIds } } }),
    prisma.userPersonRating.findMany({ where: { userId: { in: memberIds } } }),
    prisma.userTitleRating.findMany({
      where: { userId: { in: memberIds }, seen: true, score: { not: null } },
      select: { titleId: true, score: true },
    }),
  ]);

  const genreWeight = sumBy(genrePrefs, (g) => g.genreId, (g) => g.weight);
  const countryWeight = sumBy(countryPrefs, (c) => c.countryCode, (c) => c.weight);
  const personScore = sumBy(personRatings, (p) => p.personId, (p) => p.score);
  const similarity = await buildSimilarityBoost(
    titleRatings.map((r) => ({ titleId: r.titleId, score: r.score! })),
  );

  const candidates = await fetchCandidates(
    {
      ratings: { none: { userId: { in: memberIds }, seen: true } },
      wishlist: { none: { userId: { in: memberIds } } },
      ...(opts.filters ?? {}),
    },
    opts.userCountry,
  );

  const results = scoreCandidates(candidates, genreWeight, countryWeight, personScore, similarity, " del grupo");
  return results.slice(0, limit);
}

function sumBy<T, K>(items: T[], key: (item: T) => K, value: (item: T) => number): Map<K, number> {
  const map = new Map<K, number>();
  for (const item of items) {
    const k = key(item);
    map.set(k, (map.get(k) ?? 0) + value(item));
  }
  return map;
}
