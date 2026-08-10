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

  const existing = await prisma.title.count();
  if (existing > 0 && !opts.force) {
    return { mode: hasTmdbKey() ? "tmdb" : "fallback", skipped: true, titles: existing, people: 0 };
  }

  if (hasTmdbKey()) {
    return seedFromTmdb();
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

const MOVIE_PAGES = 5; // 20/page -> 100 movies
const TV_PAGES = 3; // 20/page -> ~60 series
const DETAILS_LIMIT = 90; // titles to enrich with cast/crew (rate-limit friendly)

async function seedFromTmdb(): Promise<SeedResult> {
  const [movieGenres, tvGenres] = await Promise.all([tmdb.movieGenres(), tmdb.tvGenres()]);
  const allGenres = [...movieGenres.genres, ...tvGenres.genres];
  for (const g of allGenres) {
    await prisma.genre.upsert({ where: { id: g.id }, update: { name: g.name }, create: g });
  }

  const movies: TmdbListItem[] = [];
  for (let page = 1; page <= MOVIE_PAGES; page++) {
    const res = await tmdb.topRatedMovies(page);
    movies.push(...res.results);
    await sleep(150);
  }

  const series: TmdbListItem[] = [];
  for (let page = 1; page <= TV_PAGES; page++) {
    const res = await tmdb.topRatedTv(page);
    series.push(...res.results);
    await sleep(150);
  }

  const combined = [
    ...movies.map((m) => ({ item: m, type: "MOVIE" as const })),
    ...series.map((s) => ({ item: s, type: "SERIES" as const })),
  ].sort((a, b) => b.item.vote_count - a.item.vote_count);

  const peopleSeen = new Set<number>();
  let rank = 0;
  for (const { item, type } of combined) {
    rank += 1;
    const title = await prisma.title.upsert({
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
        onboardingRank: rank,
      },
    });

    if (rank <= DETAILS_LIMIT) {
      await enrichTitle(title.id, item.id, type, peopleSeen);
      await sleep(150);
    }
  }

  return { mode: "tmdb", skipped: false, titles: combined.length, people: peopleSeen.size };
}

async function enrichTitle(
  titleId: string,
  tmdbId: number,
  type: "MOVIE" | "SERIES",
  peopleSeen: Set<number>,
) {
  const details = type === "MOVIE" ? await tmdb.movieDetails(tmdbId) : await tmdb.tvDetails(tmdbId);

  for (const g of details.genres) {
    await prisma.titleGenre.upsert({
      where: { titleId_genreId: { titleId, genreId: g.id } },
      update: {},
      create: { titleId, genreId: g.id },
    });
  }

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
