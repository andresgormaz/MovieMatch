import { prisma } from "./prisma";
import { getRecommendations, type RecommendationResult } from "./recommend";
import { tmdbPosterUrl } from "./tmdb";
import { displayTitleName } from "./titleDisplay";

// "menor a 1 o 2 meses" -- a movie counts as a recent release for this long.
const NEW_RELEASE_WINDOW_DAYS = 60;
// "en los últimos 3 meses hayan sacado capítulos o temporadas".
const RESUME_SERIES_WINDOW_DAYS = 90;
// "solo la mostramos si tiene 4 o 5 estrellas".
const RESUME_MIN_SCORE = 4;
const SECTION_LIMIT = 12;

export interface WhatsNewItem {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  posterUrl: string | null;
  score: number;
}

export interface ResumeSeriesItem {
  id: string;
  name: string;
  posterUrl: string | null;
  lastAirDate: Date | null;
  myScore: number;
  watchProgress: string | null;
}

function toItem(r: RecommendationResult): WhatsNewItem {
  return { id: r.id, name: r.name, type: r.type, posterUrl: tmdbPosterUrl(r.posterPath), score: r.score };
}

// "Novedades para ti" page data: three independently-sourced sections, none
// of them the general recommendation feed.
// - newMovies/newSeries: the regular recommendation engine, just scoped to
//   recent releases (movies) or run plain (series) -- "Estrenos para ti".
// - resumeSeries: NOT a recommendation at all -- these are titles the user
//   already rated highly (4-5★) and marked with a watch progress, that
//   happen to have aired something new recently. Read straight off
//   UserTitleRating, bypassing getRecommendations entirely (which would
//   exclude anything already seen).
// - sagaMovies: other movies in a collection the user has started (seen at
//   least one entry), scored like a normal recommendation -- the standard
//   "already seen / no me interesa" exclusion in getRecommendations already
//   keeps out the ones they watched and the ones they rejected.
export async function getWhatsNew(
  userId: string,
  opts: { userCountry?: string | null; useOriginalTitles?: boolean } = {},
): Promise<{
  newMovies: WhatsNewItem[];
  newSeries: WhatsNewItem[];
  resumeSeries: ResumeSeriesItem[];
  sagaMovies: WhatsNewItem[];
}> {
  const userCountry = opts.userCountry ?? null;
  const useOriginalTitles = opts.useOriginalTitles ?? false;
  const now = new Date();
  const newReleaseCutoff = new Date(now.getTime() - NEW_RELEASE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const resumeCutoff = new Date(now.getTime() - RESUME_SERIES_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [newMoviesRaw, newSeriesRaw, resumeRows, startedCollections] = await Promise.all([
    getRecommendations(userId, {
      filters: { type: "MOVIE", releaseDate: { gte: newReleaseCutoff } },
      limit: SECTION_LIMIT,
      userCountry,
      useOriginalTitles,
    }),
    getRecommendations(userId, {
      filters: { type: "SERIES" },
      limit: SECTION_LIMIT,
      userCountry,
      useOriginalTitles,
    }),
    prisma.userTitleRating.findMany({
      where: {
        userId,
        seen: true,
        score: { gte: RESUME_MIN_SCORE },
        watchProgress: { not: null },
        title: { type: "SERIES", lastAirDate: { gte: resumeCutoff } },
      },
      include: { title: true },
      orderBy: { title: { lastAirDate: "desc" } },
      take: SECTION_LIMIT,
    }),
    prisma.userTitleRating.findMany({
      where: { userId, seen: true, title: { type: "MOVIE", collectionId: { not: null } } },
      select: { title: { select: { collectionId: true } } },
    }),
  ]);

  const sagaIds = [
    ...new Set(startedCollections.map((r) => r.title.collectionId).filter((id): id is number => id != null)),
  ];
  const sagaMoviesRaw =
    sagaIds.length > 0
      ? await getRecommendations(userId, {
          filters: { type: "MOVIE", collectionId: { in: sagaIds } },
          limit: SECTION_LIMIT,
          userCountry,
          useOriginalTitles,
        })
      : [];

  return {
    newMovies: newMoviesRaw.map(toItem),
    newSeries: newSeriesRaw.map(toItem),
    resumeSeries: resumeRows.map((r) => ({
      id: r.title.id,
      name: displayTitleName(r.title, useOriginalTitles),
      posterUrl: tmdbPosterUrl(r.title.posterPath),
      lastAirDate: r.title.lastAirDate,
      myScore: r.score ?? 0,
      watchProgress: r.watchProgress,
    })),
    sagaMovies: sagaMoviesRaw.map(toItem),
  };
}
