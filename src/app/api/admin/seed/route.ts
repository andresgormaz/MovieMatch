import { NextResponse } from "next/server";
import { seedCatalog } from "@/lib/seedCatalog";

// One-time (or repeatable) catalog setup, reachable by visiting a URL from
// any browser -- including a phone -- so deploying doesn't require a
// computer terminal to run `prisma migrate deploy` / `npm run db:seed`.
// Protected by SEED_SECRET so it can't be triggered by strangers.
//
// With a TMDB_API_KEY configured, each visit fetches the next batch of
// /discover pages (picking up where the last call left off) and enriches a
// bounded number of titles with cast/crew -- revisit the same URL as many
// times as you want to keep growing the catalog, each call stays well
// within Vercel's function time limit.
export const maxDuration = 60;

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

    let message: string;
    if (result.skipped) {
      message = `Ya había ${result.titles} títulos cargados, no se tocó nada. Agregá &force=1 a la URL para forzar una recarga.`;
    } else if (result.mode === "tmdb") {
      message = result.done
        ? `Listo, no quedan más páginas: ${result.moviesTotal} películas y ${result.seriesTotal} series en total.`
        : `Sumamos ${result.titles} títulos más (${result.moviesTotal} películas / ${result.seriesTotal} series en total). Volvé a visitar esta misma URL para seguir cargando más.`;
    } else {
      message = `Listo: se cargaron ${result.titles} títulos y ${result.people} personas (dataset local).`;
    }

    return NextResponse.json({ ok: true, ...result, message });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
}
