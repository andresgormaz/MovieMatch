import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecommendations } from "@/lib/recommend";
import { tmdbPosterUrl } from "@/lib/tmdb";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type");
  const type = typeParam === "MOVIE" || typeParam === "SERIES" ? typeParam : undefined;

  const recommendations = await getRecommendations(session.user.id, { type, limit: 24 });

  return NextResponse.json({
    recommendations: recommendations.map((r) => ({ ...r, posterUrl: tmdbPosterUrl(r.posterPath) })),
  });
}
