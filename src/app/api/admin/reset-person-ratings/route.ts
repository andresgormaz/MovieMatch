import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time wipe of every UserPersonRating row -- both automatic (previously
// bumped from a single onboarding favorite or "vs" win, a behavior removed
// alongside this endpoint) and any manual ones, since there's no way to tell
// them apart in the old data. Going forward, a positive actor/director
// preference is derived from accumulated "vs" wins and 4-5-star ratings
// instead (see preferenceCounts.ts); manual overrides start clean from here.
//
// Visit this once, right after deploying that change -- protected by
// SEED_SECRET plus a separate confirm param, same pattern as
// /api/admin/rescale-ratings. Safe to run more than once by accident: a
// second visit just deletes zero rows.
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
          "Esto borra TODAS las calificaciones de actores/directores guardadas (automáticas y manuales) para todos los usuarios. Agrega &confirm=BORRAR a la URL para confirmar.",
      },
      { status: 400 },
    );
  }

  try {
    const { count } = await prisma.userPersonRating.deleteMany({});
    return NextResponse.json({
      ok: true,
      deleted: count,
      message: `Listo: se borraron ${count} calificaciones de actores/directores. Ahora se vuelven a inferir solo desde calificaciones de 4-5★ acumuladas.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
}
