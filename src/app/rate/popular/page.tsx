"use client";

import { useCallback, useEffect, useState } from "react";
import { ExploreCard, type ExploreTitle } from "@/components/explore/ExploreCard";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { POPULAR_RATING_MIN_VOTES } from "@/lib/titleFilters";

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
        sort: "popularity",
        unrated: "1",
        votesMin: String(POPULAR_RATING_MIN_VOTES),
        page: String(p),
      });
      const res = await fetch(`/api/catalog?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setTitles((prev) => (append ? [...prev, ...data.titles] : data.titles));
      setTotalPages(data.totalPages);
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
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
