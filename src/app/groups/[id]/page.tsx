"use client";

import { use, useCallback, useEffect, useState } from "react";
import { RecommendationCard, type Recommendation } from "@/components/RecommendationCard";
import {
  FilterPanel,
  EMPTY_CATALOG_FILTERS,
  buildCatalogQuery,
  type CatalogFilters,
  type Genre,
  type Country,
} from "@/components/explore/FilterPanel";

export default function GroupRecommendationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_CATALOG_FILTERS);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [genresRes, countriesRes] = await Promise.all([fetch("/api/genres"), fetch("/api/countries")]);
      setGenres((await genresRes.json()).genres);
      setCountries((await countriesRes.json()).countries);
    })();
  }, []);

  const load = useCallback(
    async (f: CatalogFilters) => {
      setLoading(true);
      setError(null);
      try {
        const params = buildCatalogQuery(f);
        const res = await fetch(`/api/groups/${id}/recommendations?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "No se pudo cargar");
        }
        const data = await res.json();
        setRecs(data.recommendations);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar");
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load(EMPTY_CATALOG_FILTERS);
  }, [load]);

  function applyFilters() {
    load(filters);
  }

  function clearFilters() {
    setFilters(EMPTY_CATALOG_FILTERS);
    load(EMPTY_CATALOG_FILTERS);
  }

  function handleRated(titleId: string) {
    setRecs((prev) => prev.filter((r) => r.id !== titleId));
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:flex-row">
      <aside className="flex-shrink-0 lg:w-72">
        <div className="lg:sticky lg:top-20">
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            genres={genres}
            countries={countries}
            onApply={applyFilters}
            onClear={clearFilters}
          />
        </div>
      </aside>

      <div className="flex-1">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Recomendaciones del grupo</h1>
          <p className="mt-1 text-sm text-muted">
            Combinan los gustos de todos los miembros y no incluyen nada que alguno ya haya visto.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {loading && <p className="text-center text-sm text-muted">Cargando…</p>}
          {error && (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
              {error}
            </p>
          )}
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
    </div>
  );
}
