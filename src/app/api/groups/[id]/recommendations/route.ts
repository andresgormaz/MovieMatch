import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGroupRecommendations } from "@/lib/recommend";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { parseTitleFilterParams, buildTitleWhere } from "@/lib/titleFilters";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "No sos miembro de este grupo" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const filters = buildTitleWhere(parseTitleFilterParams(searchParams));

  const recommendations = await getGroupRecommendations(id, { filters, limit: 24 });

  return NextResponse.json({
    recommendations: recommendations.map((r) => ({ ...r, posterUrl: tmdbPosterUrl(r.posterPath) })),
  });
}
