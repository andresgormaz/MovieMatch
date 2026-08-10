import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { FALLBACK_GENRES, FALLBACK_TITLES, fallbackGenreIds } from "./seed-data/fallback";
import { hasTmdbKey, sleep, tmdb, type TmdbListItem } from "../src/lib/tmdb";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function seedFallback() {
  console.log("TMDB_API_KEY no configurada -> usando dataset local curado (sin pósters).");

  for (const genre of FALLBACK_GENRES) {
    await prisma.genre.upsert({
      where: { id: genre.id },
      update: { name: genre.name },
      create: genre,
    });
  }

  const personCache = new Map<string, string>(); // name -> Person.id

  async function upsertPerson(name: string) {
    const cached = personCache.get(name);
    if (cached) return cached;

    // Negative synthetic tmdbId so it never collides with a real TMDB id.
    const syntheticId = -(hashString(name) % 1_000_000_000 || 1);
    const person = await prisma.person.upsert({
      where: { tmdbId: syntheticId },
      update: { name },
      create: { tmdbId: syntheticId, name, knownForDepartment: "Acting" },
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

    const directorId = await upsertPerson(t.director);
    await prisma.titleCrew.upsert({
      where: { titleId_personId_job: { titleId: title.id, personId: directorId, job: "Director" } },
      update: {},
      create: { titleId: title.id, personId: directorId, job: "Director" },
    });

    let order = 0;
    for (const actorName of t.cast) {
      if (actorName === "Various") continue;
      const personId = await upsertPerson(actorName);
      await prisma.titleCast.upsert({
        where: { titleId_personId: { titleId: title.id, personId } },
        update: { order },
        create: { titleId: title.id, personId, order },
      });
      order += 1;
    }
  }

  console.log(`Fallback: ${FALLBACK_TITLES.length} títulos y ${personCache.size} personas cargadas.`);
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

async function seedFromTmdb() {
  console.log("TMDB_API_KEY detectada -> importando catálogo real desde TMDB.");

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
      await enrichTitle(title.id, item.id, type);
      await sleep(150);
    }
  }

  console.log(`TMDB: ${combined.length} títulos importados (${DETAILS_LIMIT} enriquecidos con elenco).`);
}

async function enrichTitle(titleId: string, tmdbId: number, type: "MOVIE" | "SERIES") {
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
    const job = type === "MOVIE" ? "Director" : "Creator";
    await prisma.titleCrew.upsert({
      where: { titleId_personId_job: { titleId, personId: person.id, job } },
      update: {},
      create: { titleId, personId: person.id, job },
    });
  }
}

async function main() {
  if (hasTmdbKey()) {
    await seedFromTmdb();
  } else {
    await seedFallback();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
