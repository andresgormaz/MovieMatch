import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Wipes every user account and everything tied to one -- ratings, wishlists,
// onboarding progress, groups -- while leaving the movie/series catalog
// (Title/Genre/Person/etc, already imported from TMDB) untouched. Meant for
// testing the onboarding flow from a clean slate without re-seeding the
// whole catalog. Irreversible; protected by SEED_SECRET *and* a separate
// `confirm=BORRAR` param so a stray visit to the URL can't wipe everyone by
// accident.
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
      { error: "Esto borra TODAS las cuentas de usuario. Agrega &confirm=BORRAR a la URL para confirmar." },
      { status: 400 },
    );
  }

  try {
    const userCountBefore = await prisma.user.count();

    // Deleted in dependency order (children before parents) so this works
    // regardless of whether the underlying SQLite/Turso connection actually
    // enforces the schema's ON DELETE CASCADE -- rather than assume it does.
    await prisma.$transaction([
      prisma.userTitleRating.deleteMany({}),
      prisma.userPersonRating.deleteMany({}),
      prisma.userGenrePreference.deleteMany({}),
      prisma.userCountryPreference.deleteMany({}),
      prisma.userTypePreference.deleteMany({}),
      prisma.userAudiencePreference.deleteMany({}),
      prisma.userBudgetPreference.deleteMany({}),
      prisma.userRuntimePreference.deleteMany({}),
      prisma.wishlist.deleteMany({}),
      prisma.onboardingChoice.deleteMany({}),
      prisma.groupMember.deleteMany({}),
      prisma.group.deleteMany({}),
      prisma.user.deleteMany({}),
    ]);

    return NextResponse.json({
      ok: true,
      usersDeleted: userCountBefore,
      message: `Listo: se borraron ${userCountBefore} cuentas y todo lo asociado (calificaciones, listas, grupos). El catálogo de películas y series no se tocó.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
}
