import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time wipe of UserTypePreference, UserGenrePreference,
// UserAudiencePreference, UserBudgetPreference, UserRuntimePreference, and
// UserCountryPreference -- same reason as /api/admin/reset-person-ratings.
// These tables used to store an ABSOLUTE value set by the old -2..2 manual
// selector (and, for type/audience/budget/runtime, an auto-incremented bump
// on top). The current scoring reads whatever's in these tables as an
// ADDITIVE manual adjustment layered on top of a freshly-derived
// winner-takes-all value -- so old leftover data (e.g. an old +2 "series"
// selection) silently stacks with the new derived +1, inflating the score
// (see chat 2026-08-20: "Tipo: series" showing +3 instead of the expected
// 0 or +1). UserPopularityPreference isn't included -- it was created fresh
// for the additive-manual model and never had old absolute/bumped data.
//
// Visit this once, right after deploying this fix -- protected by
// SEED_SECRET plus a separate confirm param, same pattern as
// /api/admin/reset-person-ratings. Safe to run more than once by accident:
// a second visit just deletes zero rows.
export async function GET(request: Request) {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SEED_SECRET no está configurada en el servidor. Agrégala en las variables de entorno." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Secreto incorrecto." }, { status: 401 });
  }
  if (searchParams.get("confirm") !== "BORRAR") {
    return NextResponse.json(
      {
        error:
          "Esto borra las preferencias manuales guardadas de tipo, género, masivo/indie, presupuesto, duración y país (para todos los usuarios) porque tienen valores viejos del selector manual antiguo que ya no deberían sumarse. Agrega &confirm=BORRAR a la URL para confirmar.",
      },
      { status: 400 },
    );
  }

  try {
    const [type, genre, audience, budget, runtime, country] = await Promise.all([
      prisma.userTypePreference.deleteMany({}),
      prisma.userGenrePreference.deleteMany({}),
      prisma.userAudiencePreference.deleteMany({}),
      prisma.userBudgetPreference.deleteMany({}),
      prisma.userRuntimePreference.deleteMany({}),
      prisma.userCountryPreference.deleteMany({}),
    ]);
    const deleted = type.count + genre.count + audience.count + budget.count + runtime.count + country.count;
    return NextResponse.json({
      ok: true,
      deleted: { type: type.count, genre: genre.count, audience: audience.count, budget: budget.count, runtime: runtime.count, country: country.count },
      message: `Listo: se borraron ${deleted} preferencias manuales viejas. Los puntajes de tipo, género, masivo/indie, presupuesto, duración y país ahora vuelven a calcularse solo desde tus "vs" y calificaciones, y los ajustes manuales (+1/-1 en "Mis gustos") empiezan de cero.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
}
