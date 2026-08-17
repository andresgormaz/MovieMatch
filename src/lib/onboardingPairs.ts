import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl } from "@/lib/tmdb";

// Short on purpose: the point of the new onboarding is a couple of minutes,
// not a marathon. Two favorites (seed) + this many "which do you like more"
// rounds is enough to spread across several genres without wearing anyone out.
export const ONBOARDING_ROUNDS = 7;

// "Probably actually seen this" cutoff -- keeps onboarding comparisons to
// titles popular enough that picking one over the other is a meaningful
// preference signal, not a guess between two things nobody's heard of.
// Genuinely well-known titles clear this by a wide margin (tens of
// thousands of votes); this is a floor, not a target.
const POPULAR_VOTE_COUNT = 1000;

const MAX_GENRE_WEIGHT = 2;
const MIN_GENRE_WEIGHT = -2;

export interface PairTitle {
  id: string;
  name: string;
  releaseYear: number | null;
  posterUrl: string | null;
  type: "MOVIE" | "SERIES";
}

// Bumps genre preference toward a title's genres by `delta`, clamped to the
// same -2..2 scale the (optional, post-onboarding) manual preferences page
// uses -- an inferred signal never jumps past what an explicit one could
// have set. Only ever increases: onboarding never guesses that someone
// dislikes something.
async function bumpGenrePreferences(userId: string, titleId: string, delta: number) {
  const genres = await prisma.titleGenre.findMany({ where: { titleId }, select: { genreId: true } });
  if (genres.length === 0) return;

  const existing = await prisma.userGenrePreference.findMany({
    where: { userId, genreId: { in: genres.map((g) => g.genreId) } },
  });
  const existingByGenre = new Map(existing.map((e) => [e.genreId, e.weight]));

  for (const { genreId } of genres) {
    const current = existingByGenre.get(genreId) ?? 0;
    const next = Math.max(MIN_GENRE_WEIGHT, Math.min(MAX_GENRE_WEIGHT, current + delta));
    await prisma.userGenrePreference.upsert({
      where: { userId_genreId: { userId, genreId } },
      update: { weight: next },
      create: { userId, genreId, weight: next },
    });
  }
}

// Credits a title's lead cast + director/creator with a mild "liked" signal
// -- but only fills gaps (never overwrites a rating the person set
// explicitly, e.g. a dislike on the optional actors page).
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
// explicitly named, so it's recorded as a real rating (score 10, seen) as
// well as a strong genre/cast bump, unlike pairwise picks below.
export async function recordFavorite(userId: string, titleId: string) {
  await prisma.userTitleRating.upsert({
    where: { userId_titleId: { userId, titleId } },
    update: { seen: true, score: 10 },
    create: { userId, titleId, seen: true, score: 10 },
  });
  await Promise.all([bumpGenrePreferences(userId, titleId, MAX_GENRE_WEIGHT), bumpPersonPreferences(userId, titleId)]);
}

// A pairwise pick is weaker evidence than a favorite (we don't know they've
// actually seen either title, just that they'd rather watch something like
// the winner) -- logged for coverage tracking, and only the winner nudges
// preferences, by a smaller amount, never the loser.
export async function recordPairWinner(userId: string, titleAId: string, titleBId: string, winnerId: string) {
  if (winnerId !== titleAId && winnerId !== titleBId) {
    throw new Error("winnerId must be titleAId or titleBId");
  }
  await prisma.onboardingChoice.create({ data: { userId, titleAId, titleBId, winnerId } });
  await Promise.all([bumpGenrePreferences(userId, winnerId, 1), bumpPersonPreferences(userId, winnerId)]);
}

// "No vi ninguna de las dos": still logged (skipped: true) so both titles
// go into `shownIds` below and never come back up in a later round -- but
// no preference bump, and it doesn't count toward ONBOARDING_ROUNDS (see
// the `skipped: false` filters wherever rounds get counted).
export async function recordPairSkip(userId: string, titleAId: string, titleBId: string) {
  await prisma.onboardingChoice.create({
    data: { userId, titleAId, titleBId, winnerId: titleAId, skipped: true },
  });
}

// Picks the most-voted not-yet-shown title for a given genre, requiring
// POPULAR_VOTE_COUNT+ votes -- no fallback to a weaker candidate here on
// purpose. A genre with nothing left that clears the bar should be skipped
// entirely (see pickNextPair's loop), not padded out with something
// obscure just to fill the round.
async function pickCandidateForGenre(genreId: number, excludeIds: string[]) {
  return prisma.title.findFirst({
    where: {
      genres: { some: { genreId } },
      id: { notIn: excludeIds.length > 0 ? excludeIds : undefined },
      voteCount: { gte: POPULAR_VOTE_COUNT },
    },
    orderBy: { voteCount: "desc" },
  });
}

