"use client";

import { useCallback, useEffect, useState } from "react";
import { ExploreCard, type ExploreTitle } from "@/components/explore/ExploreCard";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import {
  FilterPanel,
  EMPTY_CATALOG_FILTERS,
  buildCatalogQuery,
  type CatalogFilters,
  type Genre,
  type Country,
  type Provider,
} from "@/components/explore/FilterPanel";

export default function ExplorePage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_CATALOG_FILTERS);
  const [titles, setTitles] = useState<ExploreTitle[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [genresRes, countriesRes, providersRes] = await Promise.all([
        fetch("/api/genres"),
        fetch("/api/countries"),
        fetch("/api/providers"),
      ]);
      setGenres((await genresRes.json()).genres);
      setCountries((await countriesRes.json()).countries);
      setProviders((await providersRes.json()).providers);
    })();
  }, []);

  const runSearch = useCallback(async (f: CatalogFilters, p: number, append: boolean) => {
    setLoading(true);
    const params = buildCatalogQuery(f);
    params.set("sort", f.sort);
    params.set("page", String(p));
    const res = await fetch(`/api/catalog?${params.toString()}`);
    const data = await res.json();
    setTitles((prev) => (append ? [...prev, ...data.titles] : data.titles));
    setTotalPages(data.totalPages);
    setTotal(data.total);
    setPage(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial results load on mount
    runSearch(EMPTY_CATALOG_FILTERS, 1, false);
  }, [runSearch]);

  function applyFilters() {
    runSearch(filters, 1, false);
  }

  function clearFilters() {
    setFilters(EMPTY_CATALOG_FILTERS);
    runSearch(EMPTY_CATALOG_FILTERS, 1, false);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8">
      <BackToHomeLink />
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="flex-shrink-0 lg:w-72">
          <div className="lg:sticky lg:top-20">
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              genres={genres}
              countries={countries}
              providers={providers}
              onApply={applyFilters}
              onClear={clearFilters}
              showSort
            />
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Explorar catálogo</h1>
            <p className="text-sm text-muted">{total} resultados</p>
          </div>

          {titles.length === 0 && !loading && (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
              No encontramos títulos con esos filtros. Probá ampliarlos.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {titles.map((t) => (
              <ExploreCard key={t.id} title={t} />
            ))}
          </div>

          {loading && <p className="mt-4 text-center text-sm text-muted">Cargando…</p>}

          {!loading && page < totalPages && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => runSearch(filters, page + 1, true)}
                className="rounded-md border border-white/15 px-6 py-2.5 text-sm font-medium text-white hover:border-white/30 transition-colors"
              >
                Cargar más
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
