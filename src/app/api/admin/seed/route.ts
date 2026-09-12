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
// within Vercel's function time limit. Add &source=anime to import anime
// from Jikan/MyAnimeList instead (also resumable the same way). Add
// &source=votes to run the one-time voteCount backfill (also resumable).
// Add &source=attributes to run the one-time runtime/collection/budget
// backfill (also resumable). Add &source=seriesStatus to run the one-time
// seasons/status/last-air-date backfill for series (also resumable).
// Add &source=upcoming to (re)pull upcoming theatrical releases for the
// home "Próximos estrenos" section (small pool, one call is usually enough).
// Add &source=range&from=1980&to=1989 to import
// any other year range instead of the default 2000-present one (also
// resumable, independently of every other range already loaded) -- `to` is
// optional (open-ended, like the default range).
//
// 270s (not the old 60s) -- Vercel's Fluid Compute raised the Hobby-plan
// serverless timeout to 300s; this leaves a margin. If the Vercel project
// still has Fluid Compute off, this value is simply ignored and the
// platform falls back to its own default -- harmless (a call just times
// out and resumes next visit, same as before), but worth checking Project
// Settings -> Functions if imports don't seem to be moving faster.
export const maxDuration = 270;

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

  const force = searchParams.get("force") === "1";
  const sourceParam = searchParams.get("source");
  const source =
    sourceParam === "anime"
      ? "anime"
      : sourceParam === "votes"
        ? "votes"
        : sourceParam === "attributes"
          ? "attributes"
          : sourceParam === "seriesStatus"
            ? "seriesStatus"
            : sourceParam === "upcoming"
              ? "upcoming"
              : sourceParam === "range"
                ? "range"
                : "auto";
  const fromYear = Number(searchParams.get("from")) || undefined;
  const toYear = Number(searchParams.get("to")) || undefined;

  try {
    const result = await seedCatalog({ force, source, fromYear, toYear });

    let message: string;
    const rangeLabel = toYear ? `${fromYear}-${toYear}` : `${fromYear} en adelante`;
    if (result.skipped) {
      message = `Ya había ${result.titles} títulos cargados, no se tocó nada. Agrega &force=1 a la URL para forzar una recarga.`;
    } else if (result.mode === "tmdb" && source === "range") {
      message = result.done
        ? `Listo, no quedan más páginas de ${rangeLabel}: ${result.moviesTotal} películas y ${result.seriesTotal} series en total (catálogo completo, todas las épocas).`
        : `Sumamos ${result.titles} títulos más de ${rangeLabel} (${result.moviesTotal} películas / ${result.seriesTotal} series en total, catálogo completo). Vuelve a visitar esta misma URL (con &source=range&from=${fromYear}${toYear ? `&to=${toYear}` : ""}) para seguir cargando más.`;
    } else if (result.mode === "tmdb") {
      message = result.done
        ? `Listo, no quedan más páginas: ${result.moviesTotal} películas y ${result.seriesTotal} series en total.`
        : `Sumamos ${result.titles} títulos más (${result.moviesTotal} películas / ${result.seriesTotal} series en total). Vuelve a visitar esta misma URL para seguir cargando más.`;
    } else if (result.mode === "anime") {
      message = result.done
        ? `Listo, no quedan más páginas de anime: ${result.animeTotal} en total.`
        : `Sumamos ${result.titles} animes más (${result.animeTotal} en total). Vuelve a visitar esta misma URL (con &source=anime) para seguir cargando más.`;
    } else if (result.mode === "votes") {
      message = result.done
        ? `Listo, ya no queda ningún título sin cantidad de votos.`
        : `Completamos la cantidad de votos de ${result.titles} títulos más (quedan ${result.votesRemaining} pendientes). Vuelve a visitar esta misma URL (con &source=votes) para seguir completando.`;
    } else if (result.mode === "attributes") {
      message = result.done
        ? `Listo, ya no queda ningún título sin duración/colección.`
        : `Completamos duración/colección de ${result.titles} títulos más (quedan ${result.attributesRemaining} pendientes). Vuelve a visitar esta misma URL (con &source=attributes) para seguir completando.`;
    } else if (result.mode === "seriesStatus") {
      message = result.done
        ? `Listo, ya no queda ninguna serie sin temporadas/estado.`
        : `Completamos temporadas/estado de ${result.titles} series más (quedan ${result.seriesStatusRemaining} pendientes). Vuelve a visitar esta misma URL (con &source=seriesStatus) para seguir completando.`;
    } else if (result.mode === "upcoming") {
      message = `Listo: ${result.titles} próximos estrenos de cine actualizados.`;
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
