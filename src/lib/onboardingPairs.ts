import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl } from "@/lib/tmdb";
import type { Prisma } from "@/generated/prisma/client";
import type { TitleType } from "@/generated/prisma/enums";

// Short on purpose: the point of the new onboarding is a couple of minutes,
// not a marathon. Two favorites (seed) + this many "which do you like more"
// rounds is enough to spread across several genres without wearing anyone out.
// The same comparison mechanic keeps running after onboarding too (see /vs),
// so this only bounds the very first pass.
export const ONBOARDING_ROUNDS = 7;

// "Probably actually seen this" cutoff -- keeps comparisons to titles
// popular enough that picking one over the other is a meaningful preference
// signal, not a guess between two things nobody's heard of. Genuinely
// well-known titles clear this by a wide margin (tens of thousands of
// votes); this is a floor, not a target.
const POPULAR_VOTE_COUNT = 1000;

const PREFERENCE_WEIGHT_MAX = 2;
const PREFERENCE_WEIGHT_MIN = -2;

// Safety net: if the catalog's streaming data for this country is too thin
// to fill several rounds (e.g. a country TMDB barely covers), requiring
// streaming availability would just break the flow instead of steering it.
// Drop the requirement rather than dead-end.
const MIN_STREAMING_COVERAGE = 30;

// Once both movie and series have a weight recorded, format is "covered" --
// stop deliberately engineering movie-vs-series rounds (an incidental one
// can still happen through the normal genre flow, and still nudges type a
// little, see recordPairWinner).
const TYPE_COVERAGE_TARGET = 2;

export interface PairTitle {
  id: string;
  name: string;
  releaseYear: number | null;
  posterUrl: string | null;
  type: "MOVIE" | "SERIES";
}

type TitleWithCredits = {
  id: string;
  name: string;
  releaseYear: number | null;
  posterPath: string | null;
  type: TitleType;
  cast: { personId: string }[];
  crew: { personId: string }[];
};

// Bumps genre preference toward a title's genres by `delta`, clamped to the
// same -2..2 scale the (optional, post-onboarding) manual editing uses -- an
// inferred signal never jumps past what an explicit one could have set.
// Only ever increases: this never guesses that someone dislikes something.
async function bumpGenrePreferences(userId: string, titleId: string, delta: number) {
  const genres = await prisma.titleGenre.findMany({ where: { titleId }, select: { genreId: true } });
  if (genres.length === 0) return;

  const existing = await prisma.userGenrePreference.findMany({
    where: { userId, genreId: { in: genres.map((g) => g.genreId) } },
  });
  const existingByGenre = new Map(existing.map((e) => [e.genreId, e.weight]));

  for (const { genreId } of genres) {
    const current = existingByGenre.get(genreId) ?? 0;
    const next = Math.max(PREFERENCE_WEIGHT_MIN, Math.min(PREFERENCE_WEIGHT_MAX, current + delta));
    await prisma.userGenrePreference.upsert({
      where: { userId_genreId: { userId, genreId } },
      update: { weight: next },
      create: { userId, genreId, weight: next },
    });
  }
}

// Same idea as genre, but for movie-vs-series taste. A much smaller signal
// space (only two possible values), so it fills in fast once a handful of
// picks lean one way or the other.
async function bumpTypePreference(userId: string, type: TitleType, delta: number) {
  const existing = await prisma.userTypePreference.findUnique({ where: { userId_type: { userId, type } } });
  const next = Math.max(PREFERENCE_WEIGHT_MIN, Math.min(PREFERENCE_WEIGHT_MAX, (existing?.weight ?? 0) + delta));
  await prisma.userTypePreference.upsert({
    where: { userId_type: { userId, type } },
    update: { weight: next },
    create: { userId, type, weight: next },
  });
}

