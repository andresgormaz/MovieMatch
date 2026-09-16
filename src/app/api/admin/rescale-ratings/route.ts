import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time rescale from the old 1-10 score to the new 1-5 stars. Only ever
// touches rows with score > 5 -- those are unambiguously old-scale (nothing
// on the new scale can exceed 5), so this is safe to run more than once by
// accident: after the first pass nothing is left above 5, so a second visit
// is a no-op. The tradeoff is that an old score of exactly 1-5 is left
// untouched rather than halved (e.g. an old "5/10" stays "5" instead of
// becoming "3") -- a minor accuracy loss on old borderline-average ratings,
// never a data-corruption risk.
//
// Visit this once, right after deploying the 1-5 star UI -- protected by
// SEED_SECRET plus a separate confirm param.
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
  if (searchParams.get("confirm") !== "RESCALAR") {
    return NextResponse.json(
      { error: "Esto convierte los puntajes viejos (1-10) a la nueva escala (1-5). Agrega &confirm=RESCALAR a la URL para confirmar." },
      { status: 400 },
    );
  }

  try {
    const toRescale = await prisma.userTitleRating.findMany({
      where: { score: { gt: 5 } },
      select: { id: true, score: true },
    });

    for (const row of toRescale) {
      const newScore = Math.min(5, Math.ceil(row.score! / 2));
      await prisma.userTitleRating.update({ where: { id: row.id }, data: { score: newScore } });
    }

    return NextResponse.json({
      ok: true,
      rescaled: toRescale.length,
      message:
        toRescale.length > 0
          ? `Listo: se convirtieron ${toRescale.length} calificaciones viejas (1-10) a la nueva escala de 1-5 estrellas.`
          : "No había calificaciones en la escala vieja (1-10) para convertir -- ya está todo en 1-5.",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
}
