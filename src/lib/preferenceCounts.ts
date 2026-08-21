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
// (OnboardingChoice) and star ratings (UserTitleRating) -- instead of an
// incrementally-updated column. Nothing to drift, nothing to migrate when
// the formula changes. Most dimensions (genre, type, audience, budget,
// runtime, country, popularity) still only treat a 4-5-star rating as
// positive evidence; actor/director and the "similar" boost read the full
// 1-5 star range now (see DIRECTOR_STAR_VALUE/ACTOR_STAR_VALUE/
// SIMILAR_TOP5_VALUE below).
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

// Direct per-instance point value for actor/director, keyed by star score --
// no corroboration threshold anymore, every rated title contributes
// immediately (2026-08-27 request). 5 stars counts for more than 4; 2 and 1
// stars subtract, 1 more sharply than 2; 3 stars is neutral (the "saw it,
// no strong feeling" score). A plain "vs" win with no star rating for that
// title is treated as a 4-star equivalent -- the flat/baseline positive
// signal, same tier "similar" boosts use it at below.
const DIRECTOR_STAR_VALUE: Record<number, number> = { 1: -3, 2: -1, 3: 0, 4: 1.5, 5: 2.5 };
const ACTOR_STAR_VALUE: Record<number, number> = { 1: -2, 2: -1, 3: 0, 4: 1, 5: 2 };
const VS_WIN_DIRECTOR_VALUE = DIRECTOR_STAR_VALUE[4];
const VS_WIN_ACTOR_VALUE = ACTOR_STAR_VALUE[4];

// "similar" boost per top-5-ranked related title for a given evidence
// source; 6th-10th place gets half. Only a "vs" win, a 4-star, or a 5-star
// rating generates this boost (5 stars amplified to 3x) -- 1-3 stars don't
// contribute at all, same as they never did before this dimension existed.
const SIMILAR_TOP5_VALUE: Partial<Record<"vs" | 4 | 5, number>> = { vs: 1, 4: 1, 5: 3 };

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

