import { prisma } from "./prisma";
import { hasTmdbKey, sleep, tmdb, type TmdbListItem } from "./tmdb";
import { jikan, translateAnimeGenre, ANIME_ID_OFFSET, ANIME_PAGE_SIZE, type JikanAnime } from "./jikan";
import { TABLE_STATEMENTS, ALTER_STATEMENTS, DROP_INDEX_STATEMENTS, INDEX_STATEMENTS } from "./schema-sql";
import { STREAMING_REGIONS } from "./countries";
import {
  FALLBACK_GENRES,
  FALLBACK_TITLES,
  fallbackGenreIds,
} from "../../prisma/seed-data/fallback";

export interface SeedResult {
  mode: "tmdb" | "fallback" | "anime";
  skipped: boolean;
  titles: number;
  people: number;
  moviesTotal?: number;
  seriesTotal?: number;
  animeTotal?: number;
  done?: boolean; // tmdb/anime mode only: true once there are no more pages left
}

// Creates the schema if it doesn't exist yet, and applies any column
// additions from later on (e.g. adding `budget`/`voteCount` to an already
// -seeded Turso database). Lets the catalog evolve without ever needing to
// run `prisma migrate deploy` from a computer. Every CREATE is idempotent
// (IF NOT EXISTS); ALTER TABLE ADD COLUMN has no such guard in SQLite, so
// "duplicate column" failures are swallowed (already applied) and anything
// else is rethrown.
export async function ensureSchema() {
  for (const statement of TABLE_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement);
  }
  for (const statement of ALTER_STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(statement);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/duplicate column name/i.test(message)) throw err;
    }
  }
  for (const statement of DROP_INDEX_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement);
  }
  // Indexes last -- a column an ALTER just added must exist before an index
  // on it can be created.
  for (const statement of INDEX_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement);
  }
}

