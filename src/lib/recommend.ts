import { prisma } from "@/lib/prisma";
import type { TitleType } from "@/generated/prisma/enums";

const WEIGHTS = {
  genre: 2,
  country: 2,
  cast: 3,
  director: 3,
  popularity: 0.5,
};

export interface RecommendationResult {
  id: string;
  name: string;
  type: TitleType;
  releaseYear: number | null;
  posterPath: string | null;
  overview: string | null;
  genres: string[];
  directors: string[];
  score: number;
  reasons: string[];
}

export async function getRecommendations(
  userId: string,
  opts: { type?: TitleType; limit?: number } = {},
): Promise<RecommendationResult[]> {
  const limit = opts.limit ?? 24;

  const [genrePrefs, countryPrefs, personRatings] = await Promise.all([
    prisma.userGenrePreference.findMany({ where: { userId } }),
    prisma.userCountryPreference.findMany({ where: { userId } }),
    prisma.userPersonRating.findMany({ where: { userId } }),
  ]);

  const genreWeight = new Map(genrePrefs.map((g) => [g.genreId, g.weight]));
  const countryWeight = new Map(countryPrefs.map((c) => [c.countryCode, c.weight]));
  const personScore = new Map(personRatings.map((p) => [p.personId, p.score]));

  const candidates = await prisma.title.findMany({
    where: {
      ratings: { none: { userId } },
      ...(opts.type ? { type: opts.type } : {}),
    },
    include: {
      genres: { include: { genre: true } },
      cast: { include: { person: true }, orderBy: { order: "asc" }, take: 8 },
      crew: { include: { person: true } },
    },
  });

  const results: RecommendationResult[] = candidates.map((title) => {
    let score = 0;
    const reasons: string[] = [];

    for (const tg of title.genres) {
      const w = genreWeight.get(tg.genreId) ?? 0;
      if (w !== 0) {
        score += w * WEIGHTS.genre;
        if (w > 0) reasons.push(`Te gusta ${tg.genre.name}`);
      }
    }

    if (title.originCountry) {
      const w = countryWeight.get(title.originCountry) ?? 0;
      score += w * WEIGHTS.country;
    }

    for (const c of title.cast) {
      const s = personScore.get(c.personId);
      if (s !== undefined && s !== 0) {
        score += s * WEIGHTS.cast;
        if (s > 0) reasons.push(`Actúa ${c.person.name}, que te gusta`);
      }
    }

    for (const c of title.crew) {
      const s = personScore.get(c.personId);
      if (s !== undefined && s !== 0) {
        score += s * WEIGHTS.director;
        if (s > 0) reasons.push(`Dirige ${c.person.name}, que te gusta`);
      }
    }

    if (title.voteAverage) {
      score += (title.voteAverage / 10) * WEIGHTS.popularity;
    }

    return {
      id: title.id,
      name: title.name,
      type: title.type,
      releaseYear: title.releaseYear,
      posterPath: title.posterPath,
      overview: title.overview,
      genres: title.genres.map((g) => g.genre.name),
      directors: title.crew.map((c) => c.person.name),
      score,
      reasons: reasons.slice(0, 3),
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
