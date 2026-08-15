import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl } from "@/lib/tmdb";
import type { Prisma } from "@/generated/prisma/client";
import { parseTitleFilterParams, buildTitleWhere } from "@/lib/titleFilters";

const PAGE_SIZE = 24;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const filterParams = parseTitleFilterParams(searchParams);
  const where = buildTitleWhere(filterParams);
  const sort = searchParams.get("sort") ?? "popularity";
  const pageParam = Number(searchParams.get("page"));
  const page = Math.max(1, Number.isFinite(pageParam) ? pageParam : 1);

  const orderBy: Prisma.TitleOrderByWithRelationInput =
    sort === "year"
      ? { releaseYear: "desc" }
      : sort === "score"
        ? { voteAverage: "desc" }
        : sort === "votes"
          ? { voteCount: "desc" }
          : { popularity: "desc" };

  const [titles, total] = await Promise.all([
    prisma.title.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        genres: { include: { genre: true } },
        crew: { where: { job: { in: ["Director", "Creator"] } }, include: { person: true } },
        ratings: { where: { userId: session.user.id }, select: { seen: true, score: true } },
      },
    }),
    prisma.title.count({ where }),
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
      voteAverage: t.voteAverage,
      voteCount: t.voteCount,
      budget: t.budget,
      genres: t.genres.map((g) => g.genre.name),
      directors: t.crew.map((c) => c.person.name),
      myRating: t.ratings[0] ?? null,
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
