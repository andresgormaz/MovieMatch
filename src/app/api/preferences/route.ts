import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { genrePreferenceSchema, countryPreferenceSchema } from "@/lib/validation";
import { countryName } from "@/lib/countries";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const [genres, countryRows, genrePrefs, countryPrefs] = await Promise.all([
    prisma.genre.findMany({ orderBy: { name: "asc" } }),
    prisma.title.findMany({
      where: { originCountry: { not: null } },
      select: { originCountry: true },
      distinct: ["originCountry"],
    }),
    prisma.userGenrePreference.findMany({ where: { userId } }),
    prisma.userCountryPreference.findMany({ where: { userId } }),
  ]);

  const countries = countryRows
    .map((r) => r.originCountry!)
    .sort()
    .map((code) => ({ code, name: countryName(code) }));

  return NextResponse.json({
    genres,
    countries,
    genrePreferences: genrePrefs,
    countryPreferences: countryPrefs,
  });
}

const bodySchema = z.object({
  genrePreferences: z.array(genrePreferenceSchema).optional(),
  countryPreferences: z.array(countryPreferenceSchema).optional(),
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

  const { genrePreferences = [], countryPreferences = [] } = parsed.data;

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
  ]);

  return NextResponse.json({ ok: true });
}
