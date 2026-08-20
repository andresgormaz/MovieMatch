import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbProfileUrl, tmdbPosterUrl, tmdb, hasTmdbKey } from "@/lib/tmdb";
import { displayTitleName } from "@/lib/titleDisplay";

const CREW_ROLE_LABELS: Record<string, string> = {
  Director: "Director",
  Creator: "Creador",
  Estudio: "Estudio",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { originalTitles: true },
  });
  const useOriginalTitles = user?.originalTitles ?? false;

  let person = await prisma.person.findUnique({ where: { id } });
  if (!person) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Lazy, one-time fetch: nobody imports a full bio for every Person up
  // front (most are never clicked into), so pull it from TMDB the first
  // time someone actually opens this page, then cache it.
  if (!person.detailsFetchedAt && hasTmdbKey()) {
    try {
      const details = await tmdb.personDetails(person.tmdbId);
      person = await prisma.person.update({
        where: { id },
        data: {
          biography: details.biography || null,
          birthday: details.birthday ? new Date(details.birthday) : null,
          deathday: details.deathday ? new Date(details.deathday) : null,
          placeOfBirth: details.place_of_birth || null,
          detailsFetchedAt: new Date(),
        },
      });
    } catch {
      // TMDB hiccup -- show whatever we already have; detailsFetchedAt
      // stays null so the next visit tries again instead of getting stuck.
    }
  }

  const titleSelect = {
    id: true,
    name: true,
    originalName: true,
    type: true,
    releaseYear: true,
    posterPath: true,
  } as const;

  const [castRows, crewRows] = await Promise.all([
    prisma.titleCast.findMany({ where: { personId: id }, include: { title: { select: titleSelect } } }),
    prisma.titleCrew.findMany({ where: { personId: id }, include: { title: { select: titleSelect } } }),
  ]);

  type TitleRow = (typeof castRows)[number]["title"];
  const filmographyByTitleId = new Map<string, { title: TitleRow; roles: Set<string> }>();
  for (const row of castRows) {
    const entry = filmographyByTitleId.get(row.title.id) ?? { title: row.title, roles: new Set<string>() };
    entry.roles.add("Actor");
    filmographyByTitleId.set(row.title.id, entry);
  }
  for (const row of crewRows) {
    const entry = filmographyByTitleId.get(row.title.id) ?? { title: row.title, roles: new Set<string>() };
    entry.roles.add(CREW_ROLE_LABELS[row.job] ?? row.job);
    filmographyByTitleId.set(row.title.id, entry);
  }

  const filmography = [...filmographyByTitleId.values()]
    .sort((a, b) => (b.title.releaseYear ?? 0) - (a.title.releaseYear ?? 0))
    .map(({ title, roles }) => ({
      id: title.id,
      name: displayTitleName(title, useOriginalTitles),
      type: title.type,
      releaseYear: title.releaseYear,
      posterUrl: tmdbPosterUrl(title.posterPath),
      roles: [...roles],
    }));

  return NextResponse.json({
    id: person.id,
    name: person.name,
    photoUrl: tmdbProfileUrl(person.profilePath),
    knownForDepartment: person.knownForDepartment,
    biography: person.biography,
    birthday: person.birthday,
    deathday: person.deathday,
    placeOfBirth: person.placeOfBirth,
    filmography,
  });
}
