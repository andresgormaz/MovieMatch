"use client";

import { useCallback, useEffect, useState } from "react";
import { WishlistCard, type WishlistItem } from "@/components/WishlistCard";
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

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_CATALOG_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const load = useCallback(async (f: CatalogFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params = buildCatalogQuery(f);
      const res = await fetch(`/api/wishlist?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudo cargar tu lista");
      const data = await res.json();
      setItems(data.items);
    } catch {
      setError("No se pudo cargar tu lista. Inténtalo de nuevo en un momento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = loadStoredFilters("wishlist") ?? EMPTY_CATALOG_FILTERS;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted filters + fetch on mount
    setFilters(stored);
    load(stored);
  }, [load]);

  function applyFilters() {
    storeFilters("wishlist", filters);
    load(filters);
  }

  function clearFilters() {
    clearStoredFilters("wishlist");
    setFilters(EMPTY_CATALOG_FILTERS);
    load(EMPTY_CATALOG_FILTERS);
  }

  function applySavedFilters(entry: SavedFilterEntry) {
    setFilters(entry.filters);
    storeFilters("wishlist", entry.filters);
    load(entry.filters);
  }

  async function saveCurrentFilters(name: string) {
    const ok = await save(name, filters);
    if (ok) applyFilters();
  }

  function handleRemoved(titleId: string) {
    setItems((prev) => prev.filter((i) => i.id !== titleId));
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
              savedFilters={savedFilters}
              onApplySaved={applySavedFilters}
              onDeleteSaved={remove}
              onSaveCurrent={saveCurrentFilters}
              saveError={saveError}
            />
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Mi lista</h1>
            <p className="mt-1 text-sm text-muted">
              Títulos que marcaste como &quot;la voy a ver&quot;. Cuando la veas, márcala como vista para que deje de
              aparecer aquí y afine tus próximas recomendaciones.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {loading && <p className="text-center text-sm text-muted">Cargando…</p>}
            {error && (
              <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">{error}</p>
            )}
            {!loading && !error && items.length === 0 && (
              <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
                Todavía no agregaste nada, o nada de tu lista calza con esos filtros.
              </p>
            )}
            {items.map((item) => (
              <WishlistCard key={item.id} item={item} onRemoved={handleRemoved} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
