import { prisma } from "@/lib/prisma";
import type { TitleType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const WEIGHTS = {
  genre: 2,
  country: 2,
  cast: 3,
  director: 3,
  popularity: 0.5,
};

// The catalog can be thousands of titles now (TMDB + anime import); scoring
// every single unrated one on every request doesn't scale and was timing
// out the recommendations endpoint. Rank the most popular slice first --
// a title with a handful of votes buried in the tail was unlikely to be a
// great recommendation anyway, and popularity already factors into scoring.
const CANDIDATE_POOL_SIZE = 600;

export interface RecommendationResult {
  id: string;
  name: string;
  type: TitleType;
  releaseYear: number | null;
  posterPath: string | null;
  overview: string | null;
  genres: string[];
  directors: string[];
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

function fetchCandidates(where: Prisma.TitleWhereInput) {
  return prisma.title.findMany({
    where,
    orderBy: { popularity: "desc" },
    take: CANDIDATE_POOL_SIZE,
    include: {
      genres: { include: { genre: true } },
      cast: { include: { person: true }, orderBy: { order: "asc" }, take: 8 },
      crew: { include: { person: true } },
    },
  });
}

function scoreCandidates(
  candidates: CandidateTitle[],
  genreWeight: Map<number, number>,
  countryWeight: Map<string, number>,
  personScore: Map<string, number>,
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

    return {
      id: title.id,
      name: title.name,
      type: title.type,
      releaseYear: title.releaseYear,
      posterPath: title.posterPath,
      overview: title.overview,
      genres: title.genres.map((g) => g.genre.name),
      directors: title.crew.map((c) => c.person.name),
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
  opts: { filters?: Prisma.TitleWhereInput; limit?: number } = {},
): Promise<RecommendationResult[]> {
  const limit = opts.limit ?? 24;

  const [genrePrefs, countryPrefs, personRatings] = await Promise.all([
    prisma.userGenrePreference.findMany({ where: { userId } }),
    prisma.userCountryPreference.findMany({ where: { userId } }),
    prisma.userPersonRating.findMany({ where: { userId } }),
  ]);

  const genreWeight = new Map(genrePrefs.map((g) => [g.genreId, g.weight]));
  const countryWeight = new Map(countryPrefs.map((c) => [c.countryCode, c.weight]));
  const personScore = new Map(personRatings.map((p) => [p.personId, p.score]));

  const candidates = await fetchCandidates({
    ratings: { none: { userId } },
    ...(opts.filters ?? {}),
  });

  const results = scoreCandidates(candidates, genreWeight, countryWeight, personScore, "");
  return results.slice(0, limit);
}

// Joint recommendations for a group: preference/person weights are summed
// across members (so something several members like outranks something only
// one does), and anything any member has already seen is excluded outright
// -- the point is finding something new for the group to watch together.
export async function getGroupRecommendations(
  groupId: string,
  opts: { filters?: Prisma.TitleWhereInput; limit?: number } = {},
): Promise<RecommendationResult[]> {
  const limit = opts.limit ?? 24;

  const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } });
  const memberIds = members.map((m) => m.userId);
  if (memberIds.length === 0) return [];

  const [genrePrefs, countryPrefs, personRatings] = await Promise.all([
    prisma.userGenrePreference.findMany({ where: { userId: { in: memberIds } } }),
    prisma.userCountryPreference.findMany({ where: { userId: { in: memberIds } } }),
    prisma.userPersonRating.findMany({ where: { userId: { in: memberIds } } }),
  ]);

  const genreWeight = sumBy(genrePrefs, (g) => g.genreId, (g) => g.weight);
  const countryWeight = sumBy(countryPrefs, (c) => c.countryCode, (c) => c.weight);
  const personScore = sumBy(personRatings, (p) => p.personId, (p) => p.score);

  const candidates = await fetchCandidates({
    ratings: { none: { userId: { in: memberIds }, seen: true } },
    ...(opts.filters ?? {}),
  });

  const results = scoreCandidates(candidates, genreWeight, countryWeight, personScore, " del grupo");
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