// Credits a title's lead cast + director/creator with a mild "liked" signal
// -- but only fills gaps (never overwrites a rating the person set
// explicitly, e.g. a dislike on the "Mis gustos" page).
async function bumpPersonPreferences(userId: string, titleId: string) {
  const [cast, crew] = await Promise.all([
    prisma.titleCast.findMany({ where: { titleId }, orderBy: { order: "asc" }, take: 3, select: { personId: true } }),
    prisma.titleCrew.findMany({
      where: { titleId, job: { in: ["Director", "Creator"] } },
      select: { personId: true },
    }),
  ]);
  const personIds = [...new Set([...cast.map((c) => c.personId), ...crew.map((c) => c.personId)])];
  for (const personId of personIds) {
    await prisma.userPersonRating.upsert({
      where: { userId_personId: { userId, personId } },
      update: {},
      create: { userId, personId, score: 1 },
    });
  }
}

// A favorite is the strongest, least ambiguous signal onboarding gets --
// explicitly named, so it's recorded as a real 5-star rating as well as a
// strong genre/type/cast bump, unlike pairwise picks below.
export async function recordFavorite(userId: string, titleId: string) {
  const title = await prisma.title.findUnique({ where: { id: titleId }, select: { type: true } });
  await prisma.userTitleRating.upsert({
    where: { userId_titleId: { userId, titleId } },
    update: { seen: true, score: 5 },
    create: { userId, titleId, seen: true, score: 5 },
  });
  await Promise.all([
    bumpGenrePreferences(userId, titleId, PREFERENCE_WEIGHT_MAX),
    bumpPersonPreferences(userId, titleId),
    title ? bumpTypePreference(userId, title.type, PREFERENCE_WEIGHT_MAX) : Promise.resolve(),
  ]);
}

// A pairwise pick is weaker evidence than a favorite (even now that both
// sides are confirmed seen, we only know they preferred the winner, not by
// how much) -- logged for coverage tracking, and only the winner nudges
// preferences, by a smaller amount, never the loser. Both titles are marked
// "seen" here: picking between them only makes sense once you've actually
// watched both (see recordNotSeen for the "swap this one out" escape hatch).
export async function recordPairWinner(userId: string, titleAId: string, titleBId: string, winnerId: string) {
  if (winnerId !== titleAId && winnerId !== titleBId) {
    throw new Error("winnerId must be titleAId or titleBId");
  }
  const winner = await prisma.title.findUnique({ where: { id: winnerId }, select: { type: true } });
  await Promise.all([
    prisma.onboardingChoice.create({ data: { userId, titleAId, titleBId, winnerId } }),
    prisma.userTitleRating.upsert({
      where: { userId_titleId: { userId, titleId: titleAId } },
      update: { seen: true },
      create: { userId, titleId: titleAId, seen: true, score: null },
    }),
    prisma.userTitleRating.upsert({
      where: { userId_titleId: { userId, titleId: titleBId } },
      update: { seen: true },
      create: { userId, titleId: titleBId, seen: true, score: null },
    }),
  ]);
  await Promise.all([
    bumpGenrePreferences(userId, winnerId, 1),
    bumpPersonPreferences(userId, winnerId),
    winner ? bumpTypePreference(userId, winner.type, 1) : Promise.resolve(),
  ]);
}

// "No la he visto": the swapped-out title is recorded as explicitly unseen
// (no score -- if it had one somehow, saying "I haven't seen this" now
// contradicts that, so it's cleared) and never shown again. Doesn't touch
// OnboardingChoice: the round isn't finished, just one slot getting refilled.
export async function recordNotSeen(userId: string, titleId: string) {
  await prisma.userTitleRating.upsert({
    where: { userId_titleId: { userId, titleId } },
    update: { seen: false, score: null },
    create: { userId, titleId, seen: false, score: null },
  });
}

// "No vi ninguna de las dos": both sides get the same treatment as a single
// recordNotSeen call -- neither comes back, no preference bump, and the
// caller fetches a wholly fresh pair next (no fixedTitleId to keep either
// side in place).
export async function recordBothNotSeen(userId: string, titleAId: string, titleBId: string) {
  await Promise.all([recordNotSeen(userId, titleAId), recordNotSeen(userId, titleBId)]);
}

