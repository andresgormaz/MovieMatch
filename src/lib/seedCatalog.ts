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
const MOVIE_PAGES_PER_CALL = 6; // ~120 movies per call
const TV_PAGES_PER_CALL = 4; // ~80 series per call
const ENRICH_PER_CALL = 40; // cast/crew/country lookups per call (rate + time budget)

// Resumable: figures out where the last call left off from what's already
// in the DB (no separate cursor table needed), fetches the next batch of
// /discover pages, and enriches a bounded number of titles that are still
// missing cast/crew. Safe to call repeatedly. Writes are batched (createMany
// + a follow-up lookup) instead of one row at a time -- each network round
// trip to Turso adds up fast, and a serverless function only gets ~60s.
async function seedFromTmdb(): Promise<SeedResult> {
  // Real TMDB data supersedes the local fallback dataset (negative synthetic
  // ids) -- drop it once so the catalog doesn't show duplicates.
  await prisma.title.deleteMany({ where: { tmdbId: { lt: 0 } } });
  await prisma.person.deleteMany({ where: { tmdbId: { lt: 0 } } });

  const [movieGenres, tvGenres] = await Promise.all([tmdb.movieGenres(), tmdb.tvGenres()]);
  const allGenres = [...movieGenres.genres, ...tvGenres.genres];
  const knownGenreIds = new Set(allGenres.map((g) => g.id));
  // SQLite's createMany doesn't support skipDuplicates, so pre-filter to
  // what's actually new instead -- after the first call this is empty and
  // costs one cheap query. Genre names never change, no need to update.
  const existingGenreIds = new Set(
    (await prisma.genre.findMany({ where: { id: { in: [...knownGenreIds] } }, select: { id: true } })).map(
      (g) => g.id,
    ),
  );
  const newGenres = allGenres.filter((g) => !existingGenreIds.has(g.id));
  if (newGenres.length > 0) {
    await prisma.genre.createMany({ data: newGenres });
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
    await sleep(80);
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
    await sleep(80);
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

  if (combined.length > 0) {
    // Titles we already have (rare -- only at page boundaries between
    // calls) keep their existing row/rank; only genuinely new ones get
    // inserted, and only new ones need their genre pairs written.
    const alreadyPersisted = new Set(
      (
        await prisma.title.findMany({
          where: { tmdbId: { in: combined.map((c) => c.item.id) } },
          select: { tmdbId: true },
        })
      ).map((t) => t.tmdbId),
    );
    const newCombined = combined.filter((c) => !alreadyPersisted.has(c.item.id));

    if (newCombined.length > 0) {
      const titleRows = newCombined.map(({ item, type }) => ({
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
        originCountry: type === "SERIES" ? (item.origin_country?.[0] ?? null) : null,
        onboardingRank: nextRank++,
      }));
      await prisma.title.createMany({ data: titleRows });

      const persisted = await prisma.title.findMany({
        where: { tmdbId: { in: newCombined.map((c) => c.item.id) } },
        select: { id: true, tmdbId: true },
      });
      const titleIdByTmdbId = new Map(persisted.map((p) => [p.tmdbId, p.id]));

      const genrePairs: { titleId: string; genreId: number }[] = [];
      for (const { item } of newCombined) {
        const titleId = titleIdByTmdbId.get(item.id);
        if (!titleId) continue;
        for (const genreId of item.genre_ids ?? []) {
          if (!knownGenreIds.has(genreId)) continue;
          genrePairs.push({ titleId, genreId });
        }
      }
      if (genrePairs.length > 0) {
        await prisma.titleGenre.createMany({ data: genrePairs });
      }
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

  const peopleCount = await enrichTitles(toEnrich);

  const [moviesTotal, seriesTotal] = await Promise.all([
    prisma.title.count({ where: { type: "MOVIE", tmdbId: { gt: 0 } } }),
    prisma.title.count({ where: { type: "SERIES", tmdbId: { gt: 0 } } }),
  ]);

  return {
    mode: "tmdb",
    skipped: false,
    titles: combined.length,
    people: peopleCount,
    moviesTotal,
    seriesTotal,
    done: moviesExhausted && seriesExhausted,
  };
}

interface FetchedCredit {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  department: "Actuación" | "Dirección";
}

// Fetches details/credits for each title (unavoidably one TMDB call per
// title), then writes everything in a handful of batched round trips
// instead of ~10 per title.
async function enrichTitles(
  titles: { id: string; tmdbId: number; type: "MOVIE" | "SERIES" }[],
): Promise<number> {
  const countryByTitleId = new Map<string, string>();
  const castByTitleId = new Map<string, FetchedCredit[]>();
  const crewByTitleId = new Map<string, { credit: FetchedCredit; job: "Director" | "Creator" }[]>();
  const allPeople = new Map<number, FetchedCredit>();

  for (const t of titles) {
    const details = t.type === "MOVIE" ? await tmdb.movieDetails(t.tmdbId) : await tmdb.tvDetails(t.tmdbId);
    await sleep(80);

    const country =
      t.type === "MOVIE"
        ? (details as { production_countries: { iso_3166_1: string }[] }).production_countries[0]?.iso_3166_1
        : (details as { origin_country: string[] }).origin_country[0];
    if (country) countryByTitleId.set(t.id, country);

    const cast = details.credits.cast.slice(0, 8).map(
      (c): FetchedCredit => ({ tmdbId: c.id, name: c.name, profilePath: c.profile_path, department: "Actuación" }),
    );
    castByTitleId.set(t.id, cast);
    for (const c of cast) allPeople.set(c.tmdbId, c);

    const directors =
      t.type === "MOVIE"
        ? details.credits.crew.filter((c) => c.job === "Director")
        : (details as { created_by: { id: number; name: string; profile_path: string | null }[] }).created_by;
    const crew = directors.map(
      (d): { credit: FetchedCredit; job: "Director" | "Creator" } => ({
        credit: { tmdbId: d.id, name: d.name, profilePath: d.profile_path, department: "Dirección" },
        job: t.type === "MOVIE" ? "Director" : "Creator",
      }),
    );
    crewByTitleId.set(t.id, crew);
    for (const c of crew) allPeople.set(c.credit.tmdbId, c.credit);
  }

  if (allPeople.size === 0) return 0;

  // Same story as titles: pre-filter to people we don't have yet (prolific
  // actors/directors show up across many titles) instead of relying on
  // skipDuplicates, which SQLite doesn't support.
  const existingPersonIds = new Set(
    (
      await prisma.person.findMany({
        where: { tmdbId: { in: [...allPeople.keys()] } },
        select: { tmdbId: true },
      })
    ).map((p) => p.tmdbId),
  );
  const newPeople = [...allPeople.values()].filter((p) => !existingPersonIds.has(p.tmdbId));
  if (newPeople.length > 0) {
    await prisma.person.createMany({
      data: newPeople.map((p) => ({
        tmdbId: p.tmdbId,
        name: p.name,
        profilePath: p.profilePath,
        knownForDepartment: p.department,
      })),
    });
  }

  const persistedPeople = await prisma.person.findMany({
    where: { tmdbId: { in: [...allPeople.keys()] } },
    select: { id: true, tmdbId: true },
  });
  const personIdByTmdbId = new Map(persistedPeople.map((p) => [p.tmdbId, p.id]));

  // `toEnrich` only contains titles with zero existing cast rows, and TMDB
  // credits don't repeat a person within one title's cast/crew list, so
  // these composite keys (titleId+personId[+job]) can't collide -- safe to
  // createMany without skipDuplicates (which SQLite doesn't support anyway).
  const castRows: { titleId: string; personId: string; order: number }[] = [];
  for (const [titleId, cast] of castByTitleId) {
    cast.forEach((c, order) => {
      const personId = personIdByTmdbId.get(c.tmdbId);
      if (personId) castRows.push({ titleId, personId, order });
    });
  }
  if (castRows.length > 0) {
    await prisma.titleCast.createMany({ data: castRows });
  }

  const crewRowsByKey = new Map<string, { titleId: string; personId: string; job: string }>();
  for (const [titleId, crew] of crewByTitleId) {
    for (const c of crew) {
      const personId = personIdByTmdbId.get(c.credit.tmdbId);
      if (personId) crewRowsByKey.set(`${titleId}:${personId}:${c.job}`, { titleId, personId, job: c.job });
    }
  }
  if (crewRowsByKey.size > 0) {
    await prisma.titleCrew.createMany({ data: [...crewRowsByKey.values()] });
  }

  for (const [titleId, country] of countryByTitleId) {
    await prisma.title.update({ where: { id: titleId }, data: { originCountry: country } });
  }

  return allPeople.size;
}
