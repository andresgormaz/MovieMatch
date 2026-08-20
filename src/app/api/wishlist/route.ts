import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl, tmdbLogoUrl } from "@/lib/tmdb";
import { wishlistSchema } from "@/lib/validation";
import { displayTitleName } from "@/lib/titleDisplay";
import { parseTitleFilterParams, buildTitleWhere } from "@/lib/titleFilters";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { country: true, originalTitles: true },
  });
  const userCountry = user?.country ?? null;

  const { searchParams } = new URL(request.url);
  const filterParams = parseTitleFilterParams(searchParams);
  const titleWhere = buildTitleWhere(filterParams, userCountry);

  const entries = await prisma.wishlist.findMany({
    where: { userId, title: titleWhere },
    orderBy: { addedAt: "desc" },
    include: {
      title: {
        include: {
          genres: { include: { genre: true } },
          crew: { where: { job: { in: ["Director", "Creator"] } }, include: { person: true } },
          providers: { where: { countryCode: userCountry ?? "" }, include: { provider: true } },
        },
      },
    },
  });

  return NextResponse.json({
    items: entries.map((e) => ({
      id: e.title.id,
      name: displayTitleName(e.title, user?.originalTitles ?? false),
      type: e.title.type,
      releaseYear: e.title.releaseYear,
      overview: e.title.overview,
      posterUrl: tmdbPosterUrl(e.title.posterPath),
      voteAverage: e.title.voteAverage,
      voteCount: e.title.voteCount,
      genres: e.title.genres.map((g) => g.genre.name),
      directors: e.title.crew.map((c) => c.person.name),
      providers: e.title.providers.map((p) => ({
        id: p.provider.id,
        name: p.provider.name,
        logoUrl: tmdbLogoUrl(p.provider.logoPath),
      })),
      addedAt: e.addedAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  const parsed = wishlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  await prisma.wishlist.upsert({
    where: { userId_titleId: { userId, titleId: parsed.data.titleId } },
    update: {},
    create: { userId, titleId: parsed.data.titleId },
  });

  return NextResponse.json({ ok: true });
}
