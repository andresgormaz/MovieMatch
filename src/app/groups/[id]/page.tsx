"use client";

import { use, useCallback, useEffect, useState } from "react";
import { RecommendationCard, type Recommendation } from "@/components/RecommendationCard";

type Filter = "" | "MOVIE" | "SERIES";

export default function GroupRecommendationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [filter, setFilter] = useState<Filter>("");
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (f: Filter) => {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/groups/${id}/recommendations${f ? `?type=${f}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo cargar");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setRecs(data.recommendations);
      setLoading(false);
    },
    [id],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / filter change
    load(filter);
  }, [filter, load]);

  function handleRated(titleId: string) {
    setRecs((prev) => prev.filter((r) => r.id !== titleId));
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Recomendaciones del grupo</h1>
        <p className="mt-1 text-sm text-muted">
          Combinan los gustos de todos los miembros y no incluyen nada que alguno ya haya visto.
        </p>
      </div>

      <div className="flex gap-2">
        {[
          { value: "" as Filter, label: "Todo" },
          { value: "MOVIE" as Filter, label: "Películas" },
          { value: "SERIES" as Filter, label: "Series" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-accent text-white"
                : "border border-white/15 text-neutral-300 hover:border-white/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {loading && <p className="text-center text-sm text-muted">Cargando…</p>}
        {error && <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">{error}</p>}
        {!loading && !error && recs.length === 0 && (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
            No encontramos recomendaciones nuevas para el grupo todavía. Sigan calificando
            títulos, actores y géneros cada uno por su lado.
          </p>
        )}
        {recs.map((r) => (
          <RecommendationCard key={r.id} rec={r} onRated={handleRated} />
        ))}
      </div>
    </div>
  );
}
