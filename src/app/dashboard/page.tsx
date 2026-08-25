import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecommendations, type RecommendationResult } from "@/lib/recommend";
import { computeMergedPreferences, getTasteKeywords, type TasteKeyword } from "@/lib/preferenceCounts";
import { getTasteVisuals, type TasteVisuals } from "@/lib/tasteVisuals";
import { tmdbPosterUrl, tmdbProfileUrl } from "@/lib/tmdb";
import { Poster } from "@/components/Poster";
import { HomeTour } from "@/components/HomeTour";
import { VisitBeacon } from "@/components/VisitBeacon";
import { POPULAR_POOL_SIZE } from "@/lib/titleFilters";

const TASTE_CHIP_COUNT = 7;

const ICON_PROPS = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      country: true,
      originalTitles: true,
      onboardingCompletedAt: true,
      homeVisitedAt: true,
      tourSeenAt: true,
    },
  });
  const onboardingDone = Boolean(user?.onboardingCompletedAt);
  const previousVisit = user?.homeVisitedAt ?? null;
  const showTour = onboardingDone && !user?.tourSeenAt;

  let pendingPopular = 0;
  let tasteChips: TasteKeyword[] = [];
  let tasteVisuals: TasteVisuals = { moviePoster: null, actorPhoto: null, actressPhoto: null, directorPhoto: null };
  let friendsTotal = 0;
  let groupsTotal = 0;
  let recsTotal = 0;
  if (onboardingDone) {
    const useOriginalTitles = user?.originalTitles ?? false;
    // Computed once and shared -- both getTasteKeywords and getTasteVisuals
    // need it, and it's non-trivial to compute.
    const prefs = await computeMergedPreferences(userId, useOriginalTitles);
    const [popularPool, keywords, visuals, friendsCount, groupsCount, recsCount] = await Promise.all([
      // Same top-N-by-votes pool "Calificar populares" itself shows -- see
      // POPULAR_POOL_SIZE -- so the teaser count matches what's on the page.
      prisma.title.findMany({ orderBy: { voteCount: "desc" }, take: POPULAR_POOL_SIZE, select: { id: true } }),
      getTasteKeywords(prefs),
      getTasteVisuals(userId, prefs, useOriginalTitles),
      prisma.friendship.count({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
      prisma.groupMember.count({ where: { userId } }),
      prisma.sentRecommendation.count({ where: { toUserId: userId } }),
    ]);
    const popularIds = popularPool.map((t) => t.id);
    const ratedPopularCount =
      popularIds.length > 0
        ? await prisma.userTitleRating.count({ where: { userId, titleId: { in: popularIds } } })
        : 0;
    pendingPopular = popularIds.length - ratedPopularCount;
    tasteChips = [...keywords].sort((a, b) => b.weight - a.weight).slice(0, TASTE_CHIP_COUNT);
    tasteVisuals = visuals;
    friendsTotal = friendsCount;
    groupsTotal = groupsCount;
    recsTotal = recsCount;
  }

  // "New since your last visit" only means something once there's a previous
  // visit to compare against, and once onboarding is done (before that,
  // everything in the catalog is "new" to them, which isn't a useful signal).
  // Doubles as the "Para ti" block's teaser line when it's positive, and its
  // first pick doubles as the block's poster art.
  let newSinceLastVisit = 0;
  let posterTitle: RecommendationResult | null = null;
  if (onboardingDone && previousVisit) {
    const fresh = await getRecommendations(userId, {
      filters: { createdAt: { gt: previousVisit } },
      limit: 999,
      userCountry: user?.country ?? null,
      useOriginalTitles: user?.originalTitles ?? false,
    });
    newSinceLastVisit = fresh.length;
    posterTitle = fresh[0] ?? null;
  }
  // No fresh pick (nothing new, or this is the first visit) -- fall back to
  // the single top recommendation just for its poster art.
  if (onboardingDone && !posterTitle) {
    const [topPick] = await getRecommendations(userId, {
      limit: 1,
      userCountry: user?.country ?? null,
      useOriginalTitles: user?.originalTitles ?? false,
    });
    posterTitle = topPick ?? null;
  }

  const forYouDescription =
    newSinceLastVisit > 0
      ? `${newSinceLastVisit} recomendación${newSinceLastVisit === 1 ? "" : "es"} nueva${newSinceLastVisit === 1 ? "" : "s"} para ti`
      : "Recomendaciones a tu medida, catálogo completo y tu lista.";
  // The weighted taste chips take priority once there's any signal to show
  // -- they're the dynamic, always-changing teaser the "populares por
  // calificar" count doesn't compete well against (that pool rarely empties
  // out, which used to bury the chips behind it almost permanently). Only
  // brand-new users with no signal yet fall back to the populares count,
  // then to plain copy.
  const knowYouDescription =
    tasteChips.length > 0 ? (
      <TasteChipRow keywords={tasteChips} />
    ) : pendingPopular > 0 ? (
      `${pendingPopular} título${pendingPopular === 1 ? "" : "s"} popular${pendingPopular === 1 ? "" : "es"} por calificar`
    ) : (
      "Compara, califica y afina lo que te recomendamos."
    );
  const socialDescription =
    friendsTotal + groupsTotal + recsTotal > 0 ? (
      <SocialStatsRow friends={friendsTotal} groups={groupsTotal} recs={recsTotal} />
    ) : (
      "Amigos y grupos para compartir recomendaciones."
    );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <VisitBeacon />
      {onboardingDone && <HomeTour startOpen={showTour} />}
      <div>
        <h1 className="text-2xl font-bold">Hola{user?.name ? `, ${user.name}` : ""} 👋</h1>
      </div>

      {!onboardingDone && (
        <Link
          href="/onboarding/titles"
          className="rounded-xl bg-accent px-6 py-4 text-center font-bold text-white hover:bg-accent-hover transition-colors"
        >
          Continuar configuración inicial →
        </Link>
      )}

      {onboardingDone && (
        <div className="flex flex-col gap-2.5">
          <HomeBlockLink
            href="/recommendations"
            tourId="tour-block-foryou"
            label="Para ti"
            description={forYouDescription}
            visual={
              posterTitle ? (
                <div className="h-11 w-8 flex-shrink-0 overflow-hidden rounded-md bg-black/40">
                  <Poster name={posterTitle.name} type={posterTitle.type} posterUrl={tmdbPosterUrl(posterTitle.posterPath, "w92")} />
                </div>
              ) : (
                <IconBadge>
                  <svg {...ICON_PROPS}>
                    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z" />
                  </svg>
                </IconBadge>
              )
            }
          />
          <HomeBlockLink
            href="/know-you"
            tourId="tour-block-knowyou"
            label="Tus gustos"
            description={knowYouDescription}
            visual={
              tasteVisuals.moviePoster || tasteVisuals.actorPhoto || tasteVisuals.actressPhoto || tasteVisuals.directorPhoto ? (
                <TasteMosaic visuals={tasteVisuals} />
              ) : (
                <IconBadge>
                  <svg {...ICON_PROPS}>
                    <path d="M12 20s-7-4.3-9.5-9C1 7.5 2.5 4.5 5.5 4.5c1.8 0 3.2 1 4 2.3.8-1.3 2.2-2.3 4-2.3 3 0 4.5 3 3 6.5-2.5 4.7-9.5 9-9.5 9Z" />
                  </svg>
                </IconBadge>
              )
            }
          />
          <HomeBlockLink
            href="/social"
            tourId="tour-block-social"
            label="Social"
            description={socialDescription}
            visual={
              <IconBadge>
                <svg {...ICON_PROPS}>
                  <circle cx="9" cy="8.5" r="3" />
                  <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
                  <path d="M15.5 6a3 3 0 0 1 0 5.8" />
                  <path d="M17 14.8c2.4.5 3.8 2.2 3.8 4.7" />
                </svg>
              </IconBadge>
            }
          />
        </div>
      )}

      <div data-tour="tour-quicklinks" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <QuickLink href="/diary" label="Mi diario" />
        <QuickLink href="/news" label="Noticias" />
        <QuickLink href="/top" label="Tu top 5" />
      </div>
    </div>
  );
}