// The core derivation: gathers every "vs" win and every star rating (1-5),
// tallies each qualifying title's attributes, then applies each dimension's
// own rule above. A title that both won a "vs" round and was later rated
// with stars only counts once -- the rating supersedes the "vs" result for
// that same title (2026-08-27 request: rating something removes whatever
// score its "vs" win had granted, instead of both stacking). No franchise/
// collection deduping. `useOriginalTitles` only affects the display name
// attached to a "similar" reason.
export async function computeDerivedPreferences(userId: string, useOriginalTitles = false): Promise<DerivedPreferences> {
  const [wins, ratings] = await Promise.all([
    prisma.onboardingChoice.findMany({ where: { userId, skipped: false }, select: { winnerId: true } }),
    prisma.userTitleRating.findMany({
      where: { userId, seen: true, score: { not: null } },
      select: { titleId: true, score: true },
    }),
  ]);

  const ratedTitleIds = new Set(ratings.map((r) => r.titleId));
  // A "vs" win only still counts as its own piece of evidence if that title
  // was never subsequently rated -- once rated, the star score below is the
  // sole source of truth for that title.
  const effectiveWins = wins.filter((w) => !ratedTitleIds.has(w.winnerId));

  const evidenceIds = [...new Set([...effectiveWins.map((w) => w.winnerId), ...ratings.map((r) => r.titleId)])];
  if (evidenceIds.length === 0) return emptyPreferences();

  const titles = await prisma.title.findMany({ where: { id: { in: evidenceIds } }, select: EVIDENCE_SELECT });
  const titleById = new Map(titles.map((t) => [t.id, t]));
  type EvidenceTitle = NonNullable<ReturnType<typeof titleById.get>>;

  const typeCounts = new Map<TitleType, number>();
  const genreCounts = new Map<number, number>();
  const actor = new Map<string, number>();
  const director = new Map<string, number>();
  const audienceCounts = new Map<AudienceTier, number>();
  const budgetCounts = new Map<BudgetTier, number>();
  const runtimeCounts = new Map<RuntimeBucket, number>();
  const countryCounts = new Map<string, number>();
  const popularityCounts = new Map<PopularityRange, number>();
  const similarCounts = new Map<string, number>();
  const similarReasons = new Map<string, SimilarReason>();

  // type/genre/audience/budget/runtime/country/popularity -- unchanged +1
  // counting, from "vs" wins (not superseded by a rating) and 4-5-star
  // ratings only. 1-3-star ratings never fed these dimensions, still don't.
  function tallyGeneral(t: EvidenceTitle) {
    typeCounts.set(t.type, (typeCounts.get(t.type) ?? 0) + 1);
    for (const g of t.genres) genreCounts.set(g.genreId, (genreCounts.get(g.genreId) ?? 0) + 1);

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

  // Direct-sum, immediate -- every rated (or "vs"-won) title's top-3 cast
  // and director/creator get `directorValue`/`actorValue` added right away,
  // positive or negative, no corroboration threshold.
  function tallyPerson(t: EvidenceTitle, directorValue: number, actorValue: number) {
    if (directorValue !== 0) {
      for (const c of t.crew) director.set(c.personId, (director.get(c.personId) ?? 0) + directorValue);
    }
    if (actorValue !== 0) {
      for (const c of t.cast) actor.set(c.personId, (actor.get(c.personId) ?? 0) + actorValue);
    }
  }

  // rank is 0-indexed and only ever 0-9 (SIMILAR_PER_TITLE caps storage at
  // 10 per title on import) -- 0-4 is "top 5", 5-9 is "6th through 10th"
  // (half of the top-5 value).
  function tallySimilar(t: EvidenceTitle, top5Value: number) {
    for (const row of t.similar) {
      const contribution = row.rank < 5 ? top5Value : top5Value / 2;
      const key = `${row.relatedTmdbId}:${row.relatedType}`;
      similarCounts.set(key, (similarCounts.get(key) ?? 0) + contribution);
      const existing = similarReasons.get(key);
      if (!existing || contribution > existing.contribution) {
        similarReasons.set(key, { name: displayTitleName(t, useOriginalTitles), contribution });
      }
    }
  }

  for (const w of effectiveWins) {
    const t = titleById.get(w.winnerId);
    if (!t) continue;
    tallyGeneral(t);
    tallyPerson(t, VS_WIN_DIRECTOR_VALUE, VS_WIN_ACTOR_VALUE);
    tallySimilar(t, SIMILAR_TOP5_VALUE.vs!);
  }

  for (const r of ratings) {
    const t = titleById.get(r.titleId);
    if (!t) continue;
    const score = r.score!;
    if (score >= 4) tallyGeneral(t);
    tallyPerson(t, DIRECTOR_STAR_VALUE[score] ?? 0, ACTOR_STAR_VALUE[score] ?? 0);
    const similarValue = SIMILAR_TOP5_VALUE[score as 4 | 5];
    if (similarValue !== undefined) tallySimilar(t, similarValue);
  }

  // Zero-valued entries (e.g. a person whose only evidence cancelled out to
  // exactly 0) are dropped -- same "nothing to say" meaning as never having
  // set the key at all.
  for (const [personId, score] of [...actor]) if (score === 0) actor.delete(personId);
  for (const [personId, score] of [...director]) if (score === 0) director.delete(personId);

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

// Rescales every genre's merged (derived + manual) score onto a fixed 0-10
// range via standard min-max normalization: (x - min) / (max - min) * 10
// (2026-08-27 request). The favorite genre always reads as exactly 10, the
// least-favorite as exactly 0, everything else proportional between --
// unlike the other direct-sum dimensions, genre scores are meant to be
// compared against each other on a fixed scale, not accumulate without
// bound. Computed over every genre in the catalog, not just ones with some
// evidence, so a genre the user has never interacted with is treated as a
// raw 0 and lands wherever that falls in their actual spread, rather than
// being silently excluded from the scale entirely. When every genre ties
// (typically a brand-new user with zero evidence) there's no spread to
// normalize -- every genre maps to 0 instead of dividing by zero.
function normalizeGenreScores(merged: Map<number, number>, allGenreIds: number[]): Map<number, number> {
  const values = allGenreIds.map((id) => merged.get(id) ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const result = new Map<number, number>();
  if (max === min) {
    for (const id of allGenreIds) result.set(id, 0);
    return result;
  }
  for (const id of allGenreIds) {
    result.set(id, ((merged.get(id) ?? 0) - min) * (10 / (max - min)));
  }
  return result;
}

function sumInto<K>(target: Map<K, number>, source: Map<K, number>) {
  for (const [key, value] of source) target.set(key, (target.get(key) ?? 0) + value);
}

// The derived counts merged with this user's manual "Mis gustos" +1/-1
// adjustments -- the actual value scoring should use. `similar` has no
// manual-edit UI (a per-candidate-title boost, not a nameable preference),
// so it's always the raw derived value.
export async function computeMergedPreferences(userId: string, useOriginalTitles = false): Promise<DerivedPreferences> {
  const [derived, typePrefs, genrePrefs, audiencePrefs, budgetPrefs, runtimePrefs, countryPrefs, popularityPrefs, personPrefs, allGenres] =
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
      prisma.genre.findMany({ select: { id: true } }),
    ]);

  const manualPerson = new Map(personPrefs.map((p) => [p.personId, p.score]));
  const mergedGenre = mergeManual(derived.genre, new Map(genrePrefs.map((g) => [g.genreId, g.weight])));

  return {
    type: mergeManual(derived.type, new Map(typePrefs.map((t) => [t.type, t.weight]))),
    genre: normalizeGenreScores(mergedGenre, allGenres.map((g) => g.id)),
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