export async function seedCatalog(
  opts: { force?: boolean; source?: "auto" | "anime" } = {},
): Promise<SeedResult> {
  await ensureSchema();

  if (opts.source === "anime") {
    return seedAnimeFromJikan();
  }

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
      where: { tmdbId_type: { tmdbId: syntheticId, type: t.type } },
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

  // gt:0/lt:ANIME_ID_OFFSET scopes these to real TMDB rows -- anime rows
  // (tmdbId = ANIME_ID_OFFSET + mal_id) are also positive and would
  // otherwise throw the page-counting math off and get "enriched" against
  // TMDB with a bogus id.
  const [movieCount, seriesCount, maxRankRow] = await Promise.all([
    prisma.title.count({ where: { type: "MOVIE", tmdbId: { gt: 0, lt: ANIME_ID_OFFSET } } }),
    prisma.title.count({ where: { type: "SERIES", tmdbId: { gt: 0, lt: ANIME_ID_OFFSET } } }),
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
    // TMDB movie ids and TV ids are separate number spaces, so a movie and a
    // series can legitimately share a numeric id -- key everything by
    // "id:type" instead of just id, both against what's already in the DB
    // and within this batch (pagination can occasionally repeat an entry at
    // a page boundary), or a same-type duplicate slips into createMany and
    // trips the unique constraint.
    const compositeKey = (id: number, type: "MOVIE" | "SERIES") => `${id}:${type}`;

    const alreadyPersisted = new Set(
      (
        await prisma.title.findMany({
          where: { tmdbId: { in: combined.map((c) => c.item.id) } },
          select: { tmdbId: true, type: true },
        })
      ).map((t) => compositeKey(t.tmdbId, t.type)),
    );
    const newCombinedByKey = new Map<string, (typeof combined)[number]>();
    for (const c of combined) {
      const key = compositeKey(c.item.id, c.type);
      if (!alreadyPersisted.has(key)) newCombinedByKey.set(key, c);
    }
    const newCombined = [...newCombinedByKey.values()];

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
        voteCount: item.vote_count,
        originCountry: type === "SERIES" ? (item.origin_country?.[0] ?? null) : null,
        onboardingRank: nextRank++,
      }));
      await prisma.title.createMany({ data: titleRows });

      const persisted = await prisma.title.findMany({
        where: { tmdbId: { in: newCombined.map((c) => c.item.id) } },
        select: { id: true, tmdbId: true, type: true },
      });
      const titleIdByKey = new Map(persisted.map((p) => [compositeKey(p.tmdbId, p.type), p.id]));

      const genrePairs: { titleId: string; genreId: number }[] = [];
      for (const { item, type } of newCombined) {
        const titleId = titleIdByKey.get(compositeKey(item.id, type));
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
  // up on previous rounds too, not just this round's new titles. Also
  // catches titles enriched before streaming-providers support existed
  // (cast present, providers missing), so that data backfills over
  // subsequent calls instead of staying permanently empty.
  const toEnrich = await prisma.title.findMany({
    where: {
      tmdbId: { gt: 0, lt: ANIME_ID_OFFSET },
      OR: [{ cast: { none: {} } }, { providers: { none: {} } }],
    },
    orderBy: { popularity: "desc" },
    take: ENRICH_PER_CALL,
    select: { id: true, tmdbId: true, type: true },
  });

  const peopleCount = await enrichTitles(toEnrich);

  const [moviesTotal, seriesTotal] = await Promise.all([
    prisma.title.count({ where: { type: "MOVIE", tmdbId: { gt: 0, lt: ANIME_ID_OFFSET } } }),
    prisma.title.count({ where: { type: "SERIES", tmdbId: { gt: 0, lt: ANIME_ID_OFFSET } } }),
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

interface FetchedProvider {
  id: number;
  name: string;
  logoPath: string | null;
}

// Fetches details/credits for each title (unavoidably one TMDB call per
// title), then writes everything in a handful of batched round trips
// instead of ~10 per title.
async function enrichTitles(
  titles: { id: string; tmdbId: number; type: "MOVIE" | "SERIES" }[],
): Promise<number> {
  const countryByTitleId = new Map<string, string>();
  const budgetByTitleId = new Map<string, number>();
  const castByTitleId = new Map<string, FetchedCredit[]>();
  const crewByTitleId = new Map<string, { credit: FetchedCredit; job: "Director" | "Creator" }[]>();
  const allPeople = new Map<number, FetchedCredit>();
  const providersByTitleId = new Map<string, { providerId: number; countryCode: string }[]>();
  const allProviders = new Map<number, FetchedProvider>();
  const similarByTitleId = new Map<string, { relatedTmdbId: number; relatedType: "MOVIE" | "SERIES"; rank: number }[]>();
  const SIMILAR_PER_TITLE = 10; // TMDB returns up to 20; a shorter list keeps the strongest signal

  for (const t of titles) {
    const details = t.type === "MOVIE" ? await tmdb.movieDetails(t.tmdbId) : await tmdb.tvDetails(t.tmdbId);
    await sleep(80);

    const country =
      t.type === "MOVIE"
        ? (details as { production_countries: { iso_3166_1: string }[] }).production_countries[0]?.iso_3166_1
        : (details as { origin_country: string[] }).origin_country[0];
    if (country) countryByTitleId.set(t.id, country);

    if (t.type === "MOVIE") {
      const budget = (details as { budget: number }).budget;
      if (budget > 0) budgetByTitleId.set(t.id, budget);
    }

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

    // Only "flatrate" (subscription-included) availability is tracked, and
    // only for the countries we actually serve -- TMDB returns every region
    // in one response, most of which we'd never use.
    const watchResults = details["watch/providers"]?.results ?? {};
    const providerEntries: { providerId: number; countryCode: string }[] = [];
    for (const region of STREAMING_REGIONS) {
      for (const p of watchResults[region]?.flatrate ?? []) {
        allProviders.set(p.provider_id, { id: p.provider_id, name: p.provider_name, logoPath: p.logo_path });
        providerEntries.push({ providerId: p.provider_id, countryCode: region });
      }
    }
    providersByTitleId.set(t.id, providerEntries);

    // Same media type as the source: a movie's recommendations are always
    // movies, a series' are always series.
    const recommended = details.recommendations?.results ?? [];
    similarByTitleId.set(
      t.id,
      recommended.slice(0, SIMILAR_PER_TITLE).map((r, rank) => ({ relatedTmdbId: r.id, relatedType: t.type, rank })),
    );
  }

  // Titles with no credited cast/crew at all are rare but not impossible
  // (obscure entries) -- skip the person round trips but still fall through
  // to write providers/similar titles below instead of returning early.
  let personIdByTmdbId = new Map<number, string>();
  if (allPeople.size > 0) {
    // Same story as titles: pre-filter to people we don't have yet
    // (prolific actors/directors show up across many titles) instead of
    // relying on skipDuplicates, which SQLite doesn't support.
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
    personIdByTmdbId = new Map(persistedPeople.map((p) => [p.tmdbId, p.id]));
  }

  // `toEnrich` selects titles with zero cast rows, which *should* mean
  // they've never been enriched -- but a run that got killed mid-batch
  // (e.g. a timeout) can leave crew rows written without cast, or vice
  // versa, for a title from an earlier attempt. Re-check what's actually
  // there for this exact batch instead of assuming, so a retry after a
  // partial failure never trips a unique-constraint error.
  const titleIdsInBatch = titles.map((t) => t.id);
  const [existingCast, existingCrew] = await Promise.all([
    prisma.titleCast.findMany({ where: { titleId: { in: titleIdsInBatch } }, select: { titleId: true, personId: true } }),
    prisma.titleCrew.findMany({
      where: { titleId: { in: titleIdsInBatch } },
      select: { titleId: true, personId: true, job: true },
    }),
  ]);
  const existingCastKeys = new Set(existingCast.map((r) => `${r.titleId}:${r.personId}`));
  const existingCrewKeys = new Set(existingCrew.map((r) => `${r.titleId}:${r.personId}:${r.job}`));

  const castRows: { titleId: string; personId: string; order: number }[] = [];
  for (const [titleId, cast] of castByTitleId) {
    cast.forEach((c, order) => {
      const personId = personIdByTmdbId.get(c.tmdbId);
      if (personId && !existingCastKeys.has(`${titleId}:${personId}`)) castRows.push({ titleId, personId, order });
    });
  }
  if (castRows.length > 0) {
    await prisma.titleCast.createMany({ data: castRows });
  }

  const crewRowsByKey = new Map<string, { titleId: string; personId: string; job: string }>();
  for (const [titleId, crew] of crewByTitleId) {
    for (const c of crew) {
      const personId = personIdByTmdbId.get(c.credit.tmdbId);
      const key = `${titleId}:${personId}:${c.job}`;
      if (personId && !existingCrewKeys.has(key)) crewRowsByKey.set(key, { titleId, personId, job: c.job });
    }
  }
  if (crewRowsByKey.size > 0) {
    await prisma.titleCrew.createMany({ data: [...crewRowsByKey.values()] });
  }

  if (allProviders.size > 0) {
    const existingProviderIds = new Set(
      (
        await prisma.provider.findMany({
          where: { id: { in: [...allProviders.keys()] } },
          select: { id: true },
        })
      ).map((p) => p.id),
    );
    const newProviders = [...allProviders.values()].filter((p) => !existingProviderIds.has(p.id));
    if (newProviders.length > 0) {
      await prisma.provider.createMany({
        data: newProviders.map((p) => ({ id: p.id, name: p.name, logoPath: p.logoPath })),
      });
    }

    const existingTitleProviders = await prisma.titleProvider.findMany({
      where: { titleId: { in: titleIdsInBatch } },
      select: { titleId: true, providerId: true, countryCode: true },
    });
    const existingTitleProviderKeys = new Set(
      existingTitleProviders.map((r) => `${r.titleId}:${r.providerId}:${r.countryCode}`),
    );

    const titleProviderRows: { titleId: string; providerId: number; countryCode: string }[] = [];
    for (const [titleId, entries] of providersByTitleId) {
      for (const e of entries) {
        const key = `${titleId}:${e.providerId}:${e.countryCode}`;
        if (!existingTitleProviderKeys.has(key)) {
          titleProviderRows.push({ titleId, providerId: e.providerId, countryCode: e.countryCode });
          existingTitleProviderKeys.add(key);
        }
      }
    }
    if (titleProviderRows.length > 0) {
      await prisma.titleProvider.createMany({ data: titleProviderRows });
    }
  }

  const existingSimilar = await prisma.titleSimilar.findMany({
    where: { titleId: { in: titleIdsInBatch } },
    select: { titleId: true, relatedTmdbId: true, relatedType: true },
  });
  const existingSimilarKeys = new Set(
    existingSimilar.map((r) => `${r.titleId}:${r.relatedTmdbId}:${r.relatedType}`),
  );
  const similarRows: { titleId: string; relatedTmdbId: number; relatedType: "MOVIE" | "SERIES"; rank: number }[] = [];
  for (const [titleId, related] of similarByTitleId) {
    for (const r of related) {
      const key = `${titleId}:${r.relatedTmdbId}:${r.relatedType}`;
      if (!existingSimilarKeys.has(key)) {
        similarRows.push({ titleId, ...r });
        existingSimilarKeys.add(key);
      }
    }
  }
  if (similarRows.length > 0) {
    await prisma.titleSimilar.createMany({ data: similarRows });
  }

  const titleIdsNeedingUpdate = new Set([...countryByTitleId.keys(), ...budgetByTitleId.keys()]);
  for (const titleId of titleIdsNeedingUpdate) {
    await prisma.title.update({
      where: { id: titleId },
      data: {
        originCountry: countryByTitleId.get(titleId),
        budget: budgetByTitleId.get(titleId),
      },
    });
  }

  return allPeople.size;
}

const ANIME_PAGES_PER_CALL = 6; // ~150 anime per call -- no per-title enrichment call needed

// Anime import from Jikan. Unlike TMDB, genres/score/studio all come back in
// the same list response, so there's no separate enrichment phase -- one
// batch of list pages plus a few batched writes per call, comfortably under
// the time budget. Resumes the same way as seedFromTmdb: next page is
// derived from how many anime rows already exist.
async function seedAnimeFromJikan(): Promise<SeedResult> {
  const animeCount = await prisma.title.count({ where: { tmdbId: { gte: ANIME_ID_OFFSET } } });
  const startPage = Math.floor(animeCount / ANIME_PAGE_SIZE) + 1;

  const maxRankRow = await prisma.title.aggregate({ _max: { onboardingRank: true } });
  let nextRank = (maxRankRow._max.onboardingRank ?? 0) + 1;

  const items: JikanAnime[] = [];
  let exhausted = false;
  for (let i = 0; i < ANIME_PAGES_PER_CALL; i++) {
    const page = startPage + i;
    const res = await jikan.listAnime(page);
    items.push(...res.data);
    await sleep(400); // Jikan's public rate limit is ~3 req/s
    if (!res.pagination.has_next_page) {
      exhausted = true;
      break;
    }
  }

  if (items.length === 0) {
    const animeTotal = await prisma.title.count({ where: { tmdbId: { gte: ANIME_ID_OFFSET } } });
    return { mode: "anime", skipped: false, titles: 0, people: 0, animeTotal, done: true };
  }

  const alreadyPersisted = new Set(
    (
      await prisma.title.findMany({
        where: { tmdbId: { in: items.map((it) => ANIME_ID_OFFSET + it.mal_id) } },
        select: { tmdbId: true },
      })
    ).map((t) => t.tmdbId),
  );
  const newItems = items.filter((it) => !alreadyPersisted.has(ANIME_ID_OFFSET + it.mal_id));

  let studioCount = 0;
  if (newItems.length > 0) {
    // "Anime" tags every import so it's a one-click filter regardless of
    // sub-genre; the rest map onto existing genres where there's an
    // equivalent (translateAnimeGenre), or get created the first time seen.
    const genreNames = new Set<string>(["Anime"]);
    for (const it of newItems) for (const g of it.genres) genreNames.add(translateAnimeGenre(g.name));

    const genreIdByName = new Map<string, number>();
    for (const g of await prisma.genre.findMany({ where: { name: { in: [...genreNames] } } })) {
      genreIdByName.set(g.name, g.id);
    }
    const missingGenreNames = [...genreNames].filter((n) => !genreIdByName.has(n));
    if (missingGenreNames.length > 0) {
      // Genre.id has no DB-generated default in the Prisma schema, so new
      // rows need an explicit id -- allocate sequentially above 50000,
      // clear of every real TMDB genre id, instead of relying on a hash
      // (which could theoretically collide).
      const maxCustom = await prisma.genre.aggregate({ where: { id: { gte: 50_000 } }, _max: { id: true } });
      let nextGenreId = Math.max(50_000, (maxCustom._max.id ?? 49_999) + 1);
      for (const name of missingGenreNames) {
        await prisma.genre.create({ data: { id: nextGenreId, name } });
        genreIdByName.set(name, nextGenreId);
        nextGenreId++;
      }
    }

    const titleRows = newItems.map((it) => ({
      tmdbId: ANIME_ID_OFFSET + it.mal_id,
      type: it.type === "Movie" ? ("MOVIE" as const) : ("SERIES" as const),
      name: it.title_english || it.title,
      originalName: it.title,
      overview: it.synopsis,
      releaseYear: it.year,
      posterPath: it.images.jpg.large_image_url,
      backdropPath: null,
      popularity: it.scored_by ?? 0,
      voteAverage: it.score,
      voteCount: it.scored_by,
      originCountry: "JP",
      onboardingRank: nextRank++,
    }));
    await prisma.title.createMany({ data: titleRows });

    const persistedTitles = await prisma.title.findMany({
      where: { tmdbId: { in: newItems.map((it) => ANIME_ID_OFFSET + it.mal_id) } },
      select: { id: true, tmdbId: true },
    });
    const titleIdByTmdbId = new Map(persistedTitles.map((t) => [t.tmdbId, t.id]));

    const genrePairs: { titleId: string; genreId: number }[] = [];
    const allStudios = new Map<number, { mal_id: number; name: string }>();
    for (const it of newItems) {
      const titleId = titleIdByTmdbId.get(ANIME_ID_OFFSET + it.mal_id);
      if (!titleId) continue;
      genrePairs.push({ titleId, genreId: genreIdByName.get("Anime")! });
      for (const g of it.genres) {
        const genreId = genreIdByName.get(translateAnimeGenre(g.name));
        if (genreId) genrePairs.push({ titleId, genreId });
      }
      for (const s of it.studios) allStudios.set(s.mal_id, s);
    }
    if (genrePairs.length > 0) await prisma.titleGenre.createMany({ data: genrePairs });

    if (allStudios.size > 0) {
      const studioTmdbIds = [...allStudios.keys()].map((malId) => ANIME_ID_OFFSET + malId);
      const existingStudioIds = new Set(
        (
          await prisma.person.findMany({ where: { tmdbId: { in: studioTmdbIds } }, select: { tmdbId: true } })
        ).map((p) => p.tmdbId),
      );
      const newStudioRows = [...allStudios.values()]
        .filter((s) => !existingStudioIds.has(ANIME_ID_OFFSET + s.mal_id))
        .map((s) => ({ tmdbId: ANIME_ID_OFFSET + s.mal_id, name: s.name, knownForDepartment: "Estudio" }));
      if (newStudioRows.length > 0) await prisma.person.createMany({ data: newStudioRows });
      studioCount = allStudios.size;

      const studioPeople = await prisma.person.findMany({
        where: { tmdbId: { in: studioTmdbIds } },
        select: { id: true, tmdbId: true },
      });
      const studioPersonIdByTmdbId = new Map(studioPeople.map((p) => [p.tmdbId, p.id]));

      const crewRows: { titleId: string; personId: string; job: string }[] = [];
      for (const it of newItems) {
        const titleId = titleIdByTmdbId.get(ANIME_ID_OFFSET + it.mal_id);
        if (!titleId) continue;
        for (const s of it.studios) {
          const personId = studioPersonIdByTmdbId.get(ANIME_ID_OFFSET + s.mal_id);
          if (personId) crewRows.push({ titleId, personId, job: "Estudio" });
        }
      }
      if (crewRows.length > 0) await prisma.titleCrew.createMany({ data: crewRows });
    }
  }

  const animeTotal = await prisma.title.count({ where: { tmdbId: { gte: ANIME_ID_OFFSET } } });
  return { mode: "anime", skipped: false, titles: newItems.length, people: studioCount, animeTotal, done: exhausted };
}
