import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbProfileUrl } from "@/lib/tmdb";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ people: [] });

  const people = await prisma.person.findMany({
    where: { name: { contains: q } },
    orderBy: { castRoles: { _count: "desc" } },
    take: 10,
  });

  return NextResponse.json({
    people: people.map((p) => ({ id: p.id, name: p.name, photoUrl: tmdbProfileUrl(p.profilePath) })),
  });
}
