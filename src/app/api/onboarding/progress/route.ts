import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ONBOARDING_ROUNDS } from "@/lib/onboardingPairs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const [favoriteMovie, favoriteSeries, roundsCompleted] = await Promise.all([
    prisma.userTitleRating.findFirst({
      where: { userId, score: 10, title: { type: "MOVIE" } },
      select: { titleId: true },
    }),
    prisma.userTitleRating.findFirst({
      where: { userId, score: 10, title: { type: "SERIES" } },
      select: { titleId: true },
    }),
    prisma.onboardingChoice.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    favoriteMovieDone: Boolean(favoriteMovie),
    favoriteSeriesDone: Boolean(favoriteSeries),
    roundsCompleted,
    roundsTarget: ONBOARDING_ROUNDS,
  });
}
