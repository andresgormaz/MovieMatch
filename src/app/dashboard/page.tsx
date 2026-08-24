import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecommendations } from "@/lib/recommend";
import { countUnseenReceived } from "@/lib/friends";
import { HomeTour } from "@/components/HomeTour";
import { VisitBeacon } from "@/components/VisitBeacon";
import { POPULAR_POOL_SIZE } from "@/lib/titleFilters";

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
  let pendingFriends = 0;
  if (onboardingDone) {
    const [popularPool, friendsCount] = await Promise.all([
      // Same top-N-by-votes pool "Calificar populares" itself shows -- see
      // POPULAR_POOL_SIZE -- so the teaser count matches what's on the page.
      prisma.title.findMany({ orderBy: { voteCount: "desc" }, take: POPULAR_POOL_SIZE, select: { id: true } }),
      countUnseenReceived(userId),
    ]);
    const popularIds = popularPool.map((t) => t.id);
    const ratedPopularCount =
      popularIds.length > 0
        ? await prisma.userTitleRating.count({ where: { userId, titleId: { in: popularIds } } })
        : 0;
    pendingPopular = popularIds.length - ratedPopularCount;
    pendingFriends = friendsCount;
  }

  // "New since your last visit" only means something once there's a previous
  // visit to compare against, and once onboarding is done (before that,
  // everything in the catalog is "new" to them, which isn't a useful signal).
  // Doubles as the "Para ti" block's teaser line when it's positive.
  let newSinceLastVisit = 0;
  if (onboardingDone && previousVisit) {
    const fresh = await getRecommendations(userId, {
      filters: { createdAt: { gt: previousVisit } },
      limit: 999,
      userCountry: user?.country ?? null,
      useOriginalTitles: user?.originalTitles ?? false,
    });
    newSinceLastVisit = fresh.length;
  }

  const forYouDescription =
    newSinceLastVisit > 0
      ? `${newSinceLastVisit} recomendación${newSinceLastVisit === 1 ? "" : "es"} nueva${newSinceLastVisit === 1 ? "" : "s"} para ti`
      : "Recomendaciones a tu medida, catálogo completo y tu lista.";
  const knowYouDescription =
    pendingPopular > 0
      ? `${pendingPopular} título${pendingPopular === 1 ? "" : "s"} popular${pendingPopular === 1 ? "" : "es"} por calificar`
      : "Compara, califica y afina lo que te recomendamos.";
  const socialDescription =
    pendingFriends > 0
      ? `${pendingFriends} recomendación${pendingFriends === 1 ? "" : "es"} de tus amigos`
      : "Amigos y grupos para compartir recomendaciones.";

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
            icon={
              <svg {...ICON_PROPS}>
                <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z" />
              </svg>
            }
          />
          <HomeBlockLink
            href="/know-you"
            tourId="tour-block-knowyou"
            label="Tus gustos"
            description={knowYouDescription}
            icon={
              <svg {...ICON_PROPS}>
                <path d="M12 20s-7-4.3-9.5-9C1 7.5 2.5 4.5 5.5 4.5c1.8 0 3.2 1 4 2.3.8-1.3 2.2-2.3 4-2.3 3 0 4.5 3 3 6.5-2.5 4.7-9.5 9-9.5 9Z" />
              </svg>
            }
          />
          <HomeBlockLink
            href="/social"
            tourId="tour-block-social"
            label="Social"
            description={socialDescription}
            icon={
              <svg {...ICON_PROPS}>
                <circle cx="9" cy="8.5" r="3" />
                <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
                <path d="M15.5 6a3 3 0 0 1 0 5.8" />
                <path d="M17 14.8c2.4.5 3.8 2.2 3.8 4.7" />
              </svg>
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
  icon,
}: {
  href: string;
  tourId: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-tour={tourId}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-accent"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-hover">
        {icon}
      </span>
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
