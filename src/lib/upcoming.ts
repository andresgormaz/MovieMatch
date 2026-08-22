import { prisma } from "./prisma";
import { tmdbPosterUrl } from "./tmdb";
import { displayTitleName } from "./titleDisplay";

const LIMIT = 12;

export interface UpcomingMovie {
  id: string;
  name: string;
  releaseDate: Date | null;
  posterUrl: string | null;
  genres: string[];
}

export interface UpcomingSeries {
  id: string;
  name: string;
  nextEpisodeAirDate: Date | null;
  posterUrl: string | null;
  genres: string[];
  providers: { id: number; name: string }[];
}

// "Próximos estrenos" home section -- two independent, honestly-labeled
// feeds rather than one blended list, since they mean different things:
// movies here are upcoming theatrical releases (cine); series are existing,
// already-streaming shows with a new episode/season scheduled (see
// seedCatalog.ts's UPCOMING_REGION / next_episode_to_air comments for why
// we don't claim to know streaming *premiere* dates). Shared by the
// dashboard (server-rendered) and /api/upcoming (for client-side use later).
export async function getUpcomingReleases(opts: {
  userCountry?: string | null;
  useOriginalTitles?: boolean;
} = {}): Promise<{ movies: UpcomingMovie[]; series: UpcomingSeries[] }> {
  const userCountry = opts.userCountry ?? null;
  const useOriginalTitles = opts.useOriginalTitles ?? false;
  const now = new Date();

  const [movies, series] = await Promise.all([
    prisma.title.findMany({
      where: { type: "MOVIE", releaseDate: { gt: now } },
      orderBy: { releaseDate: "asc" },
      take: LIMIT,
      include: { genres: { include: { genre: true } } },
    }),
    prisma.title.findMany({
      where: { type: "SERIES", nextEpisodeAirDate: { gt: now } },
      orderBy: { nextEpisodeAirDate: "asc" },
      take: LIMIT,
      include: {
        genres: { include: { genre: true } },
        providers: { where: { countryCode: userCountry ?? "" }, include: { provider: true } },
      },
    }),
  ]);

  return {
    movies: movies.map((t) => ({
      id: t.id,
      name: displayTitleName(t, useOriginalTitles),
      releaseDate: t.releaseDate,
      posterUrl: tmdbPosterUrl(t.posterPath),
      genres: t.genres.map((g) => g.genre.name),
    })),
    series: series.map((t) => ({
      id: t.id,
      name: displayTitleName(t, useOriginalTitles),
      nextEpisodeAirDate: t.nextEpisodeAirDate,
      posterUrl: tmdbPosterUrl(t.posterPath),
      genres: t.genres.map((g) => g.genre.name),
      providers: t.providers.map((p) => ({ id: p.provider.id, name: p.provider.name })),
    })),
  };
}
