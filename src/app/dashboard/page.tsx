import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecommendations } from "@/lib/recommend";
import { countUnseenReceived } from "@/lib/friends";
import { HomeForYou } from "@/components/HomeForYou";
import { HomeTour } from "@/components/HomeTour";
import { VisitBeacon } from "@/components/VisitBeacon";
import { POPULAR_POOL_SIZE } from "@/lib/titleFilters";

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

  let pendingRatings = 0;
  let pendingPopular = 0;
  let pendingFriends = 0;
  if (onboardingDone) {
    const [ratingsCount, popularPool, friendsCount] = await Promise.all([
      prisma.userTitleRating.count({ where: { userId, seen: true, score: null } }),
      // Same top-N-by-votes pool "Calificar populares" itself shows -- see
      // POPULAR_POOL_SIZE -- so the badge always matches what's on the page.
      prisma.title.findMany({ orderBy: { voteCount: "desc" }, take: POPULAR_POOL_SIZE, select: { id: true } }),
      countUnseenReceived(userId),
    ]);
    pendingRatings = ratingsCount;
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <VisitBeacon />
      {onboardingDone && <HomeTour startOpen={showTour} />}
      <div>
        <h1 className="text-2xl font-bold">Hola{user?.name ? `, ${user.name}` : ""} 👋</h1>
        {newSinceLastVisit > 0 && (
          <p className="mt-1 text-sm text-accent-hover">
            {newSinceLastVisit === 1
              ? "1 recomendación nueva desde tu última visita"
              : `${newSinceLastVisit} recomendaciones nuevas desde tu última visita`}
          </p>
        )}
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
        <section data-tour="tour-foryou" className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-white">Para ti</h2>
          <HomeForYou />
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Link href="/recommendations" className="text-center text-muted hover:text-white transition-colors">
              Ver todas →
            </Link>
            <Link href="/explore" className="text-center text-muted hover:text-white transition-colors">
              Explorar catálogo
            </Link>
            <Link href="/wishlist" className="text-center text-muted hover:text-white transition-colors">
              Mi lista
            </Link>
            <Link href="/whats-new" className="text-center text-muted hover:text-white transition-colors">
              Novedades para ti
            </Link>
          </div>
        </section>
      )}

      {onboardingDone && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-white">Conócete</h2>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Link
              href="/vs"
              data-tour="tour-vs"
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:border-accent"
            >
              &quot;¿Cuál te gusta más?&quot;
              <span aria-hidden className="text-muted">
                →
              </span>
            </Link>
            <Link
              href="/rate/popular"
              data-tour="tour-populares"
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:border-accent"
            >
              Calificar populares
              {pendingPopular > 0 && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                  {pendingPopular > 99 ? "99+" : pendingPopular}
                </span>
              )}
            </Link>
          </div>
          {/* Lower relevance -- mostly fed by "vs" swaps, so it only matters
              once there's actually something pending here. */}
          <Link
            href="/rate"
            data-tour="tour-rate"
            className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface/40 px-3.5 py-2.5 text-xs font-medium text-neutral-300 transition-colors hover:border-white/30"
          >
            Calificar lo que ya viste
            {pendingRatings > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                {pendingRatings}
              </span>
            )}
          </Link>
        </section>
      )}

      {onboardingDone && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-white">Social</h2>
          <div data-tour="tour-social" className="grid grid-cols-2 gap-2.5">
            <Link
              href="/friends"
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:border-accent"
            >
              Amigos
              {pendingFriends > 0 && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                  {pendingFriends > 99 ? "99+" : pendingFriends}
                </span>
              )}
            </Link>
            <Link
              href="/groups"
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:border-accent"
            >
              Grupos
              <span aria-hidden className="text-muted">
                →
              </span>
            </Link>
          </div>
        </section>
      )}

      <div data-tour="tour-quicklinks" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <QuickLink href="/diary" label="Mi diario" />
        <QuickLink href="/news" label="Noticias" />
        <QuickLink href="/top" label="Tu top 5" />
        <QuickLink href="/tastes" label="Mis gustos" />
        <QuickLink href="/profile" label="Perfil y estadísticas" />
      </div>
    </div>
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
