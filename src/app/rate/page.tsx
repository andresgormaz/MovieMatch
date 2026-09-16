import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { RateSeenList, type SeenUnratedItem } from "@/components/RateSeenList";
import { PageTour } from "@/components/PageTour";
import type { TourStep } from "@/components/TourOverlay";

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="tour-rate-list"]',
    title: "Ponles estrellas",
    body: "Estos títulos ya quedaron marcados como vistos -- solo les falta tu calificación.",
  },
];

export default async function RatePage() {
  const session = await auth();
  const userId = session!.user.id;

  const pending = await prisma.userTitleRating.findMany({
    where: { userId, seen: true, score: null },
    include: { title: { select: { id: true, name: true, type: true, releaseYear: true, posterPath: true } } },
    orderBy: { ratedAt: "desc" },
  });

  const items: SeenUnratedItem[] = pending.map((r) => ({
    id: r.title.id,
    name: r.title.name,
    type: r.title.type,
    releaseYear: r.title.releaseYear,
    posterUrl: tmdbPosterUrl(r.title.posterPath),
  }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <BackToHomeLink />
      <PageTour pageKey="rate" steps={TOUR_STEPS} />
      <div>
        <h1 className="text-2xl font-bold">Calificar lo que ya viste</h1>
        <p className="mt-1 text-sm text-muted">
          Títulos que quedaron marcados como vistos (por ejemplo, al elegir entre dos en &quot;vs&quot;) pero todavía
          sin tu nota.
        </p>
      </div>

      <div data-tour="tour-rate-list">
        <RateSeenList initialItems={items} />
      </div>
    </div>
  );
}
