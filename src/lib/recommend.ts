import { prisma } from "@/lib/prisma";
import type { TitleType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { displayTitleName } from "@/lib/titleDisplay";
import { isInTheaters } from "@/lib/inTheaters";
import { countryName } from "@/lib/countries";
import {
  classifyAudienceTier,
  classifyBudgetTier,
  classifyRuntimeBucket,
  classifyPopularityRange,
  type AudienceTier,
  type BudgetTier,
  type RuntimeBucket,
  type PopularityRange,
} from "@/lib/titleAttributes";
import { computeMergedPreferences, computeGroupMergedPreferences, type DerivedPreferences } from "@/lib/preferenceCounts";

// `noStreaming` is the only weighted term left -- every preference
// dimension (type, genre, actor, director, audience, budget, runtime,
// country, popularity, and the TMDB "similar" boost) is summed directly
// from preferenceCounts.ts, whose own +1-per-dimension rules already encode
// their scale. See the chat with the user (2026-08-23/24) requesting this
// direct-sum score, with normalization to follow once they've seen how it
// lands.
const WEIGHTS = {
  // Titles with no current streaming availability in the user's country are
  // usually either too new (still in theaters / not out yet) or otherwise
  // not actually watchable right now -- still worth surfacing if nothing
  // else scores well, but pushed down rather than recommended at face value.
  noStreaming: 4,
};

const AUDIENCE_LABELS: Record<AudienceTier, string> = {
  MAINSTREAM: "Producciones masivas",
  INDIE: "Producciones independientes",
};
const BUDGET_LABELS: Record<BudgetTier, string> = { MEGA: "Megaproducción", SMALL: "Bajo presupuesto" };
const RUNTIME_LABELS: Record<RuntimeBucket, string> = {
  SHORT: "Duración corta",
  MEDIUM: "Duración media",
  LONG: "Duración larga",
};
const POPULARITY_LABELS: Record<PopularityRange, string> = {
  LOW: "Poca popularidad (TMDB)",
  MID: "Popularidad media (TMDB)",
  HIGH: "Muy popular (TMDB)",
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
  reasons: string[];
}

// One line of the score breakdown: which preference contributed how many
// points. Only used by getTitleScoreBreakdown for the title detail page's
// "how was this score built" section -- the bulk recommendation list never
// builds this, to keep that response small.
export interface ScoreBreakdownEntry {
  label: string;
  points: number;
}

// `userCountry` scopes the provider relation to one country -- without it
// every stored country's availability would come back for each title.
function candidateInclude(userCountry?: string | null) {
  return {
    genres: { include: { genre: true } },
    cast: { include: { person: true }, orderBy: { order: "asc" as const }, take: 8 },
    crew: { include: { person: true } },
    // Empty placeholder country code when the user hasn't set one yet --
    // matches nothing, same effect as omitting providers entirely.
    providers: { where: { countryCode: userCountry ?? "" }, include: { provider: true } },
  } satisfies Prisma.TitleInclude;
}

type CandidateTitle = Awaited<ReturnType<typeof fetchCandidates>>[number];

function fetchCandidates(where: Prisma.TitleWhereInput, userCountry?: string | null) {
  return prisma.title.findMany({
    where,
    orderBy: { popularity: "desc" },
    take: CANDIDATE_POOL_SIZE,
    include: candidateInclude(userCountry),
  });
}

// The single source of truth for how a title's score is built -- used both
// to rank the recommendation list (score + reasons only) and to explain one
// title's score on its detail page (score + full breakdown). Keeping one
// function means the number shown on the card and the number the breakdown
// adds up to can never drift apart.
function scoreTitle(
  title: CandidateTitle,
  prefs: DerivedPreferences,
  reasonSuffix: string,
  hasUserCountry: boolean,
): { score: number; reasons: string[]; breakdown: ScoreBreakdownEntry[] } {
  let score = 0;
  const reasons: string[] = [];
  const breakdown: ScoreBreakdownEntry[] = [];

  for (const tg of title.genres) {
    const w = prefs.genre.get(tg.genreId) ?? 0;
    if (w !== 0) {
      score += w;
      breakdown.push({ label: `Género: ${tg.genre.name}`, points: w });
      if (w > 0) reasons.push(`Les gusta ${tg.genre.name}${reasonSuffix}`);
    }
  }

  if (title.originCountry) {
    const w = prefs.country.get(title.originCountry) ?? 0;
    if (w !== 0) {
      score += w;
      breakdown.push({ label: `País de origen: ${countryName(title.originCountry)}`, points: w });
    }
  }

  const typeW = prefs.type.get(title.type) ?? 0;
  if (typeW !== 0) {
    score += typeW;
    breakdown.push({ label: title.type === "MOVIE" ? "Tipo: películas" : "Tipo: series", points: typeW });
    if (typeW > 0) reasons.push(`Les gustan ${title.type === "MOVIE" ? "las películas" : "las series"}${reasonSuffix}`);
  }

  const audienceTier = classifyAudienceTier(title);
  if (audienceTier) {
    const w = prefs.audience.get(audienceTier) ?? 0;
    if (w !== 0) {
      score += w;
      breakdown.push({ label: AUDIENCE_LABELS[audienceTier], points: w });
      if (w > 0) {
        const label = audienceTier === "MAINSTREAM" ? "masivas" : "independientes";
        reasons.push(`Les gustan las producciones ${label}${reasonSuffix}`);
      }
    }
  }

  const budgetTier = classifyBudgetTier(title);
  if (budgetTier) {
    const w = prefs.budget.get(budgetTier) ?? 0;
    if (w !== 0) {
      score += w;
      breakdown.push({ label: BUDGET_LABELS[budgetTier], points: w });
      if (w > 0) {
        const label = budgetTier === "MEGA" ? "megaproducciones" : "producciones de bajo presupuesto";
        reasons.push(`Les gustan las ${label}${reasonSuffix}`);
      }
    }
  }

  const runtimeBucket = classifyRuntimeBucket(title);
  if (runtimeBucket) {
    const w = prefs.runtime.get(runtimeBucket) ?? 0;
    if (w !== 0) {
      score += w;
      breakdown.push({ label: RUNTIME_LABELS[runtimeBucket], points: w });
      if (w > 0) {
        const label = runtimeBucket === "SHORT" ? "cortas" : runtimeBucket === "LONG" ? "largas" : "de duración media";
        reasons.push(`Les gustan las duraciones ${label}${reasonSuffix}`);
      }
    }
  }

  const popularityRange = classifyPopularityRange(title);
  const popularityW = prefs.popularity.get(popularityRange) ?? 0;
  if (popularityW !== 0) {
    score += popularityW;
    breakdown.push({ label: POPULARITY_LABELS[popularityRange], points: popularityW });
  }

  for (const c of title.cast) {
    const s = prefs.actor.get(c.personId);
    if (s) {
      score += s;
      breakdown.push({ label: `Actor: ${c.person.name}`, points: s });
      if (s > 0) reasons.push(`Actúa ${c.person.name}, que les gusta${reasonSuffix}`);
    }
  }

  for (const c of title.crew) {
    const s = prefs.director.get(c.personId);
    if (s) {
      score += s;
      breakdown.push({ label: `Director: ${c.person.name}`, points: s });
      if (s > 0) reasons.push(`Dirige ${c.person.name}, que les gusta${reasonSuffix}`);
    }
  }

  const simKey = `${title.tmdbId}:${title.type}`;
  const simBoost = prefs.similar.get(simKey);
  if (simBoost) {
    score += simBoost;
    const reason = prefs.similarReasons.get(simKey);
    breakdown.push({
      label: reason?.name ? `Similar a "${reason.name}"` : "Similar a un título que les gustó",
      points: simBoost,
    });
    if (reason?.name) reasons.push(`Se parece a "${reason.name}", que les gustó${reasonSuffix}`);
  }

  if (hasUserCountry && title.providers.length === 0) {
    score -= WEIGHTS.noStreaming;
    breakdown.push({ label: "Sin streaming disponible en tu país", points: -WEIGHTS.noStreaming });
  }

  return { score, reasons, breakdown };
}

function scoreCandidates(
  candidates: CandidateTitle[],
  prefs: DerivedPreferences,
  reasonSuffix: string,
  useOriginalTitles: boolean,
  hasUserCountry: boolean,
): RecommendationResult[] {
  const results: RecommendationResult[] = candidates.map((title) => {
    const { score, reasons } = scoreTitle(title, prefs, reasonSuffix, hasUserCountry);

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

  const prefs = await computeMergedPreferences(userId, useOriginalTitles);

  const candidates = await fetchCandidates(
    {
      ratings: { none: { userId } },
      wishlist: { none: { userId } },
      ...(opts.filters ?? {}),
    },
    opts.userCountry,
  );

  const results = scoreCandidates(candidates, prefs, "", useOriginalTitles, Boolean(opts.userCountry));
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

  const prefs = await computeGroupMergedPreferences(memberIds, useOriginalTitles);

  const candidates = await fetchCandidates(
    {
      ratings: { none: { userId: { in: memberIds }, seen: true } },
      wishlist: { none: { userId: { in: memberIds } } },
      ...(opts.filters ?? {}),
    },
    opts.userCountry,
  );

  const results = scoreCandidates(candidates, prefs, " del grupo", useOriginalTitles, Boolean(opts.userCountry));
  return results.slice(0, limit);
}

// Temporary (per user request 2026-08-19): full itemized breakdown of one
// title's score, for the title detail page. Remove once the user's done
// sanity-checking the direct-sum formula against it.
export async function getTitleScoreBreakdown(
  userId: string,
  titleId: string,
  opts: { userCountry?: string | null; useOriginalTitles?: boolean } = {},
): Promise<{ score: number; breakdown: ScoreBreakdownEntry[] } | null> {
  const [prefs, title] = await Promise.all([
    computeMergedPreferences(userId, opts.useOriginalTitles ?? false),
    prisma.title.findUnique({ where: { id: titleId }, include: candidateInclude(opts.userCountry) }),
  ]);
  if (!title) return null;

  const { score, breakdown } = scoreTitle(title, prefs, "", Boolean(opts.userCountry));
  return { score, breakdown };
}
