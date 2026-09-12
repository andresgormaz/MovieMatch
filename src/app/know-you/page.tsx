import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POPULAR_POOL_SIZE } from "@/lib/titleFilters";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { PageTour } from "@/components/PageTour";
import type { TourStep } from "@/components/TourOverlay";

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="tour-knowyou-main"]',
    title: "Cuéntanos tu gusto",
    body: "Compara pares o califica títulos populares -- ambas formas afinan tus recomendaciones rápido.",
  },
];

export default async function KnowYouPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [ratingsCount, popularPool] = await Promise.all([
    prisma.userTitleRating.count({ where: { userId, seen: true, score: null } }),
    prisma.title.findMany({ orderBy: { voteCount: "desc" }, take: POPULAR_POOL_SIZE, select: { id: true } }),
  ]);
  const popularIds = popularPool.map((t) => t.id);
  const ratedPopularCount =
    popularIds.length > 0 ? await prisma.userTitleRating.count({ where: { userId, titleId: { in: popularIds } } }) : 0;
  const pendingPopular = popularIds.length - ratedPopularCount;
  const pendingRatings = ratingsCount;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <BackToHomeLink />
      <PageTour pageKey="knowYou" steps={TOUR_STEPS} />
      <div>
        <h1 className="text-2xl font-bold">Tus gustos</h1>
        <p className="mt-1 text-sm text-muted">
          Entre más nos cuentes qué te gusta, mejores serán tus recomendaciones.
        </p>
      </div>

      <div data-tour="tour-knowyou-main" className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Link
            href="/vs"
            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:border-accent"
          >
            &quot;¿Cuál te gusta más?&quot;
            <span aria-hidden className="text-muted">
              →
            </span>
          </Link>
          <Link
            href="/rate/popular"
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
          className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface/40 px-3.5 py-2.5 text-xs font-medium text-neutral-300 transition-colors hover:border-white/30"
        >
          Calificar lo que ya viste
          {pendingRatings > 0 && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">{pendingRatings}</span>
          )}
        </Link>
      </div>

      <Link
        href="/tastes"
        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3.5 py-3 text-sm font-medium text-neutral-200 transition-colors hover:border-white/30 hover:bg-surface-hover hover:text-white"
      >
        Ajustar mis preferencias manualmente
        <span aria-hidden className="text-muted">
          →
        </span>
      </Link>
    </div>
  );
}
