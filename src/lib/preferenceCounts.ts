import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
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

// Replaces the old "bump a stored running weight on every vs win/favorite"
// model for genre, actor/director, mainstream/indie, budget, runtime,
// country, and popularity: every score here is recomputed fresh, directly
// from the two raw sources of truth -- "vs" wins (OnboardingChoice) and
// 4-5-star ratings (UserTitleRating) -- instead of an incrementally-updated
// column. Nothing to drift, nothing to migrate when the formula changes.
// Manual edits on "Mis gustos" still exist as an override layer on top (see
// mergeManual below); this module never writes to those tables, only reads
// them elsewhere and merges. `type` (movie/series) and the TMDB "similar"
// boost are untouched by this -- they keep working exactly as before.

const EVIDENCE_SELECT = {
  id: true,
  voteCount: true,
  budget: true,
  runtime: true,
  originCountry: true,
  genres: { select: { genreId: true } },
  cast: { orderBy: { order: "asc" as const }, take: 3, select: { personId: true } },
  crew: { where: { job: { in: ["Director", "Creator"] } }, select: { personId: true } },
} satisfies Prisma.TitleSelect;

export interface DerivedPreferences {
  genre: Map<number, number>;
  person: Map<string, number>;
  audience: Map<AudienceTier, number>;
  budget: Map<BudgetTier, number>;
  runtime: Map<RuntimeBucket, number>;
  country: Map<string, number>;
  popularity: Map<PopularityRange, number>;
}

function emptyPreferences(): DerivedPreferences {
  return {
    genre: new Map(),
    person: new Map(),
    audience: new Map(),
    budget: new Map(),
    runtime: new Map(),
    country: new Map(),
    popularity: new Map(),
  };
}

// A person needs 3 corroborating instances (a "vs" win or a 4-5-star
// rating, counted together) before a preference forms -- "an initial
// trend" -- and each instance past that adds one more full point: the 4th
// instance already totals 2, the 5th totals 3, and so on.
function personScoreFromCount(count: number): number {
  return count >= 3 ? count - 2 : 0;
}

// Winner-takes-all for a fixed set of buckets (budget/runtime/country/
// popularity): whichever bucket has the strictly-highest combined count of
// "vs" wins + 4-5-star ratings gets +1, every other bucket gets 0. A tie
// (including "no evidence at all") means no preference either way.
function winnerTakesAll<K>(counts: Map<K, number>): Map<K, number> {
  let bestKey: K | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
      tied = false;
    } else if (count === bestCount && count > 0) {
      tied = true;
    }
  }
  const result = new Map<K, number>();
  if (bestKey !== null && !tied) result.set(bestKey, 1);
  return result;
}

// Mainstream/indie isn't winner-takes-all like the others -- it's a ratio
// with a deliberate "no strong lean either way" middle band (0.8-2), so a
// roughly even mix of masivas/indie doesn't flip to a hard preference.
function audiencePreferenceFromCounts(counts: Map<AudienceTier, number>): Map<AudienceTier, number> {
  const mainstream = counts.get("MAINSTREAM") ?? 0;
  const indie = counts.get("INDIE") ?? 0;
  const result = new Map<AudienceTier, number>();
  if (mainstream === 0 && indie === 0) return result;
  const ratio = indie === 0 ? Infinity : mainstream / indie;
  if (ratio > 2) result.set("MAINSTREAM", 1);
  else if (ratio < 0.8) result.set("INDIE", 1);
  return result;
}

// The core derivation: gathers every "vs" win and every 4-5-star rating,
// tallies each qualifying title's attributes into raw counts, then applies
// each dimension's own rule above. A title that both won a "vs" round and
// was later rated highly counts toward both events independently -- no
// deduping across the two sources, and (unlike the old actor/director
// model) no franchise/collection deduping either.
export async function computeDerivedPreferences(userId: string): Promise<DerivedPreferences> {
  const [wins, highRatings] = await Promise.all([
    prisma.onboardingChoice.findMany({ where: { userId, skipped: false }, select: { winnerId: true } }),
    prisma.userTitleRating.findMany({ where: { userId, seen: true, score: { gte: 4 } }, select: { titleId: true } }),
  ]);

  const evidenceIds = [...new Set([...wins.map((w) => w.winnerId), ...highRatings.map((r) => r.titleId)])];
  if (evidenceIds.length === 0) return emptyPreferences();

  const titles = await prisma.title.findMany({ where: { id: { in: evidenceIds } }, select: EVIDENCE_SELECT });
  const titleById = new Map(titles.map((t) => [t.id, t]));

  const genreCounts = new Map<number, number>();
  const personCounts = new Map<string, number>();
  const audienceCounts = new Map<AudienceTier, number>();
  const budgetCounts = new Map<BudgetTier, number>();
  const runtimeCounts = new Map<RuntimeBucket, number>();
  const countryCounts = new Map<string, number>();
  const popularityCounts = new Map<PopularityRange, number>();

  function tally(titleId: string) {
    const t = titleById.get(titleId);
    if (!t) return;

    for (const g of t.genres) genreCounts.set(g.genreId, (genreCounts.get(g.genreId) ?? 0) + 1);

    for (const personId of new Set([...t.cast, ...t.crew].map((c) => c.personId))) {
      personCounts.set(personId, (personCounts.get(personId) ?? 0) + 1);
    }

    const audience = classifyAudienceTier(t);
    if (audience) audienceCounts.set(audience, (audienceCounts.get(audience) ?? 0) + 1);

    const budget = classifyBudgetTier(t);
    if (budget) budgetCounts.set(budget, (budgetCounts.get(budget) ?? 0) + 1);

    const runtime = classifyRuntimeBucket(t);
    if (runtime) runtimeCounts.set(runtime, (runtimeCounts.get(runtime) ?? 0) + 1);

    if (t.originCountry) countryCounts.set(t.originCountry, (countryCounts.get(t.originCountry) ?? 0) + 1);

    const popularity = classifyPopularityRange(t);
    popularityCounts.set(popularity, (popularityCounts.get(popularity) ?? 0) + 1);
  }

  for (const w of wins) tally(w.winnerId);
  for (const r of highRatings) tally(r.titleId);

  const person = new Map<string, number>();
  for (const [personId, count] of personCounts) {
    const score = personScoreFromCount(count);
    if (score > 0) person.set(personId, score);
  }

  return {
    genre: genreCounts,
    person,
    audience: audiencePreferenceFromCounts(audienceCounts),
    budget: winnerTakesAll(budgetCounts),
    runtime: winnerTakesAll(runtimeCounts),
    country: winnerTakesAll(countryCounts),
    popularity: winnerTakesAll(popularityCounts),
  };
}

