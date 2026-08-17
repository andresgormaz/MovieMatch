import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecommendations } from "@/lib/recommend";
import { HomeHero } from "@/components/HomeHero";
import { VisitBeacon } from "@/components/VisitBeacon";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, country: true, originalTitles: true, onboardingCompletedAt: true, homeVisitedAt: true },
  });
  const onboardingDone = Boolean(user?.onboardingCompletedAt);
  const previousVisit = user?.homeVisitedAt ?? null;

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
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <VisitBeacon />
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

      {onboardingDone ? (
        <HomeHero />
      ) : (
        <Link
          href="/onboarding/titles"
          className="rounded-xl bg-accent px-6 py-4 text-center font-bold text-white hover:bg-accent-hover transition-colors"
        >
          Continuar configuración inicial →
        </Link>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <QuickLink href="/recommendations" label="Todas mis recomendaciones" />
        <QuickLink href="/diary" label="Mi diario" />
        <QuickLink href="/wishlist" label="Mi lista" />
        <QuickLink href="/explore" label="Explorar catálogo" />
        <QuickLink href="/groups" label="Grupos" />
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
