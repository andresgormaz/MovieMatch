import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { TitleType } from "@/generated/prisma/enums";
import { displayTitleName } from "@/lib/titleDisplay";
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
// model for every preference dimension: the *derived* half of each score is
// recomputed fresh, directly from the two raw sources of truth -- "vs" wins
// (OnboardingChoice) and 4-5-star ratings (UserTitleRating) -- instead of an
// incrementally-updated column. Nothing to drift, nothing to migrate when
// the formula changes.
//
// On top of that, "Mis gustos" lets the user manually nudge any preference
// by +1/-1, repeatedly -- that manual total is ADDED to the derived score
// (not a replacement), so a correction persists and keeps compounding
// alongside whatever new evidence keeps coming in from actual usage. See
// mergeManual below. This module never writes to the manual tables, only
// reads them here and merges.

const EVIDENCE_SELECT = {
  id: true,
  name: true,
  originalName: true,
  type: true,
  voteCount: true,
  budget: true,
  runtime: true,
  originCountry: true,
  genres: { select: { genreId: true } },
  cast: { orderBy: { order: "asc" as const }, take: 3, select: { personId: true } },
  crew: { where: { job: { in: ["Director", "Creator"] } }, select: { personId: true } },
  // TMDB's own "if you liked this, try these" for the evidence title, capped
  // at 10 per title on import (rank 0 = most relevant) -- see below.
  similar: { select: { relatedTmdbId: true, relatedType: true, rank: true } },
} satisfies Prisma.TitleSelect;

interface SimilarReason {
  name: string;
  contribution: number;
}

export interface DerivedPreferences {
  type: Map<TitleType, number>;
  genre: Map<number, number>;
  actor: Map<string, number>;
  director: Map<string, number>;
  audience: Map<AudienceTier, number>;
  budget: Map<BudgetTier, number>;
  runtime: Map<RuntimeBucket, number>;
  country: Map<string, number>;
  popularity: Map<PopularityRange, number>;
  // Keyed by "tmdbId:type" (matches a candidate at scoring time) -- a title
  // similar to an evidence title, per TMDB, gets +1 if it was in that
  // title's top 5 most-relevant recommendations, +0.5 for 6th-10th.
  // Compounds across multiple evidence titles pointing at the same one. Not
  // manually adjustable -- it's a per-candidate-title boost, not a stable,
  // nameable preference.
  similar: Map<string, number>;
  similarReasons: Map<string, SimilarReason>;
}

function emptyPreferences(): DerivedPreferences {
  return {
    type: new Map(),
    genre: new Map(),
    actor: new Map(),
    director: new Map(),
    audience: new Map(),
    budget: new Map(),
    runtime: new Map(),
    country: new Map(),
    popularity: new Map(),
    similar: new Map(),
    similarReasons: new Map(),
  };
}

// A person needs 3 corroborating instances (a "vs" win or a 4-5-star
// rating featuring them, counted together) before a preference forms --
// "an initial trend" -- and each instance past that adds one more full
// point: the 4th instance already totals 2, the 5th totals 3, and so on.
// Applied separately to "appeared as cast" vs "appeared as director/
// creator" -- someone who's both gets independent actor and director
// scores, one per capacity.
function personScoreFromCount(count: number): number {
  return count >= 3 ? count - 2 : 0;
}

