import { prisma } from "@/lib/prisma";
import type { TitleType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { displayTitleName } from "@/lib/titleDisplay";
import { isInTheaters } from "@/lib/inTheaters";
import { classifyAudienceTier, classifyBudgetTier, classifyRuntimeBucket, classifyPopularityRange } from "@/lib/titleAttributes";
import { computeMergedPreferences, computeGroupMergedPreferences, type DerivedPreferences } from "@/lib/preferenceCounts";

// `type` (movie/series) and `noStreaming` are the only weighted terms left
// -- everything else (genre, actor/director, audience, budget, runtime,
// country, popularity, and now the TMDB "similar" boost) is summed directly
// from preferenceCounts.ts, whose own +1-per-dimension rules already encode
// their scale. See the chat with the user (2026-08-23) requesting a first
// pass at this direct-sum score, with normalization to follow once they've
// seen how it lands.
const WEIGHTS = {
  type: 2,
  // Titles with no current streaming availability in the user's country are
  // usually either too new (still in theaters / not out yet) or otherwise
  // not actually watchable right now -- still worth surfacing if nothing
  // else scores well, but pushed down rather than recommended at face value.
  noStreaming: 4,
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
  backdropPath: string | null;
  overview: string | null;
  genres: string[];
  directors: string[];
  voteAverage: number | null;
  voteCount: number | null;
  inTheaters: boolean;
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

function scoreCandidates(
  candidates: CandidateTitle[],
  prefs: DerivedPreferences,
  typeWeight: Map<TitleType, number>,
  reasonSuffix: string,
  useOriginalTitles: boolean,
  hasUserCountry: boolean,
): RecommendationResult[] {
  const results: RecommendationResult[] = candidates.map((title) => {
    let score = 0;
    const reasons: string[] = [];

    for (const tg of title.genres) {
      const w = prefs.genre.get(tg.genreId) ?? 0;
      if (w !== 0) {
        score += w;
        if (w > 0) reasons.push(`Les gusta ${tg.genre.name}${reasonSuffix}`);
      }
    }

    if (title.originCountry) {
      score += prefs.country.get(title.originCountry) ?? 0;
    }

    const typeW = typeWeight.get(title.type) ?? 0;
    if (typeW !== 0) {
      score += typeW * WEIGHTS.type;
      if (typeW > 0) reasons.push(`Les gustan ${title.type === "MOVIE" ? "las películas" : "las series"}${reasonSuffix}`);
    }

    const audienceTier = classifyAudienceTier(title);
    if (audienceTier) {
      const w = prefs.audience.get(audienceTier) ?? 0;
      if (w > 0) {
        score += w;
        const label = audienceTier === "MAINSTREAM" ? "masivas" : "independientes";
        reasons.push(`Les gustan las producciones ${label}${reasonSuffix}`);
      }
    }

    const budgetTier = classifyBudgetTier(title);
    if (budgetTier) {
      const w = prefs.budget.get(budgetTier) ?? 0;
      if (w > 0) {
        score += w;
        const label = budgetTier === "MEGA" ? "megaproducciones" : "producciones de bajo presupuesto";
        reasons.push(`Les gustan las ${label}${reasonSuffix}`);
      }
    }

    const runtimeBucket = classifyRuntimeBucket(title);
    if (runtimeBucket) {
      const w = prefs.runtime.get(runtimeBucket) ?? 0;
      if (w > 0) {
        score += w;
        const label = runtimeBucket === "SHORT" ? "cortas" : runtimeBucket === "LONG" ? "largas" : "de duración media";
        reasons.push(`Les gustan las duraciones ${label}${reasonSuffix}`);
      }
    }

    score += prefs.popularity.get(classifyPopularityRange(title)) ?? 0;

    for (const c of title.cast) {
      const s = prefs.person.get(c.personId);
      if (s) {
        score += s;
        if (s > 0) reasons.push(`Actúa ${c.person.name}, que les gusta${reasonSuffix}`);
      }
    }

    for (const c of title.crew) {
      const s = prefs.person.get(c.personId);
      if (s) {
        score += s;
        if (s > 0) reasons.push(`Dirige ${c.person.name}, que les gusta${reasonSuffix}`);
      }
    }

    const simKey = `${title.tmdbId}:${title.type}`;
    const simBoost = prefs.similar.get(simKey);
    if (simBoost) {
      score += simBoost;
      const reason = prefs.similarReasons.get(simKey);
      if (reason?.name) reasons.push(`Se parece a "${reason.name}", que les gustó${reasonSuffix}`);
    }

    if (hasUserCountry && title.providers.length === 0) {
      score -= WEIGHTS.noStreaming;
    }

    return {
      id: title.id,
      name: displayTitleName(title, useOriginalTitles),
      type: title.type,
      releaseYear: title.releaseYear,
      posterPath: title.posterPath,
      backdropPath: title.backdropPath,
      overview: title.overview,
      genres: title.genres.map((g) => g.genre.name),
      directors: title.crew.map((c) => c.person.name),
      voteAverage: title.voteAverage,
      voteCount: title.voteCount,
      inTheaters: isInTheaters(title.type, title.releaseDate),
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
  opts: {
    filters?: Prisma.TitleWhereInput;
    limit?: number;
    userCountry?: string | null;
    useOriginalTitles?: boolean;
  } = {},
): Promise<RecommendationResult[]> {
  const limit = opts.limit ?? 24;
  const useOriginalTitles = opts.useOriginalTitles ?? false;

  const [typePrefs, prefs] = await Promise.all([
    prisma.userTypePreference.findMany({ where: { userId } }),
    computeMergedPreferences(userId, useOriginalTitles),
  ]);

  const typeWeight = new Map(typePrefs.map((t) => [t.type, t.weight]));

  const candidates = await fetchCandidates(
    {
      ratings: { none: { userId } },
      wishlist: { none: { userId } },
      ...(opts.filters ?? {}),
    },
    opts.userCountry,
  );

  const results = scoreCandidates(candidates, prefs, typeWeight, "", useOriginalTitles, Boolean(opts.userCountry));
  return results.slice(0, limit);
}

// Joint recommendations for a group: preference/person weights are summed
// across members (so something several members like outranks something only
// one does), and anything any member has already seen is excluded outright
// -- the point is finding something new for the group to watch together.
export async function getGroupRecommendations(
  groupId: string,
  opts: {
    filters?: Prisma.TitleWhereInput;
    limit?: number;
    userCountry?: string | null;
    useOriginalTitles?: boolean;
  } = {},
): Promise<RecommendationResult[]> {
  const limit = opts.limit ?? 24;
  const useOriginalTitles = opts.useOriginalTitles ?? false;

  const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } });
  const memberIds = members.map((m) => m.userId);
  if (memberIds.length === 0) return [];

  const [typePrefs, prefs] = await Promise.all([
    prisma.userTypePreference.findMany({ where: { userId: { in: memberIds } } }),
    computeGroupMergedPreferences(memberIds, useOriginalTitles),
  ]);

  const typeWeight = sumBy(typePrefs, (t) => t.type, (t) => t.weight);

  const candidates = await fetchCandidates(
    {
      ratings: { none: { userId: { in: memberIds }, seen: true } },
      wishlist: { none: { userId: { in: memberIds } } },
      ...(opts.filters ?? {}),
    },
    opts.userCountry,
  );

  const results = scoreCandidates(candidates, prefs, typeWeight, " del grupo", useOriginalTitles, Boolean(opts.userCountry));
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