// A title with no current streaming availability is either brand new (still
// in theaters / not out on streaming yet) or otherwise hard to actually go
// watch right now -- either way, unlikely to be something the person has
// already seen, which is the whole point of these comparisons. Requiring it
// keeps comparisons to titles someone could plausibly have caught already.
function streamingWhere(userCountry: string | null): Prisma.TitleWhereInput {
  return userCountry ? { providers: { some: { countryCode: userCountry } } } : {};
}

const CREDITS_SELECT = {
  id: true,
  name: true,
  releaseYear: true,
  posterPath: true,
  type: true,
  cast: { orderBy: { order: "asc" as const }, take: 3, select: { personId: true } },
  crew: { where: { job: { in: ["Director", "Creator"] } }, select: { personId: true } },
} satisfies Prisma.TitleSelect;

// Among the most-voted not-yet-shown titles for a genre, prefers one whose
// lead cast/director we have zero signal on yet -- so comparisons double as
// a way to learn about people, not just genres, without a separate "person
// round" the user would have to sit through. Falls back to the plain
// most-voted pick when everyone in the running is already rated (or there's
// no gap to fill).
async function pickCandidateForGenre(
  userId: string,
  genreId: number,
  excludeIds: string[],
  userCountry: string | null,
): Promise<TitleWithCredits | null> {
  const candidates = await prisma.title.findMany({
    where: {
      genres: { some: { genreId } },
      id: { notIn: excludeIds.length > 0 ? excludeIds : undefined },
      voteCount: { gte: POPULAR_VOTE_COUNT },
      ...streamingWhere(userCountry),
    },
    orderBy: { voteCount: "desc" },
    take: 5,
    select: CREDITS_SELECT,
  });
  return pickPersonGapCandidate(userId, candidates);
}

// Same "prefer an unrated person" preference as above, applied to the
// last-resort fallback pool (thin catalog, or every eligible genre ran dry).
async function pickPopularFallback(
  userId: string,
  excludeIds: string[],
  take: number,
  userCountry: string | null,
): Promise<TitleWithCredits[]> {
  const where = { id: { notIn: excludeIds.length > 0 ? excludeIds : undefined }, ...streamingWhere(userCountry) };
  const byVotes = await prisma.title.findMany({
    where: { ...where, voteCount: { gte: POPULAR_VOTE_COUNT } },
    orderBy: { voteCount: "desc" },
    take: Math.max(take, 5),
    select: CREDITS_SELECT,
  });
  const picked: TitleWithCredits[] = [];
  const pool = [...byVotes];
  while (picked.length < take && pool.length > 0) {
    const choice = await pickPersonGapCandidate(userId, pool);
    if (!choice) break;
    picked.push(choice);
    pool.splice(pool.findIndex((c) => c.id === choice.id), 1);
  }
  if (picked.length >= take) return picked;

  const more = await prisma.title.findMany({
    where: { ...where, id: { notIn: [...excludeIds, ...picked.map((t) => t.id)] } },
    orderBy: { popularity: "desc" },
    take: take - picked.length,
    select: CREDITS_SELECT,
  });
  return [...picked, ...more];
}

async function pickPersonGapCandidate(
  userId: string,
  candidates: TitleWithCredits[],
): Promise<TitleWithCredits | null> {
  if (candidates.length === 0) return null;
  const allPersonIds = [...new Set(candidates.flatMap((c) => [...c.cast, ...c.crew].map((p) => p.personId)))];
  const rated =
    allPersonIds.length > 0
      ? await prisma.userPersonRating.findMany({ where: { userId, personId: { in: allPersonIds } }, select: { personId: true } })
      : [];
  const ratedSet = new Set(rated.map((r) => r.personId));
  const withGap = candidates.find((c) => [...c.cast, ...c.crew].some((p) => !ratedSet.has(p.personId)));
  return withGap ?? candidates[0];
}

