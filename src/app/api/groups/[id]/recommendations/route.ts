import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGroupRecommendations } from "@/lib/recommend";
import { tmdbPosterUrl, tmdbLogoUrl } from "@/lib/tmdb";
import { parseTitleFilterParams, buildTitleWhere } from "@/lib/titleFilters";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "No eres miembro de este grupo" }, { status: 403 });

  // Providers/title language shown reflect the requesting member's own
  // preferences -- a group has no single shared catalog since those are
  // per-user.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { country: true, originalTitles: true },
  });
  const userCountry = user?.country ?? null;

  const { searchParams } = new URL(request.url);
  const filters = buildTitleWhere(parseTitleFilterParams(searchParams), userCountry);

  const recommendations = await getGroupRecommendations(id, {
    filters,
    limit: 24,
    userCountry,
    useOriginalTitles: user?.originalTitles ?? false,
  });

  return NextResponse.json({
    userCountry,
    recommendations: recommendations.map((r) => ({
      ...r,
      posterUrl: tmdbPosterUrl(r.posterPath),
      providers: r.providers.map((p) => ({ id: p.id, name: p.name, logoUrl: tmdbLogoUrl(p.logoPath) })),
    })),
  });
}