// Compact, tap-through teaser -- shows a one-line status, not the actual
// content (that lives one tap away on the block's own landing page). The
// whole card is the single tap target, no nested interactive elements, so
// it can never be mistaken for something to act on directly from the home
// screen the way the old inline recommendation cards were.
function HomeBlockLink({
  href,
  tourId,
  label,
  description,
  visual,
}: {
  href: string;
  tourId: string;
  label: string;
  description: React.ReactNode;
  visual: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-tour={tourId}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-accent"
    >
      {visual}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-white">{label}</span>
        <span className="block truncate text-xs text-muted">{description}</span>
      </span>
      <span aria-hidden className="flex-shrink-0 text-muted">
        →
      </span>
    </Link>
  );
}

// Circular icon badge -- the default leading visual for blocks that don't
// have art of their own to show (only "Para ti" swaps this for a poster).
function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-hover">
      {children}
    </span>
  );
}

// 2x2 collage standing in for the "Tus gustos" icon once there's taste data
// to show art for: favorite genre's poster, favorite actor/actriz/director
// photos, each a random pick within their own top 5 (see lib/tasteVisuals.ts)
// so it varies across visits without ever showing something that isn't
// genuinely a favorite. Any empty slot (no signal yet for that category)
// just renders as a blank cell instead of collapsing the grid.
function TasteMosaic({ visuals }: { visuals: TasteVisuals }) {
  const cells = [
    visuals.moviePoster && { url: tmdbPosterUrl(visuals.moviePoster.posterPath, "w92"), name: visuals.moviePoster.name },
    visuals.actorPhoto && { url: tmdbProfileUrl(visuals.actorPhoto.profilePath, "w45"), name: visuals.actorPhoto.name },
    visuals.actressPhoto && { url: tmdbProfileUrl(visuals.actressPhoto.profilePath, "w45"), name: visuals.actressPhoto.name },
    visuals.directorPhoto && { url: tmdbProfileUrl(visuals.directorPhoto.profilePath, "w45"), name: visuals.directorPhoto.name },
  ];
  return (
    <div className="grid h-9 w-9 flex-shrink-0 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-md bg-black/40">
      {cells.map((cell, i) => (
        <div key={i} className="overflow-hidden bg-white/5">
          {cell?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cell.url} alt={cell.name} loading="lazy" className="h-full w-full object-cover" />
          )}
        </div>
      ))}
    </div>
  );
}

