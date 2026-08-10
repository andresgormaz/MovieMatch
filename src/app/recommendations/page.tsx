"use client";

import { useEffect, useState, useCallback } from "react";
import { RecommendationCard, type Recommendation } from "@/components/RecommendationCard";

type Filter = "" | "MOVIE" | "SERIES";

export default function RecommendationsPage() {
  const [filter, setFilter] = useState<Filter>("");
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    const res = await fetch(`/api/recommendations${f ? `?type=${f}` : ""}`);
    const data = await res.json();
    setRecs(data.recommendations);
    setLoading(false);
  }, []);

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
        <h1 className="text-2xl font-bold">Tus recomendaciones</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Se actualizan cada vez que calificás algo nuevo. Calificá lo que ya viste para afinarlas
          más.
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
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-white text-neutral-900"
                : "border border-neutral-700 text-neutral-300 hover:border-neutral-500"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {loading && <p className="text-center text-sm text-neutral-500">Cargando…</p>}
        {!loading && recs.length === 0 && (
          <p className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-400">
            No encontramos más recomendaciones nuevas por ahora. Calificá más títulos, actores o
            géneros para descubrir más.
          </p>
        )}
        {recs.map((r) => (
          <RecommendationCard key={r.id} rec={r} onRated={handleRated} />
        ))}
      </div>
    </div>
  );
}
