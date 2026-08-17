import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { displayTitleName } from "@/lib/titleDisplay";

const RESULT_LIMIT = 8;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { originalTitles: true },
  });

  const titles = await prisma.title.findMany({
    where: {
      OR: [{ name: { contains: q } }, { originalName: { contains: q } }],
    },
    orderBy: { popularity: "desc" },
    take: RESULT_LIMIT,
    select: { id: true, name: true, originalName: true, type: true, releaseYear: true, posterPath: true },
  });

  return NextResponse.json({
    results: titles.map((t) => ({
      id: t.id,
      name: displayTitleName(t, user?.originalTitles ?? false),
      type: t.type,
      releaseYear: t.releaseYear,
      posterUrl: tmdbPosterUrl(t.posterPath),
    })),
  });
}
