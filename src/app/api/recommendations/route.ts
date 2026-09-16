import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecommendations } from "@/lib/recommend";
import { tmdbPosterUrl, tmdbBackdropUrl, tmdbLogoUrl } from "@/lib/tmdb";
import { parseTitleFilterParams, buildTitleWhere } from "@/lib/titleFilters";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { country: true, originalTitles: true },
  });
  const userCountry = user?.country ?? null;

  const { searchParams } = new URL(request.url);
  const filters = buildTitleWhere(parseTitleFilterParams(searchParams), userCountry);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT;

  const recommendations = await getRecommendations(session.user.id, {
    filters,
    limit,
    userCountry,
    useOriginalTitles: user?.originalTitles ?? false,
  });

  return NextResponse.json({
    userCountry,
    recommendations: recommendations.map((r) => ({
      ...r,
      posterUrl: tmdbPosterUrl(r.posterPath),
      backdropUrl: tmdbBackdropUrl(r.backdropPath),
      providers: r.providers.map((p) => ({ id: p.id, name: p.name, logoUrl: tmdbLogoUrl(p.logoPath) })),
    })),
  });
}