// Winner-takes-all for a fixed set of buckets (type/budget/runtime/country/
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
// model) no franchise/collection deduping either. `useOriginalTitles` only
// affects the display name attached to a "similar" reason.
export async function computeDerivedPreferences(userId: string, useOriginalTitles = false): Promise<DerivedPreferences> {
  const [wins, highRatings] = await Promise.all([
    prisma.onboardingChoice.findMany({ where: { userId, skipped: false }, select: { winnerId: true } }),
    prisma.userTitleRating.findMany({ where: { userId, seen: true, score: { gte: 4 } }, select: { titleId: true } }),
  ]);

  const evidenceIds = [...new Set([...wins.map((w) => w.winnerId), ...highRatings.map((r) => r.titleId)])];
  if (evidenceIds.length === 0) return emptyPreferences();

  const titles = await prisma.title.findMany({ where: { id: { in: evidenceIds } }, select: EVIDENCE_SELECT });
  const titleById = new Map(titles.map((t) => [t.id, t]));

  const typeCounts = new Map<TitleType, number>();
  const genreCounts = new Map<number, number>();
  const actorCounts = new Map<string, number>();
  const directorCounts = new Map<string, number>();
  const audienceCounts = new Map<AudienceTier, number>();
  const budgetCounts = new Map<BudgetTier, number>();
  const runtimeCounts = new Map<RuntimeBucket, number>();
  const countryCounts = new Map<string, number>();
  const popularityCounts = new Map<PopularityRange, number>();
  const similarCounts = new Map<string, number>();
  const similarReasons = new Map<string, SimilarReason>();

  function tally(titleId: string) {
    const t = titleById.get(titleId);
    if (!t) return;

    typeCounts.set(t.type, (typeCounts.get(t.type) ?? 0) + 1);

    for (const g of t.genres) genreCounts.set(g.genreId, (genreCounts.get(g.genreId) ?? 0) + 1);

    for (const c of t.cast) actorCounts.set(c.personId, (actorCounts.get(c.personId) ?? 0) + 1);
    for (const c of t.crew) directorCounts.set(c.personId, (directorCounts.get(c.personId) ?? 0) + 1);

    const audience = classifyAudienceTier(t);
    if (audience) audienceCounts.set(audience, (audienceCounts.get(audience) ?? 0) + 1);

    const budget = classifyBudgetTier(t);
    if (budget) budgetCounts.set(budget, (budgetCounts.get(budget) ?? 0) + 1);

    const runtime = classifyRuntimeBucket(t);
    if (runtime) runtimeCounts.set(runtime, (runtimeCounts.get(runtime) ?? 0) + 1);

    if (t.originCountry) countryCounts.set(t.originCountry, (countryCounts.get(t.originCountry) ?? 0) + 1);

    const popularity = classifyPopularityRange(t);
    popularityCounts.set(popularity, (popularityCounts.get(popularity) ?? 0) + 1);

    // rank is 0-indexed and only ever 0-9 (SIMILAR_PER_TITLE caps storage at
    // 10 per title on import) -- 0-4 is "top 5", 5-9 is "6th through 10th".
    for (const row of t.similar) {
      const contribution = row.rank < 5 ? 1 : 0.5;
      const key = `${row.relatedTmdbId}:${row.relatedType}`;
      similarCounts.set(key, (similarCounts.get(key) ?? 0) + contribution);
      const existing = similarReasons.get(key);
      if (!existing || contribution > existing.contribution) {
        similarReasons.set(key, { name: displayTitleName(t, useOriginalTitles), contribution });
      }
    }
  }

  for (const w of wins) tally(w.winnerId);
  for (const r of highRatings) tally(r.titleId);

  const actor = new Map<string, number>();
  for (const [personId, count] of actorCounts) {
    const score = personScoreFromCount(count);
    if (score > 0) actor.set(personId, score);
  }
  const director = new Map<string, number>();
  for (const [personId, count] of directorCounts) {
    const score = personScoreFromCount(count);
    if (score > 0) director.set(personId, score);
  }

  return {
    type: winnerTakesAll(typeCounts),
    genre: genreCounts,
    actor,
    director,
    audience: audiencePreferenceFromCounts(audienceCounts),
    budget: winnerTakesAll(budgetCounts),
    runtime: winnerTakesAll(runtimeCounts),
    country: winnerTakesAll(countryCounts),
    popularity: winnerTakesAll(popularityCounts),
    similar: similarCounts,
    similarReasons,
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

// The user's accumulated manual +1/-1 clicks are ADDED to the derived score
// for that same key -- a correction persists and keeps compounding
// alongside new evidence, rather than freezing the value at an absolute
// override.
function mergeManual<K>(derived: Map<K, number>, manual: Map<K, number>): Map<K, number> {
  const merged = new Map(derived);
  for (const [key, delta] of manual) merged.set(key, (merged.get(key) ?? 0) + delta);
  return merged;
}

function sumInto<K>(target: Map<K, number>, source: Map<K, number>) {
  for (const [key, value] of source) target.set(key, (target.get(key) ?? 0) + value);
}

// The derived counts merged with this user's manual "Mis gustos" +1/-1
// adjustments -- the actual value scoring should use. `similar` has no
// manual-edit UI (a per-candidate-title boost, not a nameable preference),
// so it's always the raw derived value.
export async function computeMergedPreferences(userId: string, useOriginalTitles = false): Promise<DerivedPreferences> {
  const [derived, typePrefs, genrePrefs, audiencePrefs, budgetPrefs, runtimePrefs, countryPrefs, popularityPrefs, personPrefs] =
    await Promise.all([
      computeDerivedPreferences(userId, useOriginalTitles),
      prisma.userTypePreference.findMany({ where: { userId } }),
      prisma.userGenrePreference.findMany({ where: { userId } }),
      prisma.userAudiencePreference.findMany({ where: { userId } }),
      prisma.userBudgetPreference.findMany({ where: { userId } }),
      prisma.userRuntimePreference.findMany({ where: { userId } }),
      prisma.userCountryPreference.findMany({ where: { userId } }),
      prisma.userPopularityPreference.findMany({ where: { userId } }),
      prisma.userPersonRating.findMany({ where: { userId } }),
    ]);

  const manualPerson = new Map(personPrefs.map((p) => [p.personId, p.score]));

  return {
    type: mergeManual(derived.type, new Map(typePrefs.map((t) => [t.type, t.weight]))),
    genre: mergeManual(derived.genre, new Map(genrePrefs.map((g) => [g.genreId, g.weight]))),
    // Same manual value applies to both roles -- someone who's both an
    // actor and director for this user's evidence shares one adjustment,
    // rather than needing two separate manual entries for the same person.
    actor: mergeManual(derived.actor, manualPerson),
    director: mergeManual(derived.director, manualPerson),
    audience: mergeManual(derived.audience, new Map(audiencePrefs.map((a) => [a.tier, a.weight]))),
    budget: mergeManual(derived.budget, new Map(budgetPrefs.map((b) => [b.tier, b.weight]))),
    runtime: mergeManual(derived.runtime, new Map(runtimePrefs.map((r) => [r.bucket, r.weight]))),
    country: mergeManual(derived.country, new Map(countryPrefs.map((c) => [c.countryCode, c.weight]))),
    popularity: mergeManual(derived.popularity, new Map(popularityPrefs.map((p) => [p.range, p.weight]))),
    similar: derived.similar,
    similarReasons: derived.similarReasons,
  };
}

// Group version: each member's own manual-merged preferences are summed
// across the group -- same "several members liking something outranks one"
// reasoning the rest of group scoring uses. For the "similar" reason text
// (flavor only, doesn't affect score), this just keeps whichever member's
// reason is found first for a given key rather than comparing contributions
// across members -- not worth the complexity for a label.
export async function computeGroupMergedPreferences(
  userIds: string[],
  useOriginalTitles = false,
): Promise<DerivedPreferences> {
  const perMember = await Promise.all(userIds.map((id) => computeMergedPreferences(id, useOriginalTitles)));
  const summed = emptyPreferences();
  for (const prefs of perMember) {
    sumInto(summed.type, prefs.type);
    sumInto(summed.genre, prefs.genre);
    sumInto(summed.actor, prefs.actor);
    sumInto(summed.director, prefs.director);
    sumInto(summed.audience, prefs.audience);
    sumInto(summed.budget, prefs.budget);
    sumInto(summed.runtime, prefs.runtime);
    sumInto(summed.country, prefs.country);
    sumInto(summed.popularity, prefs.popularity);
    sumInto(summed.similar, prefs.similar);
    for (const [key, reason] of prefs.similarReasons) {
      if (!summed.similarReasons.has(key)) summed.similarReasons.set(key, reason);
    }
  }
  return summed;
}
