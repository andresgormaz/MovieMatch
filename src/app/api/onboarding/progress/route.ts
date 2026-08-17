import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ONBOARDING_ROUNDS } from "@/lib/onboardingPairs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const [favoriteMovie, favoriteSeries, roundsCompleted, anyChoiceAtAll] = await Promise.all([
    prisma.userTitleRating.findFirst({
      where: { userId, score: 10, title: { type: "MOVIE" } },
      select: { titleId: true },
    }),
    prisma.userTitleRating.findFirst({
      where: { userId, score: 10, title: { type: "SERIES" } },
      select: { titleId: true },
    }),
    prisma.onboardingChoice.count({ where: { userId, skipped: false } }),
    // Includes skipped rounds -- used only to decide whether a page reload
    // should resume into the compare phase (skip-only progress still means
    // "already past the seed screen").
    prisma.onboardingChoice.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    favoriteMovieDone: Boolean(favoriteMovie),
    favoriteSeriesDone: Boolean(favoriteSeries),
    roundsCompleted,
    roundsTarget: ONBOARDING_ROUNDS,
    hasStartedComparing: anyChoiceAtAll > 0,
  });
}
