// Classifies a title into the "objective attribute" preference dimensions
// (audience reach, production budget, runtime) -- shared by onboardingPairs.ts
// (bumping a user's preference when they pick a winner) and recommend.ts
// (scoring candidates against those preferences), so a title is always
// classified the same way in both places.
//
// Returning null means "too ambiguous to classify either way" -- these
// dimensions never force a title into a bucket it doesn't clearly belong in.

export type AudienceTier = "MAINSTREAM" | "INDIE";
export type BudgetTier = "MEGA" | "SMALL";
export type RuntimeBucket = "SHORT" | "MEDIUM" | "LONG";

interface AttributeInput {
  voteCount: number | null;
  budget: number | null;
  runtime: number | null;
}

// Popularity/vote count is the primary signal (available for everything);
// budget reinforces it when known, but only reported by TMDB for movies.
const MAINSTREAM_VOTE_COUNT = 5000;
const MAINSTREAM_BUDGET = 50_000_000;
const INDIE_VOTE_COUNT = 1000; // MovieMatch's general "probably widely seen" floor elsewhere
const INDIE_BUDGET_MAX = 5_000_000;

export function classifyAudienceTier(t: AttributeInput): AudienceTier | null {
  if ((t.voteCount ?? 0) >= MAINSTREAM_VOTE_COUNT || (t.budget ?? 0) >= MAINSTREAM_BUDGET) {
    return "MAINSTREAM";
  }
  if ((t.voteCount ?? Infinity) < INDIE_VOTE_COUNT && (t.budget === null || t.budget < INDIE_BUDGET_MAX)) {
    return "INDIE";
  }
  return null;
}

// Pure production-scale signal from budget alone -- movies only, TMDB
// doesn't report series budgets, so `budget: null` always classifies as null.
const MEGA_BUDGET = 100_000_000;
const SMALL_BUDGET_MAX = 20_000_000;

export function classifyBudgetTier(t: AttributeInput): BudgetTier | null {
  if (t.budget === null) return null;
  if (t.budget >= MEGA_BUDGET) return "MEGA";
  if (t.budget > 0 && t.budget < SMALL_BUDGET_MAX) return "SMALL";
  return null;
}

// Movie runtime, or a representative episode runtime for series -- the same
// buckets apply to both (a 45-minute drama episode and an 80-minute movie
// both read as "shorter commitment"), a simplification but a reasonable one.
const SHORT_RUNTIME_MAX = 90;
const LONG_RUNTIME_MIN = 150;

export function classifyRuntimeBucket(t: AttributeInput): RuntimeBucket | null {
  if (!t.runtime) return null; // null or 0 ("checked, TMDB has nothing") -- same as unknown
  if (t.runtime < SHORT_RUNTIME_MAX) return "SHORT";
  if (t.runtime > LONG_RUNTIME_MIN) return "LONG";
  return "MEDIUM";
}
