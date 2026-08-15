import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl } from "@/lib/tmdb";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 24;

function parseNum(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type");
  const type = typeParam === "MOVIE" || typeParam === "SERIES" ? typeParam : undefined;

  const yearFrom = parseNum(searchParams.get("yearFrom"));
  const yearTo = parseNum(searchParams.get("yearTo"));
  const scoreFrom = parseNum(searchParams.get("scoreFrom"));
  const scoreTo = parseNum(searchParams.get("scoreTo"));
  const votesMin = parseNum(searchParams.get("votesMin"));
  const budgetFrom = parseNum(searchParams.get("budgetFrom"));
  const budgetTo = parseNum(searchParams.get("budgetTo"));
  const genreIds = parseList(searchParams.get("genreIds")).map(Number).filter(Number.isFinite);
  const countries = parseList(searchParams.get("countries"));
  const actorId = searchParams.get("actorId") || undefined;
  const directorId = searchParams.get("directorId") || undefined;
  const sort = searchParams.get("sort") ?? "popularity";
  const page = Math.max(1, parseNum(searchParams.get("page")) ?? 1);

  const where: Prisma.TitleWhereInput = {
    ...(type ? { type } : {}),
    ...(yearFrom !== undefined || yearTo !== undefined
      ? { releaseYear: { gte: yearFrom, lte: yearTo } }
      : {}),
    ...(scoreFrom !== undefined || scoreTo !== undefined
      ? { voteAverage: { gte: scoreFrom, lte: scoreTo } }
      : {}),
    ...(votesMin !== undefined ? { voteCount: { gte: votesMin } } : {}),
    ...(budgetFrom !== undefined || budgetTo !== undefined
      ? { budget: { gte: budgetFrom, lte: budgetTo } }
      : {}),
    ...(genreIds.length > 0 ? { genres: { some: { genreId: { in: genreIds } } } } : {}),
    ...(countries.length > 0 ? { originCountry: { in: countries } } : {}),
    ...(actorId ? { cast: { some: { personId: actorId } } } : {}),
    ...(directorId ? { crew: { some: { personId: directorId, job: { in: ["Director", "Creator"] } } } } : {}),
  };

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
