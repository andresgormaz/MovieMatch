import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl, tmdbBackdropUrl, tmdbProfileUrl, tmdbLogoUrl } from "@/lib/tmdb";
import { countryName } from "@/lib/countries";
import { displayTitleName } from "@/lib/titleDisplay";
import { getTitleScoreBreakdown } from "@/lib/recommend";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { country: true, originalTitles: true },
  });
  const userCountry = user?.country ?? null;
  const useOriginalTitles = user?.originalTitles ?? false;

  const [title, myRating, wishlistEntry, scoreBreakdown] = await Promise.all([
    prisma.title.findUnique({
      where: { id },
      include: {
        genres: { include: { genre: true } },
        cast: { include: { person: true }, orderBy: { order: "asc" }, take: 12 },
        crew: { include: { person: true } },
        providers: { where: { countryCode: userCountry ?? "" }, include: { provider: true } },
        similar: { orderBy: { rank: "asc" } },
      },
    }),
    prisma.userTitleRating.findUnique({ where: { userId_titleId: { userId, titleId: id } } }),
    prisma.wishlist.findUnique({ where: { userId_titleId: { userId, titleId: id } } }),
    // Temporary (see recommend.ts) -- itemized "how was this score built"
    // detail for this title's page. Remove alongside getTitleScoreBreakdown
    // once the user's done sanity-checking the direct-sum formula.
    getTitleScoreBreakdown(userId, id, { userCountry, useOriginalTitles }),
  ]);

  if (!title) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // TitleSimilar only stores tmdbId+type (the related title might not be in
  // our catalog); resolve to whatever we actually have, in TMDB's order.
  const similarTitles =
    title.similar.length > 0
      ? await prisma.title.findMany({
          where: { OR: title.similar.map((s) => ({ tmdbId: s.relatedTmdbId, type: s.relatedType })) },
          select: {
            id: true,
            name: true,
            originalName: true,
            type: true,
            releaseYear: true,
            posterPath: true,
            tmdbId: true,
          },
        })
      : [];
  const similarByKey = new Map(similarTitles.map((t) => [`${t.tmdbId}:${t.type}`, t]));
  const orderedSimilar = title.similar
    .map((s) => similarByKey.get(`${s.relatedTmdbId}:${s.relatedType}`))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .slice(0, 10);

  return NextResponse.json({
    id: title.id,
    name: displayTitleName(title, useOriginalTitles),
    originalName: title.originalName,
    type: title.type,
    releaseYear: title.releaseYear,
    overview: title.overview,
    posterUrl: tmdbPosterUrl(title.posterPath, "w500"),
    backdropUrl: tmdbBackdropUrl(title.backdropPath),
    voteAverage: title.voteAverage,
    voteCount: title.voteCount,
    budget: title.budget,
    seasonsCount: title.seasonsCount,
    episodesCount: title.episodesCount,
    status: title.status,
    inProduction: title.inProduction,
    lastAirDate: title.lastAirDate,
    originCountry: title.originCountry,
    originCountryName: title.originCountry ? countryName(title.originCountry) : null,
    genres: title.genres.map((g) => g.genre.name),
    cast: title.cast.map((c) => ({ id: c.person.id, name: c.person.name, photoUrl: tmdbProfileUrl(c.person.profilePath) })),
    crew: title.crew.map((c) => ({
      id: c.person.id,
      name: c.person.name,
      job: c.job,
      photoUrl: tmdbProfileUrl(c.person.profilePath),
    })),
    providers: title.providers.map((p) => ({
      id: p.provider.id,
      name: p.provider.name,
      logoUrl: tmdbLogoUrl(p.provider.logoPath),
    })),
    similar: orderedSimilar.map((t) => ({
      id: t.id,
      name: displayTitleName(t, useOriginalTitles),
      type: t.type,
      releaseYear: t.releaseYear,
      posterUrl: tmdbPosterUrl(t.posterPath),
    })),
    myRating: myRating
      ? { seen: myRating.seen, score: myRating.score, notInterested: myRating.notInterested, watchProgress: myRating.watchProgress }
      : null,
    inWishlist: Boolean(wishlistEntry),
    score: scoreBreakdown?.score ?? 0,
    scoreBreakdown: scoreBreakdown?.breakdown ?? [],
  });
}
