import { prisma } from "@/lib/prisma";
import type { TitleType } from "@/generated/prisma/enums";
import type { DerivedPreferences } from "@/lib/preferenceCounts";
import { displayTitleName } from "@/lib/titleDisplay";
import { tmdb, hasTmdbKey, sleep } from "@/lib/tmdb";

const VISUAL_TOP_N = 5;
const GENDER_FEMALE = 1;
const GENDER_MALE = 2;

export interface TasteVisualPerson {
  name: string;
  profilePath: string | null;
}

export interface TasteVisualTitle {
  name: string;
  type: TitleType;
  posterPath: string | null;
}

export interface TasteVisuals {
  moviePoster: TasteVisualTitle | null;
  actorPhoto: TasteVisualPerson | null;
  actressPhoto: TasteVisualPerson | null;
  directorPhoto: TasteVisualPerson | null;
}

function randomPick<T>(items: T[]): T | null {
  return items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;
}

function topWeighted(map: Map<string, number>, take: number): string[] {
  return [...map.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([id]) => id);
}

// A small, disciplined "taste collage" for the home screen: one movie
// poster from the user's favorite genre (a random 4-5 star pick, so it
// changes across visits), plus a random favorite actor/actress/director
// photo each drawn from their respective top 5 -- same "random within top
// N" idea as the poster, so the block feels alive without being random
// noise (still bounded to people/titles that are genuinely a favorite).
// Takes an already-computed DerivedPreferences (see getTasteKeywords for
// why) instead of a userId.
export async function getTasteVisuals(
  userId: string,
  prefs: DerivedPreferences,
  useOriginalTitles: boolean,
): Promise<TasteVisuals> {
  const moviePoster = await pickFavoriteGenrePoster(userId, prefs.genre, useOriginalTitles);

  const topActorIds = topWeighted(prefs.actor, VISUAL_TOP_N);
  const topDirectorIds = topWeighted(prefs.director, VISUAL_TOP_N);
  const candidateIds = [...new Set([...topActorIds, ...topDirectorIds])];

  let people =
    candidateIds.length > 0
      ? await prisma.person.findMany({
          where: { id: { in: candidateIds } },
          select: { id: true, tmdbId: true, name: true, profilePath: true, gender: true, detailsFetchedAt: true },
        })
      : [];

  people = await backfillMissingGender(people);

  const byId = new Map(people.map((p) => [p.id, p]));
  const actorPool = topActorIds.map((id) => byId.get(id)).filter((p) => p && p.gender === GENDER_MALE) as typeof people;
  const actressPool = topActorIds.map((id) => byId.get(id)).filter((p) => p && p.gender === GENDER_FEMALE) as typeof people;
  const directorPool = topDirectorIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const actor = randomPick(actorPool);
  const actress = randomPick(actressPool);
  const director = randomPick(directorPool);

  return {
    moviePoster,
    actorPhoto: actor ? { name: actor.name, profilePath: actor.profilePath } : null,
    actressPhoto: actress ? { name: actress.name, profilePath: actress.profilePath } : null,
    directorPhoto: director ? { name: director.name, profilePath: director.profilePath } : null,
  };
}

async function pickFavoriteGenrePoster(
  userId: string,
  genrePrefs: Map<number, number>,
  useOriginalTitles: boolean,
): Promise<TasteVisualTitle | null> {
  const [topGenre] = [...genrePrefs.entries()].sort((a, b) => b[1] - a[1]);
  if (!topGenre || topGenre[1] <= 0) return null;
  const [genreId] = topGenre;

  const candidates = await prisma.userTitleRating.findMany({
    where: { userId, seen: true, score: { gte: 4 }, title: { genres: { some: { genreId } } } },
    select: { title: { select: { name: true, originalName: true, type: true, posterPath: true } } },
  });
  const pick = randomPick(candidates)?.title;
  if (!pick) return null;

  return { name: displayTitleName(pick, useOriginalTitles), type: pick.type, posterPath: pick.posterPath };
}

// Only ever asked to backfill a handful of people (top 5 actors + top 5
// directors, deduped) -- small enough to fetch inline on a home page
// render. Self-heals people imported before Person.gender existed; once
// cached, later visits skip straight past this.
async function backfillMissingGender<
  T extends { id: string; tmdbId: number; gender: number | null; detailsFetchedAt: Date | null },
>(people: T[]): Promise<T[]> {
  if (!hasTmdbKey()) return people;
  const missing = people.filter((p) => p.gender == null);
  if (missing.length === 0) return people;

  const updated = new Map<string, number>();
  for (const p of missing) {
    try {
      const details = await tmdb.personDetails(p.tmdbId);
      const gender = details.gender ?? 0;
      await prisma.person.update({
        where: { id: p.id },
        data: { gender, detailsFetchedAt: p.detailsFetchedAt ?? new Date() },
      });
      updated.set(p.id, gender);
      await sleep(60);
    } catch {
      // Best effort -- this person just stays out of the actor/actress/
      // director pools this time; gender stays null so the next render tries again.
    }
  }
  if (updated.size === 0) return people;
  return people.map((p) => (updated.has(p.id) ? { ...p, gender: updated.get(p.id)! } : p));
}