// Deliberately pits a movie against a series (each the most popular
// available) to learn format preference directly, instead of waiting for it
// to show up incidentally. Only attempted while type coverage is missing --
// see TYPE_COVERAGE_TARGET.
async function pickTypeGapPair(
  excludeIds: string[],
  userCountry: string | null,
): Promise<{ movie: TitleWithCredits; series: TitleWithCredits } | null> {
  const where = { id: { notIn: excludeIds.length > 0 ? excludeIds : undefined }, ...streamingWhere(userCountry) };
  const [movie, series] = await Promise.all([
    prisma.title.findFirst({
      where: { ...where, type: "MOVIE", voteCount: { gte: POPULAR_VOTE_COUNT } },
      orderBy: { voteCount: "desc" },
      select: CREDITS_SELECT,
    }),
    prisma.title.findFirst({
      where: { ...where, type: "SERIES", voteCount: { gte: POPULAR_VOTE_COUNT } },
      orderBy: { voteCount: "desc" },
      select: CREDITS_SELECT,
    }),
  ]);
  if (!movie || !series) return null;
  return { movie, series };
}

// Upper bound on sequential per-genre queries inside fillSlots. Without this,
// a thin/exhausted candidate pool makes the loop walk every eligible genre
// (potentially 15-19 of them) one query at a time -- slow enough in
// production to risk the serverless function timing out and leaving the
// client stuck. Genres beyond this cap just fall through to the cheaper,
// single-query pickPopularFallback instead.
const MAX_GENRE_ATTEMPTS = 6;

// Runs the genre-gap loop + popularity fallback to fill `slotsNeeded` spots.
// Split out so pickNextPair can retry it with a wider (non-streaming-scoped)
// pool once the narrower one runs dry -- see the comment where it's called.
async function fillSlots(
  userId: string,
  excludeIds: string[],
  weightByGenre: Map<number, number>,
  slotsNeeded: number,
  userCountry: string | null,
): Promise<TitleWithCredits[]> {
  const genreCounts = await prisma.titleGenre.groupBy({
    by: ["genreId"],
    _count: { titleId: true },
    where: { title: { voteCount: { gte: POPULAR_VOTE_COUNT }, ...streamingWhere(userCountry) } },
  });
  const eligibleGenres = genreCounts
    .filter((g) => g._count.titleId >= 2)
    .sort((a, b) => {
      const wa = weightByGenre.get(a.genreId) ?? 0;
      const wb = weightByGenre.get(b.genreId) ?? 0;
      if (wa !== wb) return wa - wb;
      return b._count.titleId - a._count.titleId;
    })
    .slice(0, MAX_GENRE_ATTEMPTS);

  const picked: TitleWithCredits[] = [];
  for (const g of eligibleGenres) {
    if (picked.length >= slotsNeeded) break;
    const candidate = await pickCandidateForGenre(
      userId,
      g.genreId,
      [...excludeIds, ...picked.map((p) => p.id)],
      userCountry,
    );
    if (candidate) picked.push(candidate);
  }

  if (picked.length < slotsNeeded) {
    const fallback = await pickPopularFallback(
      userId,
      [...excludeIds, ...picked.map((p) => p.id)],
      slotsNeeded - picked.length,
      userCountry,
    );
    picked.push(...fallback);
  }

  return picked;
}

