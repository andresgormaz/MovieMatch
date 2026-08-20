"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  type SavedFilterEntry,
} from "@/components/explore/FilterPanel";
import { loadStoredFilters, storeFilters, clearStoredFilters } from "@/lib/filterStorage";
import { useSavedFilters } from "@/lib/useSavedFilters";

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExplorePageInner />
    </Suspense>
  );
}

function ExplorePageInner() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filters, setFilters] = useState<CatalogFilters>({ ...EMPTY_CATALOG_FILTERS, q: initialQ });
  const [titles, setTitles] = useState<ExploreTitle[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<string | null>(null);
  const { savedFilters, saveError, save, remove } = useSavedFilters();

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
    // Restore whatever was last applied on this page (sticky until
    // "Limpiar") -- a `?q=` from the navbar search still wins over a stored
    // search term, but the rest of the stored filters carry over.
    const stored = loadStoredFilters("explore") ?? EMPTY_CATALOG_FILTERS;
    const initial = initialQ ? { ...stored, q: initialQ } : stored;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted filters + initial results load on mount
    setFilters(initial);
    runSearch(initial, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only ever re-runs from runSearch identity, initialQ is read once on mount
  }, [runSearch]);

  function applyFilters() {
    storeFilters("explore", filters);
    runSearch(filters, 1, false);
  }

  function clearFilters() {
    clearStoredFilters("explore");
    setActiveSavedFilterId(null);
    setFilters(EMPTY_CATALOG_FILTERS);
    runSearch(EMPTY_CATALOG_FILTERS, 1, false);
  }

  // Any manual edit means the applied filters no longer exactly match
  // whichever saved preset was last selected, so it stops looking "active".
  function changeFilters(updater: (prev: CatalogFilters) => CatalogFilters) {
    setActiveSavedFilterId(null);
    setFilters(updater);
  }

  function applySavedFilters(entry: SavedFilterEntry) {
    setActiveSavedFilterId(entry.id);
    setFilters(entry.filters);
    storeFilters("explore", entry.filters);
    runSearch(entry.filters, 1, false);
  }

  async function saveCurrentFilters(name: string) {
    const saved = await save(name, filters);
    if (saved) {
      setActiveSavedFilterId(saved.id);
      applyFilters();
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8">
      <BackToHomeLink />
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="flex-shrink-0 lg:w-72">
          <div className="lg:sticky lg:top-20">
            <FilterPanel
              filters={filters}
              onChange={changeFilters}
              genres={genres}
              countries={countries}
              providers={providers}
              onApply={applyFilters}
              onClear={clearFilters}
              showSort
              showSearch
              savedFilters={savedFilters}
              activeSavedFilterId={activeSavedFilterId}
              onApplySaved={applySavedFilters}
              onDeleteSaved={remove}
              onSaveCurrent={saveCurrentFilters}
              saveError={saveError}
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
              No encontramos títulos con esos filtros. Prueba ampliarlos.
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
