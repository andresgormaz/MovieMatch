import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { preferenceAdjustSchema } from "@/lib/validation";
import { countryName } from "@/lib/countries";
import { computeMergedPreferences } from "@/lib/preferenceCounts";

const AUDIENCE_LABELS: Record<string, string> = { MAINSTREAM: "Masivo", INDIE: "Independiente" };
const BUDGET_LABELS: Record<string, string> = { MEGA: "Megaproducción", SMALL: "Bajo presupuesto" };
const RUNTIME_LABELS: Record<string, string> = { SHORT: "Duración corta", MEDIUM: "Duración media", LONG: "Duración larga" };
const POPULARITY_LABELS: Record<string, string> = {
  LOW: "Poca popularidad (TMDB)",
  MID: "Popularidad media (TMDB)",
  HIGH: "Muy popular (TMDB)",
};
const TYPE_LABELS: Record<string, string> = { MOVIE: "Películas", SERIES: "Series" };

interface SummaryItem {
  key: string;
  label: string;
  score: number;
}
interface SummaryGroup {
  category: string;
  title: string;
  items: SummaryItem[];
}

function byScoreDesc(a: SummaryItem, b: SummaryItem) {
  return b.score - a.score;
}

// Everything a person's onboarding/"vs" activity has ever inferred (or that
// they've set by hand), grouped by kind and ordered by the score currently
// in effect for scoring -- the single view "Mis gustos" needs, replacing
// the old per-dimension -2..2 selectors.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const [genres, countryRows, prefs] = await Promise.all([
    prisma.genre.findMany({ orderBy: { name: "asc" } }),
    prisma.title.findMany({
      where: { originCountry: { not: null } },
      select: { originCountry: true },
      distinct: ["originCountry"],
    }),
    computeMergedPreferences(userId),
  ]);

  const countries = countryRows
    .map((r) => r.originCountry!)
    .sort()
    .map((code) => ({ code, name: countryName(code) }));

  const actorIds = [...prefs.actor.keys()].filter((id) => (prefs.actor.get(id) ?? 0) !== 0);
  const directorIds = [...prefs.director.keys()].filter((id) => (prefs.director.get(id) ?? 0) !== 0);
  const personIds = [...new Set([...actorIds, ...directorIds])];
  const people =
    personIds.length > 0
      ? await prisma.person.findMany({ where: { id: { in: personIds } }, select: { id: true, name: true } })
      : [];
  const nameByPerson = new Map(people.map((p) => [p.id, p.name]));

  const groups: SummaryGroup[] = [
    {
      category: "type",
      title: "Tipo",
      items: (["MOVIE", "SERIES"] as const)
        .map((type) => ({ key: type, label: TYPE_LABELS[type], score: prefs.type.get(type) ?? 0 }))
        .sort(byScoreDesc),
    },
    {
      category: "genre",
      title: "Género (0-10)",
      items: genres
        .map((g) => ({ key: String(g.id), label: g.name, score: Math.round((prefs.genre.get(g.id) ?? 0) * 10) / 10 }))
        .sort(byScoreDesc),
    },
    {
      category: "audience",
      title: "Masivo o independiente",
      items: (["MAINSTREAM", "INDIE"] as const)
        .map((tier) => ({ key: tier, label: AUDIENCE_LABELS[tier], score: prefs.audience.get(tier) ?? 0 }))
        .sort(byScoreDesc),
    },
    {
      category: "budget",
      title: "Presupuesto (solo películas)",
      items: (["MEGA", "SMALL"] as const)
        .map((tier) => ({ key: tier, label: BUDGET_LABELS[tier], score: prefs.budget.get(tier) ?? 0 }))
        .sort(byScoreDesc),
    },
    {
      category: "runtime",
      title: "Duración",
      items: (["SHORT", "MEDIUM", "LONG"] as const)
        .map((bucket) => ({ key: bucket, label: RUNTIME_LABELS[bucket], score: prefs.runtime.get(bucket) ?? 0 }))
        .sort(byScoreDesc),
    },
    {
      category: "popularity",
      title: "Popularidad",
      items: (["LOW", "MID", "HIGH"] as const)
        .map((range) => ({ key: range, label: POPULARITY_LABELS[range], score: prefs.popularity.get(range) ?? 0 }))
        .sort(byScoreDesc),
    },
    {
      category: "country",
      title: "País de origen",
      items: countries.map((c) => ({ key: c.code, label: c.name, score: prefs.country.get(c.code) ?? 0 })).sort(byScoreDesc),
    },
    {
      category: "director",
      title: "Directores",
      items: directorIds
        .map((id) => ({ key: id, label: nameByPerson.get(id) ?? id, score: prefs.director.get(id) ?? 0 }))
        .sort(byScoreDesc),
    },
    {
      category: "actor",
      title: "Actores",
      items: actorIds
        .map((id) => ({ key: id, label: nameByPerson.get(id) ?? id, score: prefs.actor.get(id) ?? 0 }))
        .sort(byScoreDesc),
    },
  ];

  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  const parsed = preferenceAdjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const { category, key, delta } = parsed.data;

  switch (category) {
    case "type": {
      if (key !== "MOVIE" && key !== "SERIES") {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
      }
      await prisma.userTypePreference.upsert({
        where: { userId_type: { userId, type: key } },
        update: { weight: { increment: delta } },
        create: { userId, type: key, weight: delta },
      });
      break;
    }
    case "genre": {
      const genreId = Number(key);
      if (!Number.isInteger(genreId)) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
      await prisma.userGenrePreference.upsert({
        where: { userId_genreId: { userId, genreId } },
        update: { weight: { increment: delta } },
        create: { userId, genreId, weight: delta },
      });
      break;
    }
    case "audience": {
      if (key !== "MAINSTREAM" && key !== "INDIE") {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
      }
      await prisma.userAudiencePreference.upsert({
        where: { userId_tier: { userId, tier: key } },
        update: { weight: { increment: delta } },
        create: { userId, tier: key, weight: delta },
      });
      break;
    }
    case "budget": {
      if (key !== "MEGA" && key !== "SMALL") {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
      }
      await prisma.userBudgetPreference.upsert({
        where: { userId_tier: { userId, tier: key } },
        update: { weight: { increment: delta } },
        create: { userId, tier: key, weight: delta },
      });
      break;
    }
    case "runtime": {
      if (key !== "SHORT" && key !== "MEDIUM" && key !== "LONG") {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
      }
      await prisma.userRuntimePreference.upsert({
        where: { userId_bucket: { userId, bucket: key } },
        update: { weight: { increment: delta } },
        create: { userId, bucket: key, weight: delta },
      });
      break;
    }
    case "popularity": {
      if (key !== "LOW" && key !== "MID" && key !== "HIGH") {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
      }
      await prisma.userPopularityPreference.upsert({
        where: { userId_range: { userId, range: key } },
        update: { weight: { increment: delta } },
        create: { userId, range: key, weight: delta },
      });
      break;
    }
    case "country": {
      await prisma.userCountryPreference.upsert({
        where: { userId_countryCode: { userId, countryCode: key } },
        update: { weight: { increment: delta } },
        create: { userId, countryCode: key, weight: delta },
      });
      break;
    }
    case "actor":
    case "director": {
      // Same underlying table for both -- see preferenceCounts.ts's note on
      // sharing one manual adjustment across both roles for a given person.
      await prisma.userPersonRating.upsert({
        where: { userId_personId: { userId, personId: key } },
        update: { score: { increment: delta } },
        create: { userId, personId: key, score: delta },
      });
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
