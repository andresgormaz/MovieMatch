import { NextResponse } from "next/server";
import { seedCatalog } from "@/lib/seedCatalog";

// One-time (or repeatable) catalog setup, reachable by visiting a URL from
// any browser -- including a phone -- so deploying doesn't require a
// computer terminal to run `prisma migrate deploy` / `npm run db:seed`.
// Protected by SEED_SECRET so it can't be triggered by strangers.
export async function GET(request: Request) {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SEED_SECRET no está configurada en el servidor. Agregala en las variables de entorno." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Secreto incorrecto." }, { status: 401 });
  }

  const force = searchParams.get("force") === "1";

  try {
    const result = await seedCatalog({ force });
    return NextResponse.json({
      ok: true,
      ...result,
      message: result.skipped
        ? `Ya había ${result.titles} títulos cargados, no se tocó nada. Agregá &force=1 a la URL para forzar una recarga.`
        : `Listo: se cargaron ${result.titles} títulos y ${result.people} personas (fuente: ${result.mode === "tmdb" ? "TMDB" : "dataset local"}).`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
}
