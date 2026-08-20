"use client";

import { useCallback, useEffect, useState } from "react";
import type { CatalogFilters } from "@/lib/catalogFilters";
import type { SavedFilterEntry } from "@/components/explore/FilterPanel";

// Named filter presets (DB-backed via /api/saved-filters, so they follow the
// user across devices) -- shared by the FilterPanel instances on /explore,
// /recommendations, and /wishlist, since a preset saved on one is just as
// meaningful applied on another.
export function useSavedFilters() {
  const [savedFilters, setSavedFilters] = useState<SavedFilterEntry[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/saved-filters");
    if (!res.ok) return;
    const data = await res.json();
    setSavedFilters(data.savedFilters);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
  }, [refresh]);

  async function save(name: string, filters: CatalogFilters): Promise<boolean> {
    setSaveError(null);
    try {
      const res = await fetch("/api/saved-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(data?.error ?? "No se pudo guardar el filtro.");
        return false;
      }
      setSavedFilters((prev) => [...prev, data.savedFilter].sort((a, b) => a.name.localeCompare(b.name)));
      return true;
    } catch {
      setSaveError("No se pudo guardar el filtro.");
      return false;
    }
  }

  async function remove(id: string) {
    setSavedFilters((prev) => prev.filter((f) => f.id !== id));
    await fetch(`/api/saved-filters/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return { savedFilters, saveError, save, remove };
}