// Last-resort fallback when genre coverage can't fill both slots (e.g. a
// thin catalog, or every popular title in the remaining genres already
// shown) -- still prefers real vote counts over TMDB's day-to-day
// "popularity" score, which can spike for something obscure that's merely
// trending. Only drops to popularity when nothing has vote data at all
// (the local fallback dataset used without a TMDB key).
async function pickPopularFallback(excludeIds: string[], take: number) {
  const where = { id: { notIn: excludeIds.length > 0 ? excludeIds : undefined } };
  const byVotes = await prisma.title.findMany({
    where: { ...where, voteCount: { gte: POPULAR_VOTE_COUNT } },
    orderBy: { voteCount: "desc" },
    take,
  });
  if (byVotes.length >= take) return byVotes;
  const more = await prisma.title.findMany({
    where: { ...where, id: { notIn: [...excludeIds, ...byVotes.map((t) => t.id)] } },
    orderBy: { popularity: "desc" },
    take: take - byVotes.length,
  });
  return [...byVotes, ...more];
}

// The adaptive step: picks the next pair to compare, favoring genres the
// user hasn't shown a preference for yet (lowest UserGenrePreference weight
// first), so 7 short rounds spread across the catalog instead of drilling
// into whatever the first favorite happened to be about.
export async function pickNextPair(
  userId: string,
  extraExcludeIds: string[] = [],
): Promise<{ titleA: PairTitle; titleB: PairTitle } | null> {
  const [genrePrefs, previousChoices, favoriteRatings] = await Promise.all([
    prisma.userGenrePreference.findMany({ where: { userId } }),
    prisma.onboardingChoice.findMany({ where: { userId }, select: { titleAId: true, titleBId: true } }),
    prisma.userTitleRating.findMany({ where: { userId, score: 10 }, select: { titleId: true } }),
  ]);

  const shownIds = new Set<string>(extraExcludeIds);
  for (const c of previousChoices) {
    shownIds.add(c.titleAId);
    shownIds.add(c.titleBId);
  }
  for (const f of favoriteRatings) shownIds.add(f.titleId);

  const weightByGenre = new Map(genrePrefs.map((g) => [g.genreId, g.weight]));

  // Only consider genres that actually have enough popular titles to draw
  // from -- ranked least-covered first, most-popular-in-catalog as tiebreak
  // so an obscure genre with a single title doesn't jump the queue.
  const genreCounts = await prisma.titleGenre.groupBy({
    by: ["genreId"],
    _count: { titleId: true },
    where: { title: { voteCount: { gte: POPULAR_VOTE_COUNT } } },
  });
  const eligibleGenres = genreCounts
    .filter((g) => g._count.titleId >= 2)
    .sort((a, b) => {
      const wa = weightByGenre.get(a.genreId) ?? 0;
      const wb = weightByGenre.get(b.genreId) ?? 0;
      if (wa !== wb) return wa - wb;
      return b._count.titleId - a._count.titleId;
    });

  const excludeIds = [...shownIds];
  const picked: { title: Awaited<ReturnType<typeof pickCandidateForGenre>>; genreId: number }[] = [];
  for (const g of eligibleGenres) {
    if (picked.length >= 2) break;
    if (picked.some((p) => p.genreId === g.genreId)) continue;
    const candidate = await pickCandidateForGenre(
      g.genreId,
      [...excludeIds, ...picked.map((p) => p.title?.id).filter((id): id is string => Boolean(id))],
    );
    if (candidate) picked.push({ title: candidate, genreId: g.genreId });
  }

  // Fallback for a thin catalog, or when the remaining eligible genres ran
  // out of popular unshown titles: grab the most popular titles left,
  // genre coverage or not.
  if (picked.length < 2) {
    const fallback = await pickPopularFallback(
      [...excludeIds, ...picked.map((p) => p.title?.id).filter((id): id is string => Boolean(id))],
      2 - picked.length,
    );
    for (const t of fallback) picked.push({ title: t, genreId: -1 });
  }

  const titleA = picked[0]?.title;
  const titleB = picked[1]?.title;
  if (!titleA || !titleB) return null;

  return { titleA: toPairTitleWithPoster(titleA), titleB: toPairTitleWithPoster(titleB) };
}

function toPairTitleWithPoster(t: {
  id: string;
  name: string;
  releaseYear: number | null;
  posterPath: string | null;
  type: "MOVIE" | "SERIES";
}): PairTitle {
  return {
    id: t.id,
    name: t.name,
    releaseYear: t.releaseYear,
    posterUrl: tmdbPosterUrl(t.posterPath),
    type: t.type,
  };
}
