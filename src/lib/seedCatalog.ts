import { prisma } from "./prisma";
import { hasTmdbKey, sleep, tmdb, type TmdbListItem } from "./tmdb";
import { SCHEMA_STATEMENTS } from "./schema-sql";
import {
  FALLBACK_GENRES,
  FALLBACK_TITLES,
  fallbackGenreIds,
} from "../../prisma/seed-data/fallback";

export interface SeedResult {
  mode: "tmdb" | "fallback";
  skipped: boolean;
  titles: number;
  people: number;
  moviesTotal?: number;
  seriesTotal?: number;
  done?: boolean; // tmdb mode only: true once /discover has no more pages left
}

// Creates the schema if it doesn't exist yet. Lets a brand new Turso
// database go from empty to ready without running `prisma migrate deploy`
// from a computer -- every statement is idempotent (IF NOT EXISTS).
export async function ensureSchema() {
  for (const statement of SCHEMA_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement);
  }
}

export async function seedCatalog(opts: { force?: boolean } = {}): Promise<SeedResult> {
  await ensureSchema();

  if (hasTmdbKey()) {
    // Incremental/resumable: every call fetches the next batch of pages and
    // enriches a bounded number of titles, so revisiting the seed endpoint
    // keeps growing the catalog without ever timing out a single request.
    return seedFromTmdb();
  }

  const existing = await prisma.title.count();
  if (existing > 0 && !opts.force) {
    return { mode: "fallback", skipped: true, titles: existing, people: 0 };
  }
  return seedFallback();
}