// Weighted chip row standing in for a "word cloud" -- sorted by relevance
// (not scattered/rotated) and opacity-scaled by weight so it stays legible
// in the compact teaser card, reusing the app's existing chip/pill language.
function TasteChipRow({ keywords }: { keywords: TasteKeyword[] }) {
  const max = keywords[0]?.weight ?? 0;
  return (
    <>
      {keywords.map((k, i) => (
        <span key={k.name} style={{ opacity: max > 0 ? 0.5 + (k.weight / max) * 0.5 : 1 }} className="font-semibold text-accent-hover">
          {i > 0 && <span className="text-muted"> · </span>}
          {k.name}
        </span>
      ))}
    </>
  );
}

function SocialStatsRow({ friends, groups, recs }: { friends: number; groups: number; recs: number }) {
  const stats = [
    { n: friends, label: friends === 1 ? "amigo" : "amigos" },
    { n: groups, label: groups === 1 ? "grupo" : "grupos" },
    { n: recs, label: recs === 1 ? "recomendación" : "recomendaciones" },
  ];
  return (
    <>
      {stats.map((s, i) => (
        <span key={s.label}>
          {i > 0 && <span className="text-muted"> · </span>}
          <span className="font-semibold text-neutral-200">{s.n}</span> {s.label}
        </span>
      ))}
    </>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3.5 py-3 text-sm font-medium text-neutral-200 transition-colors hover:border-white/30 hover:bg-surface-hover hover:text-white"
    >
      {label}
      <span aria-hidden className="text-muted">
        →
      </span>
    </Link>
  );
}