// The adaptive step: picks the next pair to compare. Three gaps are checked,
// in order -- format (movie vs series), then genre coverage (favoring genres
// with the lowest UserGenrePreference weight, i.e. least known), with the
// person-gap preference from pickCandidateForGenre layered on top of
// whichever one runs. `fixedTitleId` mid-swaps just one side (see
// recordNotSeen's caller): only a single fresh candidate is picked, keeping
// the other title in place.
export async function pickNextPair(
  userId: string,
  extraExcludeIds: string[] = [],
  userCountry: string | null = null,
  fixedTitleId?: string,
): Promise<{ titleA: PairTitle; titleB: PairTitle } | null> {
  const [genrePrefs, previousChoices, ratedTitleIds, typeCoverage, streamingCoverage] = await Promise.all([
    prisma.userGenrePreference.findMany({ where: { userId } }),
    prisma.onboardingChoice.findMany({ where: { userId }, select: { titleAId: true, titleBId: true } }),
    prisma.userTitleRating.findMany({ where: { userId }, select: { titleId: true } }),
    prisma.userTypePreference.count({ where: { userId } }),
    userCountry
      ? prisma.title.count({ where: { voteCount: { gte: POPULAR_VOTE_COUNT }, ...streamingWhere(userCountry) } })
      : Promise.resolve(0),
  ]);
  const effectiveCountry = streamingCoverage >= MIN_STREAMING_COVERAGE ? userCountry : null;

  const shownIds = new Set<string>(extraExcludeIds);
  if (fixedTitleId) shownIds.add(fixedTitleId);
  for (const c of previousChoices) {
    shownIds.add(c.titleAId);
    shownIds.add(c.titleBId);
  }
  for (const r of ratedTitleIds) shownIds.add(r.titleId);
  const excludeIds = [...shownIds];

  // Format gap: only as a fresh pair, not while mid-swap (a swap should stay
  // focused on replacing the one card, not change what's being compared).
  // Retries without the streaming filter if the country-scoped pool has
  // nothing left in one of the two formats -- same reasoning as below.
  if (!fixedTitleId && typeCoverage < TYPE_COVERAGE_TARGET) {
    const typeGap =
      (await pickTypeGapPair(excludeIds, effectiveCountry)) ??
      (effectiveCountry ? await pickTypeGapPair(excludeIds, null) : null);
    if (typeGap) {
      return {
        titleA: toPairTitleWithPoster(typeGap.movie),
        titleB: toPairTitleWithPoster(typeGap.series),
      };
    }
  }

  const weightByGenre = new Map(genrePrefs.map((g) => [g.genreId, g.weight]));
  const slotsNeeded = fixedTitleId ? 1 : 2;

  let picked = await fillSlots(userId, excludeIds, weightByGenre, slotsNeeded, effectiveCountry);

  // The streaming-scoped pool shrinks by up to 2 titles every round (both
  // sides of a completed comparison are excluded from then on), so it can
  // run dry long before the real catalog does. Once it does, widen to the
  // whole catalog rather than declaring "no more comparisons" -- being
  // streamable was a preference among plausibly-seen titles, not a hard
  // requirement, and there should be plenty of catalog left to draw from.
  if (picked.length < slotsNeeded && effectiveCountry) {
    const more = await fillSlots(
      userId,
      [...excludeIds, ...picked.map((p) => p.id)],
      weightByGenre,
      slotsNeeded - picked.length,
      null,
    );
    picked = [...picked, ...more];
  }

  if (fixedTitleId) {
    const fixed = await prisma.title.findUnique({ where: { id: fixedTitleId }, select: CREDITS_SELECT });
    const replacement = picked[0];
    if (!fixed || !replacement) return null;
    return { titleA: toPairTitleWithPoster(replacement), titleB: toPairTitleWithPoster(fixed) };
  }

  const titleA = picked[0];
  const titleB = picked[1];
  if (!titleA || !titleB) return null;

  return { titleA: toPairTitleWithPoster(titleA), titleB: toPairTitleWithPoster(titleB) };
}

function toPairTitleWithPoster(t: {
  id: string;
  name: string;
  releaseYear: number | null;
  posterPath: string | null;
  type: TitleType;
}): PairTitle {
  return {
    id: t.id,
    name: t.name,
    releaseYear: t.releaseYear,
    posterUrl: tmdbPosterUrl(t.posterPath),
    type: t.type,
  };
}