async function seedFallback(): Promise<SeedResult> {
  for (const genre of FALLBACK_GENRES) {
    await prisma.genre.upsert({
      where: { id: genre.id },
      update: { name: genre.name },
      create: genre,
    });
  }

  const personCache = new Map<string, string>(); // name -> Person.id

  async function upsertPerson(name: string, department: "Actuación" | "Dirección") {
    const cached = personCache.get(name);
    if (cached) return cached;

    // Negative synthetic tmdbId so it never collides with a real TMDB id.
    const syntheticId = -(hashString(name) % 1_000_000_000 || 1);
    const person = await prisma.person.upsert({
      where: { tmdbId: syntheticId },
      update: { name },
      create: { tmdbId: syntheticId, name, knownForDepartment: department },
    });
    personCache.set(name, person.id);
    return person.id;
  }

  let rank = 1;
  for (const t of FALLBACK_TITLES) {
    const syntheticId = -(hashString(`${t.type}:${t.name}:${t.year}`) % 1_000_000_000 || 1);
    const title = await prisma.title.upsert({
      where: { tmdbId: syntheticId },
      update: {
        name: t.name,
        type: t.type,
        releaseYear: t.year,
        originCountry: t.country,
        onboardingRank: rank,
      },
      create: {
        tmdbId: syntheticId,
        name: t.name,
        type: t.type,
        releaseYear: t.year,
        originCountry: t.country,
        onboardingRank: rank,
        popularity: FALLBACK_TITLES.length - rank,
        voteAverage: 7.5,
      },
    });
    rank += 1;

    for (const genreId of fallbackGenreIds(t.genres)) {
      await prisma.titleGenre.upsert({
        where: { titleId_genreId: { titleId: title.id, genreId } },
        update: {},
        create: { titleId: title.id, genreId },
      });
    }

    const directorId = await upsertPerson(t.director, "Dirección");
    await prisma.titleCrew.upsert({
      where: { titleId_personId_job: { titleId: title.id, personId: directorId, job: "Director" } },
      update: {},
      create: { titleId: title.id, personId: directorId, job: "Director" },
    });

    let order = 0;
    for (const actorName of t.cast) {
      if (actorName === "Various") continue;
      const personId = await upsertPerson(actorName, "Actuación");
      await prisma.titleCast.upsert({
        where: { titleId_personId: { titleId: title.id, personId } },
        update: { order },
        create: { titleId: title.id, personId, order },
      });
      order += 1;
    }
  }

  return { mode: "fallback", skipped: false, titles: FALLBACK_TITLES.length, people: personCache.size };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const FROM_DATE = "2000-01-01"; // "principales películas/series del 2000 a la fecha"
const PAGE_SIZE = 20; // fixed by the TMDB API
const MOVIE_PAGES_PER_CALL = 8; // ~160 movies per call
const TV_PAGES_PER_CALL = 5; // ~100 series per call
const ENRICH_PER_CALL = 70; // cast/crew/country lookups per call (rate + time budget)

// Resumable: figures out where the last call left off from what's already
// in the DB (no separate cursor table needed), fetches the next batch of
// /discover pages, and enriches a bounded number of titles that are still
// missing cast/crew. Safe to call repeatedly -- every write is an upsert.
async function seedFromTmdb(): Promise<SeedResult> {
  // Real TMDB data supersedes the local fallback dataset (negative synthetic
  // ids) -- drop it once so the catalog doesn't show duplicates.
  await prisma.title.deleteMany({ where: { tmdbId: { lt: 0 } } });
  await prisma.person.deleteMany({ where: { tmdbId: { lt: 0 } } });

  const [movieGenres, tvGenres] = await Promise.all([tmdb.movieGenres(), tmdb.tvGenres()]);
  const genreNameById = new Map<number, string>();
  for (const g of [...movieGenres.genres, ...tvGenres.genres]) {
    genreNameById.set(g.id, g.name);
    await prisma.genre.upsert({ where: { id: g.id }, update: { name: g.name }, create: g });
  }

  const [movieCount, seriesCount, maxRankRow] = await Promise.all([
    prisma.title.count({ where: { type: "MOVIE", tmdbId: { gt: 0 } } }),
    prisma.title.count({ where: { type: "SERIES", tmdbId: { gt: 0 } } }),
    prisma.title.aggregate({ _max: { onboardingRank: true } }),
  ]);

  const startMoviePage = Math.floor(movieCount / PAGE_SIZE) + 1;
  const startTvPage = Math.floor(seriesCount / PAGE_SIZE) + 1;
  let nextRank = (maxRankRow._max.onboardingRank ?? 0) + 1;

  const movies: TmdbListItem[] = [];
  let moviesExhausted = false;
  for (let i = 0; i < MOVIE_PAGES_PER_CALL; i++) {
    const page = startMoviePage + i;
    const res = await tmdb.discoverMovies(page, FROM_DATE);
    movies.push(...res.results);
    await sleep(100);
    if (page >= res.total_pages) {
      moviesExhausted = true;
      break;
    }
  }

  const series: TmdbListItem[] = [];
  let seriesExhausted = false;
  for (let i = 0; i < TV_PAGES_PER_CALL; i++) {
    const page = startTvPage + i;
    const res = await tmdb.discoverTv(page, FROM_DATE);
    series.push(...res.results);
    await sleep(100);
    if (page >= res.total_pages) {
      seriesExhausted = true;
      break;
    }
  }

  // Both lists are already popularity-sorted (via /discover); merging keeps
  // that order so onboardingRank stays a meaningful "most likely seen" sort
  // across movies and series combined, round after round.
  const combined = [
    ...movies.map((m) => ({ item: m, type: "MOVIE" as const })),
    ...series.map((s) => ({ item: s, type: "SERIES" as const })),
  ].sort((a, b) => b.item.popularity - a.item.popularity);

  for (const { item, type } of combined) {
    const rank = nextRank++;
    const titleRow = await prisma.title.upsert({
      where: { tmdbId: item.id },
      update: {
        onboardingRank: rank,
        popularity: item.popularity,
        voteAverage: item.vote_average,
      },
      create: {
        tmdbId: item.id,
        type,
        name: type === "MOVIE" ? item.title! : item.name!,
        originalName: type === "MOVIE" ? item.original_title : item.original_name,
        overview: item.overview,
        releaseYear: Number((type === "MOVIE" ? item.release_date : item.first_air_date)?.slice(0, 4)) || null,
        posterPath: item.poster_path,
        backdropPath: item.backdrop_path,
        popularity: item.popularity,
        voteAverage: item.vote_average,
        originCountry: type === "SERIES" ? item.origin_country?.[0] : undefined,
        onboardingRank: rank,
      },
      select: { id: true },
    });

    for (const genreId of item.genre_ids ?? []) {
      if (!genreNameById.has(genreId)) continue;
      await prisma.titleGenre.upsert({
        where: { titleId_genreId: { titleId: titleRow.id, genreId } },
        update: {},
        create: { titleId: titleRow.id, genreId },
      });
    }
  }

  // Enrich the most popular titles that don't have cast/crew yet -- catches
  // up on previous rounds too, not just this round's new titles.
  const toEnrich = await prisma.title.findMany({
    where: { tmdbId: { gt: 0 }, cast: { none: {} } },
    orderBy: { popularity: "desc" },
    take: ENRICH_PER_CALL,
    select: { id: true, tmdbId: true, type: true },
  });

  const peopleSeen = new Set<number>();
  for (const t of toEnrich) {
    await enrichTitle(t.id, t.tmdbId, t.type, peopleSeen);
    await sleep(100);
  }

  const [moviesTotal, seriesTotal] = await Promise.all([
    prisma.title.count({ where: { type: "MOVIE", tmdbId: { gt: 0 } } }),
    prisma.title.count({ where: { type: "SERIES", tmdbId: { gt: 0 } } }),
  ]);

  return {
    mode: "tmdb",
    skipped: false,
    titles: combined.length,
    people: peopleSeen.size,
    moviesTotal,
    seriesTotal,
    done: moviesExhausted && seriesExhausted,
  };
}

async function enrichTitle(
  titleId: string,
  tmdbId: number,
  type: "MOVIE" | "SERIES",
  peopleSeen: Set<number>,
) {
  const details = type === "MOVIE" ? await tmdb.movieDetails(tmdbId) : await tmdb.tvDetails(tmdbId);

  const country =
    type === "MOVIE"
      ? (details as { production_countries: { iso_3166_1: string }[] }).production_countries[0]?.iso_3166_1
      : (details as { origin_country: string[] }).origin_country[0];
  if (country) {
    await prisma.title.update({ where: { id: titleId }, data: { originCountry: country } });
  }

  const cast = details.credits.cast.slice(0, 8);
  for (const c of cast) {
    const person = await prisma.person.upsert({
      where: { tmdbId: c.id },
      update: { name: c.name, profilePath: c.profile_path },
      create: { tmdbId: c.id, name: c.name, profilePath: c.profile_path, knownForDepartment: "Acting" },
    });
    peopleSeen.add(c.id);
    await prisma.titleCast.upsert({
      where: { titleId_personId: { titleId, personId: person.id } },
      update: { character: c.character, order: c.order ?? 0 },
      create: { titleId, personId: person.id, character: c.character, order: c.order ?? 0 },
    });
  }

  const directors =
    type === "MOVIE"
      ? details.credits.crew.filter((c) => c.job === "Director")
      : (details as { created_by: { id: number; name: string; profile_path: string | null }[] }).created_by;

  for (const d of directors) {
    const person = await prisma.person.upsert({
      where: { tmdbId: d.id },
      update: { name: d.name, profilePath: "profile_path" in d ? d.profile_path : undefined },
      create: {
        tmdbId: d.id,
        name: d.name,
        profilePath: "profile_path" in d ? d.profile_path : null,
        knownForDepartment: "Directing",
      },
    });
    peopleSeen.add(d.id);
    const job = type === "MOVIE" ? "Director" : "Creator";
    await prisma.titleCrew.upsert({
      where: { titleId_personId_job: { titleId, personId: person.id, job } },
      update: {},
      create: { titleId, personId: person.id, job },
    });
  }
}
