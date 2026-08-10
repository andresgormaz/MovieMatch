import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl } from "@/lib/tmdb";

const BATCH_SIZE = 12;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = session.user.id;

  const [titles, ratedCount, totalCount] = await Promise.all([
    prisma.title.findMany({
      where: { ratings: { none: { userId } } },
      orderBy: { onboardingRank: "asc" },
      take: BATCH_SIZE,
      include: {
        genres: { include: { genre: true } },
        crew: { where: { job: { in: ["Director", "Creator"] } }, include: { person: true } },
      },
    }),
    prisma.userTitleRating.count({ where: { userId } }),
    prisma.title.count(),
  ]);

  return NextResponse.json({
    titles: titles.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      releaseYear: t.releaseYear,
      overview: t.overview,
      posterUrl: tmdbPosterUrl(t.posterPath),
      originCountry: t.originCountry,
      genres: t.genres.map((g) => g.genre.name),
      directors: t.crew.map((c) => c.person.name),
    })),
    progress: { rated: ratedCount, total: totalCount },
  });
}
