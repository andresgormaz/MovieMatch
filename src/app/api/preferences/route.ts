import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  genrePreferenceSchema,
  countryPreferenceSchema,
  audiencePreferenceSchema,
  budgetPreferenceSchema,
  runtimePreferenceSchema,
} from "@/lib/validation";
import { countryName } from "@/lib/countries";
import { tmdbProfileUrl } from "@/lib/tmdb";
import { computeDerivedPersonTiers, effectivePersonScore } from "@/lib/personPreference";

const typePreferenceSchema = z.object({
  type: z.enum(["MOVIE", "SERIES"]),
  weight: z.number().int().min(-2).max(2),
});

// Backs both the legacy post-onboarding preference step and the new "Mis
// gustos" page -- everything a person's onboarding/VS activity has ever
// inferred (or that they've set by hand), in one place.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const [genres, countryRows, genrePrefs, countryPrefs, typePrefs, audiencePrefs, budgetPrefs, runtimePrefs, personPrefs, derivedTiers] =
    await Promise.all([
      prisma.genre.findMany({ orderBy: { name: "asc" } }),
      prisma.title.findMany({
        where: { originCountry: { not: null } },
        select: { originCountry: true },
        distinct: ["originCountry"],
      }),
      prisma.userGenrePreference.findMany({ where: { userId } }),
      prisma.userCountryPreference.findMany({ where: { userId } }),
      prisma.userTypePreference.findMany({ where: { userId } }),
      prisma.userAudiencePreference.findMany({ where: { userId } }),
      prisma.userBudgetPreference.findMany({ where: { userId } }),
      prisma.userRuntimePreference.findMany({ where: { userId } }),
      prisma.userPersonRating.findMany({
        where: { userId },
        include: { person: { select: { id: true, name: true, profilePath: true, knownForDepartment: true } } },
      }),
      computeDerivedPersonTiers(userId),
    ]);

  const countries = countryRows
    .map((r) => r.originCountry!)
    .sort()
    .map((code) => ({ code, name: countryName(code) }));

  // Merge explicit (manual, always wins) and derived (from accumulated
  // 4-5-star ratings) actor/director signal into one list for "Mis gustos" --
  // people who only have a derived tier show up too (isInferred: true), so
  // they're visible and editable even before anyone has rated them by hand.
  const manualByPerson = new Map(personPrefs.map((p) => [p.personId, p]));
  const derivedOnlyPersonIds = [...derivedTiers.keys()].filter((id) => !manualByPerson.has(id));
  const derivedOnlyPeople =
    derivedOnlyPersonIds.length > 0
      ? await prisma.person.findMany({
          where: { id: { in: derivedOnlyPersonIds } },
          select: { id: true, name: true, profilePath: true, knownForDepartment: true },
        })
      : [];
  const personById = new Map(derivedOnlyPeople.map((p) => [p.id, p]));

  const personRatings = [
    ...personPrefs.map((p) => ({
      personId: p.personId,
      score: p.score,
      isInferred: false,
      name: p.person.name,
      photoUrl: tmdbProfileUrl(p.person.profilePath),
      department: p.person.knownForDepartment,
    })),
    ...derivedOnlyPersonIds.flatMap((personId) => {
      const person = personById.get(personId);
      if (!person) return [];
      return [
        {
          personId,
          score: effectivePersonScore(personId, new Map(), derivedTiers),
          isInferred: true,
          name: person.name,
          photoUrl: tmdbProfileUrl(person.profilePath),
          department: person.knownForDepartment,
        },
      ];
    }),
  ].sort((a, b) => b.score - a.score);

  return NextResponse.json({
    genres,
    countries,
    genrePreferences: genrePrefs,
    countryPreferences: countryPrefs,
    typePreferences: typePrefs,
    audiencePreferences: audiencePrefs,
    budgetPreferences: budgetPrefs,
    runtimePreferences: runtimePrefs,
    personRatings,
  });
}

const bodySchema = z.object({
  genrePreferences: z.array(genrePreferenceSchema).optional(),
  countryPreferences: z.array(countryPreferenceSchema).optional(),
  typePreferences: z.array(typePreferenceSchema).optional(),
  audiencePreferences: z.array(audiencePreferenceSchema).optional(),
  budgetPreferences: z.array(budgetPreferenceSchema).optional(),
  runtimePreferences: z.array(runtimePreferenceSchema).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const {
    genrePreferences = [],
    countryPreferences = [],
    typePreferences = [],
    audiencePreferences = [],
    budgetPreferences = [],
    runtimePreferences = [],
  } = parsed.data;

  await prisma.$transaction([
    ...genrePreferences.map((g) =>
      prisma.userGenrePreference.upsert({
        where: { userId_genreId: { userId, genreId: g.genreId } },
        update: { weight: g.weight },
        create: { userId, genreId: g.genreId, weight: g.weight },
      }),
    ),
    ...countryPreferences.map((c) =>
      prisma.userCountryPreference.upsert({
        where: { userId_countryCode: { userId, countryCode: c.countryCode } },
        update: { weight: c.weight },
        create: { userId, countryCode: c.countryCode, weight: c.weight },
      }),
    ),
    ...typePreferences.map((t) =>
      prisma.userTypePreference.upsert({
        where: { userId_type: { userId, type: t.type } },
        update: { weight: t.weight },
        create: { userId, type: t.type, weight: t.weight },
      }),
    ),
    ...audiencePreferences.map((a) =>
      prisma.userAudiencePreference.upsert({
        where: { userId_tier: { userId, tier: a.tier } },
        update: { weight: a.weight },
        create: { userId, tier: a.tier, weight: a.weight },
      }),
    ),
    ...budgetPreferences.map((b) =>
      prisma.userBudgetPreference.upsert({
        where: { userId_tier: { userId, tier: b.tier } },
        update: { weight: b.weight },
        create: { userId, tier: b.tier, weight: b.weight },
      }),
    ),
    ...runtimePreferences.map((r) =>
      prisma.userRuntimePreference.upsert({
        where: { userId_bucket: { userId, bucket: r.bucket } },
        update: { weight: r.weight },
        create: { userId, bucket: r.bucket, weight: r.weight },
      }),
    ),
  ]);

  return NextResponse.json({ ok: true });
}
