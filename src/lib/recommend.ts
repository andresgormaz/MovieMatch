import { prisma } from "@/lib/prisma";
import type { TitleType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { displayTitleName } from "@/lib/titleDisplay";
import { isInTheaters } from "@/lib/inTheaters";
import { classifyAudienceTier, classifyBudgetTier, classifyRuntimeBucket, classifyPopularityRange } from "@/lib/titleAttributes";
import { computeMergedPreferences, computeGroupMergedPreferences, type DerivedPreferences } from "@/lib/preferenceCounts";

// `type` (movie/series) and `similar`/`noStreaming` are the only weighted
// terms left -- everything else (genre, actor/director, audience, budget,
// runtime, country, popularity) is summed directly from preferenceCounts.ts,
// whose own +1-per-dimension rules already encode their scale. See the chat
// with the user (2026-08-23) requesting a first pass at this direct-sum
// score, with normalization to follow once they've seen how it lands.
const WEIGHTS = {
  type: 2,
  // TMDB's own "if you liked this, try these" (fetched alongside cast/crew
  // during import, see TitleSimilar) -- the closest free proxy to real
  // "users who liked X also liked Y" collaborative-filtering data.
  similar: 2.5,
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
async function buildSimilarityBoost(
  likedRatings: { titleId: string; score: number }[],
  useOriginalTitles: boolean,
): Promise<SimilarityBoost> {
  const boostByKey = new Map<string, number>();
  const reasonByKey = new Map<string, { name: string; contribution: number }>();

  const weightBySource = new Map<string, number>();
  for (const r of likedRatings) {
    const w = (r.score - 3) / 2; // 5 stars -> 1, 3 -> 0, below 3 contributes nothing
    if (w <= 0) continue;
    weightBySource.set(r.titleId, (weightBySource.get(r.titleId) ?? 0) + w);
  }
  if (weightBySource.size === 0) return { boostByKey, reasonByKey };

  const sourceIds = [...weightBySource.keys()];
  const [similarRows, sourceTitles] = await Promise.all([
    prisma.titleSimilar.findMany({ where: { titleId: { in: sourceIds } } }),
    prisma.title.findMany({
      where: { id: { in: sourceIds } },
      select: { id: true, name: true, originalName: true },
    }),
  ]);
  const nameBySource = new Map(sourceTitles.map((t) => [t.id, displayTitleName(t, useOriginalTitles)]));

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
  prefs: DerivedPreferences,
  typeWeight: Map<TitleType, number>,
  similarity: SimilarityBoost,
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
    const simBoost = similarity.boostByKey.get(simKey);
    if (simBoost) {
      score += simBoost;
      const reason = similarity.reasonByKey.get(simKey);
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

  const [typePrefs, titleRatings, prefs] = await Promise.all([
    prisma.userTypePreference.findMany({ where: { userId } }),
    prisma.userTitleRating.findMany({
      where: { userId, seen: true, score: { not: null } },
      select: { titleId: true, score: true },
    }),
    computeMergedPreferences(userId),
  ]);

  const typeWeight = new Map(typePrefs.map((t) => [t.type, t.weight]));
  const similarity = await buildSimilarityBoost(
    titleRatings.map((r) => ({ titleId: r.titleId, score: r.score! })),
    useOriginalTitles,
  );

  const candidates = await fetchCandidates(
    {
      ratings: { none: { userId } },
      wishlist: { none: { userId } },
      ...(opts.filters ?? {}),
    },
    opts.userCountry,
  );

  const results = scoreCandidates(
    candidates,
    prefs,
    typeWeight,
    similarity,
    "",
    useOriginalTitles,
    Boolean(opts.userCountry),
  );
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

  const [typePrefs, titleRatings, prefs] = await Promise.all([
    prisma.userTypePreference.findMany({ where: { userId: { in: memberIds } } }),
    prisma.userTitleRating.findMany({
      where: { userId: { in: memberIds }, seen: true, score: { not: null } },
      select: { titleId: true, score: true },
    }),
    computeGroupMergedPreferences(memberIds),
  ]);

  const typeWeight = sumBy(typePrefs, (t) => t.type, (t) => t.weight);
  const similarity = await buildSimilarityBoost(
    titleRatings.map((r) => ({ titleId: r.titleId, score: r.score! })),
    useOriginalTitles,
  );

  const candidates = await fetchCandidates(
    {
      ratings: { none: { userId: { in: memberIds }, seen: true } },
      wishlist: { none: { userId: { in: memberIds } } },
      ...(opts.filters ?? {}),
    },
    opts.userCountry,
  );

  const results = scoreCandidates(
    candidates,
    prefs,
    typeWeight,
    similarity,
    " del grupo",
    useOriginalTitles,
    Boolean(opts.userCountry),
  );
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
