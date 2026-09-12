import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbProfileUrl } from "@/lib/tmdb";

const BATCH_SIZE = 12;

const DEPARTMENT_ES: Record<string, string> = {
  Acting: "Actuación",
  Directing: "Dirección",
  Writing: "Guion",
  Production: "Producción",
  Camera: "Fotografía",
  Editing: "Edición",
  Sound: "Sonido",
};

function translateDepartment(department: string | null): string | null {
  if (!department) return null;
  return DEPARTMENT_ES[department] ?? department;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = session.user.id;

  // Prioritize people who appear in titles the user marked as seen -
  // rating people you actually recognize is more meaningful than random names.
  const seenTitleIds = (
    await prisma.userTitleRating.findMany({
      where: { userId, seen: true },
      select: { titleId: true },
    })
  ).map((r) => r.titleId);

  const alreadyRated = (
    await prisma.userPersonRating.findMany({ where: { userId }, select: { personId: true } })
  ).map((r) => r.personId);

  let people = await prisma.person.findMany({
    where: {
      id: { notIn: alreadyRated },
      OR: [
        { castRoles: { some: { titleId: { in: seenTitleIds } } } },
        { crewRoles: { some: { titleId: { in: seenTitleIds } } } },
      ],
    },
    orderBy: { castRoles: { _count: "desc" } },
    take: BATCH_SIZE,
  });

  if (people.length < BATCH_SIZE) {
    const fallback = await prisma.person.findMany({
      where: { id: { notIn: [...alreadyRated, ...people.map((p) => p.id)] } },
      orderBy: { castRoles: { _count: "desc" } },
      take: BATCH_SIZE - people.length,
    });
    people = [...people, ...fallback];
  }

  const ratedCount = alreadyRated.length;

  return NextResponse.json({
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      photoUrl: tmdbProfileUrl(p.profilePath),
      department: translateDepartment(p.knownForDepartment),
    })),
    progress: { rated: ratedCount },
  });
}
