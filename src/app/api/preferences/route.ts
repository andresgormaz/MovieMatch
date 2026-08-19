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
import { computeMergedPreferences } from "@/lib/preferenceCounts";

const typePreferenceSchema = z.object({
  type: z.enum(["MOVIE", "SERIES"]),
  weight: z.number().int().min(-2).max(2),
});

const AUDIENCE_LABELS: Record<string, string> = { MAINSTREAM: "Masivo", INDIE: "Independiente" };
const BUDGET_LABELS: Record<string, string> = { MEGA: "Megaproducción", SMALL: "Bajo presupuesto" };
const RUNTIME_LABELS: Record<string, string> = { SHORT: "Duración corta", MEDIUM: "Duración media", LONG: "Duración larga" };
const POPULARITY_LABELS: Record<string, string> = {
  LOW: "Poca popularidad (TMDB)",
  MID: "Popularidad media (TMDB)",
  HIGH: "Muy popular (TMDB)",
};
const TYPE_LABELS: Record<string, string> = { MOVIE: "Películas", SERIES: "Series" };

// Backs both the legacy post-onboarding preference step and the new "Mis
// gustos" page -- everything a person's onboarding/VS activity has ever
// inferred (or that they've set by hand), in one place.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const [genres, countryRows, genrePrefs, countryPrefs, typePrefs, audiencePrefs, budgetPrefs, runtimePrefs, personPrefs, merged] =
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
      computeMergedPreferences(userId),
    ]);

  const countries = countryRows
    .map((r) => r.originCountry!)
    .sort()
    .map((code) => ({ code, name: countryName(code) }));

  // Merge explicit (manual, always wins) and derived (from accumulated "vs"
  // wins + 4-5-star ratings) actor/director signal into one list for "Mis
  // gustos" -- people who only have a derived score show up too (isInferred:
  // true), so they're visible and editable even before anyone has rated
  // them by hand.
  const manualByPerson = new Map(personPrefs.map((p) => [p.personId, p]));
  const derivedOnlyPersonIds = [...merged.person.keys()].filter((id) => !manualByPerson.has(id));
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
          score: merged.person.get(personId) ?? 0,
          isInferred: true,
          name: person.name,
          photoUrl: tmdbProfileUrl(person.profilePath),
          department: person.knownForDepartment,
        },
      ];
    }),
  ].sort((a, b) => b.score - a.score);

  // A flat "every preference, plainly, with its current score" view -- the
  // section the user asked to be able to open and see everything at a
  // glance, separate from the per-dimension edit controls below. Bounded
  // dimensions (type/audience/budget/runtime/popularity) always show every
  // option, even at 0, since there are only a couple each; genre/country/
  // person are filtered to non-zero, or the list would be mostly noise.
  const genreNameById = new Map(genres.map((g) => [g.id, g.name]));
  const summary = [
    ...typePrefs.map((t) => ({ category: "Tipo", label: TYPE_LABELS[t.type] ?? t.type, score: t.weight })),
    ...[...merged.genre.entries()]
      .filter(([, score]) => score !== 0)
      .map(([genreId, score]) => ({ category: "Género", label: genreNameById.get(genreId) ?? `Género ${genreId}`, score })),
    ...(["MAINSTREAM", "INDIE"] as const).map((tier) => ({
      category: "Masivo/independiente",
      label: AUDIENCE_LABELS[tier],
      score: merged.audience.get(tier) ?? 0,
    })),
    ...(["MEGA", "SMALL"] as const).map((tier) => ({
      category: "Presupuesto",
      label: BUDGET_LABELS[tier],
      score: merged.budget.get(tier) ?? 0,
    })),
    ...(["SHORT", "MEDIUM", "LONG"] as const).map((bucket) => ({
      category: "Duración",
      label: RUNTIME_LABELS[bucket],
      score: merged.runtime.get(bucket) ?? 0,
    })),
    ...(["LOW", "MID", "HIGH"] as const).map((range) => ({
      category: "Popularidad",
      label: POPULARITY_LABELS[range],
      score: merged.popularity.get(range) ?? 0,
    })),
    ...[...merged.country.entries()]
      .filter(([, score]) => score !== 0)
      .map(([code, score]) => ({ category: "País", label: countryName(code), score })),
    ...personRatings
      .filter((p) => p.score !== 0)
      .map((p) => ({ category: "Actor/director", label: p.name, score: p.score })),
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
    summary,
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
