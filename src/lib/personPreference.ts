import { prisma } from "@/lib/prisma";

// A positive actor/director preference is never read off a single vs win or
// favorite anymore -- it's derived from accumulated 4-5-star ratings, so it
// only forms once there's real corroborating evidence. Titles that share a
// TMDB "collection" (a trilogy/franchise -- The Lord of the Rings 1-2-3, the
// Harry Potter films...) count as a single unit of evidence, not one per
// movie, so binge-loving one saga can't manufacture a preference on its own:
// you need that saga *plus* something unrelated.
const TIER_1_UNITS = 3; // "an initial trend"
const TIER_2_UNITS = 4; // "a settled preference"
const HIGH_RATING_THRESHOLD = 4; // stars

export type PersonTier = 0 | 1 | 2;

export function derivePersonTier(evidenceUnits: number): PersonTier {
  if (evidenceUnits >= TIER_2_UNITS) return 2;
  if (evidenceUnits >= TIER_1_UNITS) return 1;
  return 0;
}

// Returns personId -> tier (1 or 2 only; people with no qualifying evidence
// aren't included) for every actor/director appearing in the user's highly
// rated titles.
export async function computeDerivedPersonTiers(userId: string): Promise<Map<string, PersonTier>> {
  const ratings = await prisma.userTitleRating.findMany({
    where: { userId, seen: true, score: { gte: HIGH_RATING_THRESHOLD } },
    select: {
      titleId: true,
      title: {
        select: {
          collectionId: true,
          cast: { orderBy: { order: "asc" }, take: 3, select: { personId: true } },
          crew: { where: { job: { in: ["Director", "Creator"] } }, select: { personId: true } },
        },
      },
    },
  });

  const unitsByPerson = new Map<string, Set<string>>();
  for (const r of ratings) {
    const unitKey = r.title.collectionId ? `c:${r.title.collectionId}` : `t:${r.titleId}`;
    const personIds = new Set([...r.title.cast, ...r.title.crew].map((p) => p.personId));
    for (const personId of personIds) {
      if (!unitsByPerson.has(personId)) unitsByPerson.set(personId, new Set());
      unitsByPerson.get(personId)!.add(unitKey);
    }
  }

  const tiers = new Map<string, PersonTier>();
  for (const [personId, units] of unitsByPerson) {
    const tier = derivePersonTier(units.size);
    if (tier > 0) tiers.set(personId, tier);
  }
  return tiers;
}

// The score to actually use for a person: an explicit manual rating (set by
// hand on "Mis gustos") always wins over the derived guess -- never
// overwritten automatically, only ever offered as a starting point.
export function effectivePersonScore(
  personId: string,
  manual: Map<string, number>,
  derived: Map<string, PersonTier>,
): number {
  return manual.get(personId) ?? derived.get(personId) ?? 0;
}

// Group version: each member's effective score (manual override, else their
// own derived tier) is summed across the group -- same "several members
// liking something outranks one" reasoning the rest of group scoring uses.
export async function computeGroupPersonScores(userIds: string[]): Promise<Map<string, number>> {
  const personRatings = await prisma.userPersonRating.findMany({ where: { userId: { in: userIds } } });
  const manualByUser = new Map<string, Map<string, number>>();
  for (const r of personRatings) {
    if (!manualByUser.has(r.userId)) manualByUser.set(r.userId, new Map());
    manualByUser.get(r.userId)!.set(r.personId, r.score);
  }

  const summed = new Map<string, number>();
  for (const userId of userIds) {
    const manual = manualByUser.get(userId) ?? new Map();
    const derived = await computeDerivedPersonTiers(userId);
    for (const personId of new Set([...manual.keys(), ...derived.keys()])) {
      const score = effectivePersonScore(personId, manual, derived);
      summed.set(personId, (summed.get(personId) ?? 0) + score);
    }
  }
  return summed;
}
