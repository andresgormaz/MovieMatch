"use client";

import { useCallback, useEffect, useState } from "react";
import { ExploreCard, type ExploreTitle } from "@/components/explore/ExploreCard";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { POPULAR_POOL_SIZE } from "@/lib/titleFilters";
import { PageTour } from "@/components/PageTour";
import type { TourStep } from "@/components/TourOverlay";

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="tour-rate-popular-list"]',
    title: "Califica rápido, en lote",
    body: "No la vi o La vi -- son los títulos más populares del catálogo, así que suele haber varios que ya viste.",
  },
];

export default function RatePopularPage() {
  const [titles, setTitles] = useState<ExploreTitle[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        sort: "votes",
        unrated: "1",
        page: String(p),
      });
      const res = await fetch(`/api/catalog?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setTitles((prev) => {
        const next = append ? [...prev, ...data.titles] : data.titles;
        // Cap the pool at POPULAR_POOL_SIZE regardless of how much more the
        // (unfiltered) catalog actually has -- "populares" means the top N
        // by votes, not the whole thing.
        return next.slice(0, POPULAR_POOL_SIZE);
      });
      setTotalPages(Math.min(data.totalPages, Math.ceil(POPULAR_POOL_SIZE / data.pageSize)));
      setPage(p);
    } catch {
      setError("No se pudo cargar la lista. Inténtalo de nuevo en un momento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load(1, false);
  }, [load]);

  function handleRated(titleId: string) {
    setTitles((prev) => prev.filter((t) => t.id !== titleId));
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8">
      <BackToHomeLink />
      <PageTour pageKey="ratePopular" steps={TOUR_STEPS} />
      <div>
        <h1 className="text-2xl font-bold">Calificar populares</h1>
        <p className="mt-1 text-sm text-muted">
          Películas y series muy populares, con alta probabilidad de que ya las hayas visto. Calificarlas
          es una de las formas más rápidas de mejorar tus recomendaciones.
        </p>
      </div>

      {error && (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">{error}</p>
      )}

      {!loading && !error && titles.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Ya calificaste todo lo popular que tenemos por ahora. Vuelve más adelante a medida que el catálogo
          crezca.
        </p>
      )}

      <div data-tour="tour-rate-popular-list" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {titles.map((t) => (
          <ExploreCard key={t.id} title={t} onRated={handleRated} />
        ))}
      </div>

      {loading && <p className="mt-2 text-center text-sm text-muted">Cargando…</p>}

      {!loading && page < totalPages && (
        <div className="mt-2 flex justify-center">
          <button
            onClick={() => load(page + 1, true)}
            className="rounded-md border border-white/15 px-6 py-2.5 text-sm font-medium text-white hover:border-white/30 transition-colors"
          >
            Cargar más
          </button>
        </div>
      )}
    </div>
  );
}
