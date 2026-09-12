import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { ONBOARDING_ROUNDS } from "@/lib/onboardingPairs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const [favoriteMovie, favoriteSeries, roundsCompleted, anyChoiceAtAll, samplePick] = await Promise.all([
    prisma.userTitleRating.findFirst({
      where: { userId, score: 5, title: { type: "MOVIE" } },
      select: { titleId: true },
    }),
    prisma.userTitleRating.findFirst({
      where: { userId, score: 5, title: { type: "SERIES" } },
      select: { titleId: true },
    }),
    prisma.onboardingChoice.count({ where: { userId, skipped: false } }),
    // Includes skipped rounds -- used only to decide whether a page reload
    // should resume into the compare phase (skip-only progress still means
    // "already past the seed screen").
    prisma.onboardingChoice.count({ where: { userId } }),
    // The catalog's single most popular title, shown as a "this is what a
    // recommendation looks like" teaser before asking for anything -- not
    // personalized (there's no signal yet), just general popularity.
    prisma.title.findFirst({
      orderBy: { popularity: "desc" },
      select: { id: true, name: true, type: true, releaseYear: true, posterPath: true, voteAverage: true },
    }),
  ]);

  return NextResponse.json({
    favoriteMovieDone: Boolean(favoriteMovie),
    favoriteSeriesDone: Boolean(favoriteSeries),
    roundsCompleted,
    roundsTarget: ONBOARDING_ROUNDS,
    hasStartedComparing: anyChoiceAtAll > 0,
    samplePick: samplePick && {
      id: samplePick.id,
      name: samplePick.name,
      type: samplePick.type,
      releaseYear: samplePick.releaseYear,
      posterUrl: tmdbPosterUrl(samplePick.posterPath),
      voteAverage: samplePick.voteAverage,
    },
  });
}