// How many times each genre has been *shown* in a "vs" round (win or lose)
// -- used to steer onboarding/vs candidate selection toward genres that
// haven't had a fair shot yet, instead of ones the algorithm merely thinks
// you already like. Based on completed rounds (OnboardingChoice); a "no la
// he visto" swap that never reaches a winner doesn't count -- there's no
// log of what was swapped out before completion.
export async function computeGenreShownCounts(userId: string): Promise<Map<number, number>> {
  const choices = await prisma.onboardingChoice.findMany({
    where: { userId },
    select: { titleAId: true, titleBId: true },
  });
  if (choices.length === 0) return new Map();

  const titleIds = [...new Set(choices.flatMap((c) => [c.titleAId, c.titleBId]))];
  const genreRows = await prisma.titleGenre.findMany({
    where: { titleId: { in: titleIds } },
    select: { titleId: true, genreId: true },
  });
  const genresByTitle = new Map<string, number[]>();
  for (const row of genreRows) {
    if (!genresByTitle.has(row.titleId)) genresByTitle.set(row.titleId, []);
    genresByTitle.get(row.titleId)!.push(row.genreId);
  }

  const shown = new Map<number, number>();
  for (const c of choices) {
    for (const titleId of [c.titleAId, c.titleBId]) {
      for (const genreId of genresByTitle.get(titleId) ?? []) {
        shown.set(genreId, (shown.get(genreId) ?? 0) + 1);
      }
    }
  }
  return shown;
}

// A manual edit on "Mis gustos" always wins over the derived guess for that
// same key -- never overwritten automatically, only ever offered as a
// starting point.
function mergeManual<K>(derived: Map<K, number>, manual: Map<K, number>): Map<K, number> {
  const merged = new Map(derived);
  for (const [key, value] of manual) merged.set(key, value);
  return merged;
}

function sumInto<K>(target: Map<K, number>, source: Map<K, number>) {
  for (const [key, value] of source) target.set(key, (target.get(key) ?? 0) + value);
}

// The derived counts merged with this user's manual "Mis gustos" overrides
// -- the actual value scoring should use. `popularity` has no manual-edit
// UI (a new dimension), so it's always the raw derived value.
export async function computeMergedPreferences(userId: string): Promise<DerivedPreferences> {
  const [derived, genrePrefs, audiencePrefs, budgetPrefs, runtimePrefs, countryPrefs, personPrefs] = await Promise.all([
    computeDerivedPreferences(userId),
    prisma.userGenrePreference.findMany({ where: { userId } }),
    prisma.userAudiencePreference.findMany({ where: { userId } }),
    prisma.userBudgetPreference.findMany({ where: { userId } }),
    prisma.userRuntimePreference.findMany({ where: { userId } }),
    prisma.userCountryPreference.findMany({ where: { userId } }),
    prisma.userPersonRating.findMany({ where: { userId } }),
  ]);

  return {
    genre: mergeManual(derived.genre, new Map(genrePrefs.map((g) => [g.genreId, g.weight]))),
    person: mergeManual(derived.person, new Map(personPrefs.map((p) => [p.personId, p.score]))),
    audience: mergeManual(derived.audience, new Map(audiencePrefs.map((a) => [a.tier, a.weight]))),
    budget: mergeManual(derived.budget, new Map(budgetPrefs.map((b) => [b.tier, b.weight]))),
    runtime: mergeManual(derived.runtime, new Map(runtimePrefs.map((r) => [r.bucket, r.weight]))),
    country: mergeManual(derived.country, new Map(countryPrefs.map((c) => [c.countryCode, c.weight]))),
    popularity: derived.popularity,
  };
}

// Group version: each member's own manual-merged preferences are summed
// across the group -- same "several members liking something outranks one"
// reasoning the rest of group scoring uses.
export async function computeGroupMergedPreferences(userIds: string[]): Promise<DerivedPreferences> {
  const perMember = await Promise.all(userIds.map((id) => computeMergedPreferences(id)));
  const summed = emptyPreferences();
  for (const prefs of perMember) {
    sumInto(summed.genre, prefs.genre);
    sumInto(summed.person, prefs.person);
    sumInto(summed.audience, prefs.audience);
    sumInto(summed.budget, prefs.budget);
    sumInto(summed.runtime, prefs.runtime);
    sumInto(summed.country, prefs.country);
    sumInto(summed.popularity, prefs.popularity);
  }
  return summed;
}
