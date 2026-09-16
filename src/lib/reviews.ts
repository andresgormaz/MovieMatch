import { prisma } from "@/lib/prisma";
import type { TitleType } from "@/generated/prisma/enums";
import { getRecommendations } from "@/lib/recommend";
import { displayTitleName } from "@/lib/titleDisplay";
import { tmdb, hasTmdbKey, sleep } from "@/lib/tmdb";

const CANDIDATE_TITLES = 10; // top recommendations considered as review sources
const TARGET_TITLES_WITH_REVIEWS = 5; // stop once this many titles actually had reviews
const REVIEWS_STORED_PER_TITLE = 5; // cached per title on first fetch
const REVIEWS_SHOWN_PER_TITLE = 2; // shown on the page, so one title can't dominate
const RECENT_WITHIN_YEARS = 2; // "idealmente nuevas" -- prefer recent releases first

export interface ReviewListItem {
  id: string;
  author: string;
  authorAvatarPath: string | null;
  authorRating: number | null;
  content: string;
  url: string;
  publishedAt: Date;
  title: { id: string; name: string; type: TitleType; posterPath: string | null };
}

type ReviewCandidateTitle = {
  id: string;
  tmdbId: number;
  type: TitleType;
  name: string;
  originalName: string | null;
  releaseYear: number | null;
  posterPath: string | null;
  reviewsFetchedAt: Date | null;
};

// Reviews for the titles most recommended to this user, recent releases
// prioritized -- "para ti" reviews, not a generic catalog browse. Reuses the
// recommendation engine's own ranking as the candidate pool instead of a
// separate popularity query, so this always matches what "Para ti" is
// actually recommending.
export async function getReviewsForUser(
  userId: string,
  useOriginalTitles: boolean,
  userCountry: string | null,
): Promise<ReviewListItem[]> {
  const recs = await getRecommendations(userId, { limit: CANDIDATE_TITLES, userCountry, useOriginalTitles });
  if (recs.length === 0) return [];

  const candidates = await prisma.title.findMany({
    where: { id: { in: recs.map((r) => r.id) } },
    select: { id: true, tmdbId: true, type: true, name: true, originalName: true, releaseYear: true, posterPath: true, reviewsFetchedAt: true },
  });
  const byId = new Map(candidates.map((t) => [t.id, t]));
  const currentYear = new Date().getFullYear();
  const ordered = recs
    .map((r) => byId.get(r.id))
    .filter((t): t is ReviewCandidateTitle => Boolean(t))
    .sort((a, b) => {
      const aRecent = (a.releaseYear ?? 0) >= currentYear - RECENT_WITHIN_YEARS ? 1 : 0;
      const bRecent = (b.releaseYear ?? 0) >= currentYear - RECENT_WITHIN_YEARS ? 1 : 0;
      return bRecent - aRecent;
    });

  const items: ReviewListItem[] = [];
  let titlesWithReviews = 0;
  for (const title of ordered) {
    if (titlesWithReviews >= TARGET_TITLES_WITH_REVIEWS) break;
    const reviews = await getReviewsForTitle(title);
    if (reviews.length === 0) continue;
    titlesWithReviews += 1;
    for (const r of reviews.slice(0, REVIEWS_SHOWN_PER_TITLE)) {
      items.push({
        id: r.id,
        author: r.author,
        authorAvatarPath: r.authorAvatarPath,
        authorRating: r.authorRating,
        content: r.content,
        url: r.url,
        publishedAt: r.publishedAt,
        title: { id: title.id, name: displayTitleName(title, useOriginalTitles), type: title.type, posterPath: title.posterPath },
      });
    }
  }
  return items;
}

// Lazy, once per title (see Title.reviewsFetchedAt) -- pulls from TMDB the
// first time any user's "Para ti" page actually needs this title's
// reviews, then every later request just reads the cache.
async function getReviewsForTitle(title: ReviewCandidateTitle) {
  if (!title.reviewsFetchedAt && hasTmdbKey()) {
    try {
      const res = title.type === "MOVIE" ? await tmdb.movieReviews(title.tmdbId) : await tmdb.tvReviews(title.tmdbId);
      for (const r of res.results.slice(0, REVIEWS_STORED_PER_TITLE)) {
        await prisma.titleReview.upsert({
          where: { tmdbReviewId: r.id },
          update: {},
          create: {
            titleId: title.id,
            tmdbReviewId: r.id,
            author: r.author,
            authorAvatarPath: r.author_details.avatar_path,
            authorRating: r.author_details.rating,
            content: r.content,
            url: r.url,
            publishedAt: new Date(r.created_at),
          },
        });
      }
      await prisma.title.update({ where: { id: title.id }, data: { reviewsFetchedAt: new Date() } });
      await sleep(80);
    } catch {
      // TMDB hiccup -- reviewsFetchedAt stays null so the next request tries again.
    }
  }
  return prisma.titleReview.findMany({ where: { titleId: title.id }, orderBy: { publishedAt: "desc" } });
}
