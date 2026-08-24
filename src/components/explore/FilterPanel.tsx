"use client";

import { useState } from "react";
import { RangeInput } from "@/components/explore/RangeInput";
import { PersonAutocomplete } from "@/components/explore/PersonAutocomplete";
import { EMPTY_CATALOG_FILTERS, buildCatalogQuery, type PersonOption, type CatalogFilters, type SortOption } from "@/lib/catalogFilters";

// Re-exported so existing imports (`from "@/components/explore/FilterPanel"`)
// keep working -- the actual definitions live in src/lib/catalogFilters.ts,
// a plain (non-"use client") module, so server code (the saved-filters API
// routes) can import the same shape without pulling in this client component.
export { EMPTY_CATALOG_FILTERS, buildCatalogQuery };
export type { PersonOption, CatalogFilters, SortOption };

export interface Genre {
  id: number;
  name: string;
}
export interface Country {
  code: string;
  name: string;
}
export interface Provider {
  id: number;
  name: string;
  logoPath: string | null;
}

// One named, reusable filter preset -- see SavedFilter in schema.prisma.
export interface SavedFilterEntry {
  id: string;
  name: string;
  filters: CatalogFilters;
}

function FilterSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-white"
      >
        {title}
        <span className="text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="mt-3 flex flex-col gap-4">{children}</div>}
    </div>
  );
}

export function FilterPanel({
  filters,
  onChange,
  genres,
  countries,
  providers,
  onApply,
  onClear,
  showSort = false,
  showType = true,
  showSearch = false,
  savedFilters,
  activeSavedFilterId,
  onApplySaved,
  onDeleteSaved,
  onSaveCurrent,
  saveError,
}: {
  filters: CatalogFilters;
  onChange: (updater: (prev: CatalogFilters) => CatalogFilters) => void;
  genres: Genre[];
  countries: Country[];
  providers: Provider[];
  onApply: () => void;
  onClear: () => void;
  showSort?: boolean;
  showType?: boolean;
  showSearch?: boolean;
  savedFilters?: SavedFilterEntry[];
  activeSavedFilterId?: string | null;
  onApplySaved?: (entry: SavedFilterEntry) => void;
  onDeleteSaved?: (id: string) => void;
  onSaveCurrent?: (name: string) => void;
  saveError?: string | null;
}) {
  const [savingName, setSavingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  // Bumped every time a filter is actually applied (button, Enter, a saved
  // chip, or "Aplicar y guardar") -- used as part of each FilterSection's
  // `key` below so they remount collapsed, freeing up screen space for the
  // results list instead of staying expanded after the user is done picking.
  const [collapseSignal, setCollapseSignal] = useState(0);

  function applyAndCollapse() {
    setCollapseSignal((n) => n + 1);
    onApply();
  }

  function applySavedAndCollapse(entry: SavedFilterEntry) {
    setCollapseSignal((n) => n + 1);
    onApplySaved?.(entry);
  }

  function confirmSave() {
    const trimmed = nameDraft.trim();
    if (!trimmed || !onSaveCurrent) return;
    setCollapseSignal((n) => n + 1);
    onSaveCurrent(trimmed);
    setNameDraft("");
    setSavingName(false);
  }

  function toggleGenre(id: number) {
    onChange((f) => ({
      ...f,
      genreIds: f.genreIds.includes(id) ? f.genreIds.filter((g) => g !== id) : [...f.genreIds, id],
    }));
  }

  function toggleCountry(code: string) {
    onChange((f) => ({
      ...f,
      countries: f.countries.includes(code) ? f.countries.filter((c) => c !== code) : [...f.countries, code],
    }));
  }

  function toggleProvider(id: number) {
    onChange((f) => ({
      ...f,
      providerIds: f.providerIds.includes(id) ? f.providerIds.filter((p) => p !== id) : [...f.providerIds, id],
    }));
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      {showSearch && (
        <input
          type="search"
          value={filters.q}
          onChange={(e) => onChange((f) => ({ ...f, q: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyAndCollapse();
          }}
          placeholder="Buscar por nombre…"
          aria-label="Buscar por nombre"
          className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-neutral-500 focus:border-accent"
        />
      )}

      <h2 className="text-lg font-bold text-white">Filtros</h2>

      {savedFilters !== undefined && savedFilters.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted">Filtros guardados</label>
          <div className="flex flex-wrap gap-1.5">
            {savedFilters.map((sf) => {
              const active = sf.id === activeSavedFilterId;
              return (
                <span
                  key={sf.id}
                  className={`flex items-center gap-1 rounded-full border py-1 pr-1 pl-2.5 text-xs transition-colors ${
                    active ? "border-accent bg-accent text-white" : "border-white/15 text-neutral-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => applySavedAndCollapse(sf)}
                    className={active ? "" : "hover:text-white"}
                  >
                    {sf.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSaved?.(sf.id)}
                    aria-label={`Eliminar filtro guardado ${sf.name}`}
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                      active ? "text-white/70 hover:bg-white/20 hover:text-white" : "text-neutral-500 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {showType && (
        <div className="flex gap-2">
          {[
            { value: "" as const, label: "Todo" },
            { value: "MOVIE" as const, label: "Películas" },
            { value: "SERIES" as const, label: "Series" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => onChange((f) => ({ ...f, type: tab.value }))}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                filters.type === tab.value
                  ? "bg-accent text-white"
                  : "border border-white/15 text-neutral-300 hover:border-white/30"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <FilterSection key={`platforms-${collapseSignal}`} title="Plataformas, puntaje, popularidad y año">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted">Plataformas de streaming</label>
          {providers.length === 0 ? (
            <p className="text-xs text-muted">
              Configura tu país en tu perfil para filtrar por plataforma.
            </p>
          ) : (
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
              {providers.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={filters.providerIds.includes(p.id)}
                    onChange={() => toggleProvider(p.id)}
                    className="accent-[var(--accent)]"
                  />
                  {p.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <RangeInput
          label="Puntaje (TMDB, 0-10)"
          from={filters.scoreFrom}
          to={filters.scoreTo}
          step={0.5}
          min={0}
          max={10}
          onChange={(from, to) => onChange((f) => ({ ...f, scoreFrom: from, scoreTo: to }))}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted">Popularidad mínima (cantidad de votos)</label>
          <input
            type="number"
            min={0}
            value={filters.votesMin}
            placeholder="Ej: 500"
            onChange={(e) =>
              onChange((f) => ({ ...f, votesMin: e.target.value === "" ? "" : Number(e.target.value) }))
            }
            className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <RangeInput
          label="Año"
          from={filters.yearFrom}
          to={filters.yearTo}
          min={1900}
          max={2100}
          onChange={(from, to) => onChange((f) => ({ ...f, yearFrom: from, yearTo: to }))}
        />
      </FilterSection>

      <FilterSection key={`more-${collapseSignal}`} title="Más filtros">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted">Géneros</label>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
            {genres.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={filters.genreIds.includes(g.id)}
                  onChange={() => toggleGenre(g.id)}
                  className="accent-[var(--accent)]"
                />
                {g.name}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted">País</label>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
            {countries.map((c) => (
              <label key={c.code} className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={filters.countries.includes(c.code)}
                  onChange={() => toggleCountry(c.code)}
                  className="accent-[var(--accent)]"
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>

        <PersonAutocomplete
          label="Actor"
          placeholder="Buscar actor…"
          selected={filters.actor}
          onSelect={(p) => onChange((f) => ({ ...f, actor: p }))}
        />

        <PersonAutocomplete
          label="Director"
          placeholder="Buscar director…"
          selected={filters.director}
          onSelect={(p) => onChange((f) => ({ ...f, director: p }))}
        />

        <RangeInput
          label="Presupuesto (USD, solo películas)"
          from={filters.budgetFrom}
          to={filters.budgetTo}
          step={1_000_000}
          min={0}
          onChange={(from, to) => onChange((f) => ({ ...f, budgetFrom: from, budgetTo: to }))}
        />
      </FilterSection>

      {showSort && (
        <div className="flex flex-col gap-1.5 border-t border-white/10 pt-3">
          <label className="text-xs text-muted">Ordenar por</label>
          <select
            value={filters.sort}
            onChange={(e) => onChange((f) => ({ ...f, sort: e.target.value as SortOption }))}
            className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="popularity">Popularidad</option>
            <option value="year">Año (más nuevas primero)</option>
            <option value="score">Puntaje (TMDB)</option>
            <option value="votes">Cantidad de votos</option>
          </select>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={applyAndCollapse}
          className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
        >
          Aplicar filtros
        </button>
        <button
          onClick={onClear}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm text-neutral-300 hover:border-white/30 transition-colors"
        >
          Limpiar
        </button>
      </div>

      {onSaveCurrent && (
        <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
          {saveError && <p className="text-xs text-red-400">{saveError}</p>}
          {!savingName ? (
            <button
              type="button"
              onClick={() => setSavingName(true)}
              className="text-left text-xs font-medium text-accent-hover hover:underline"
            >
              + Guardar estos filtros
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmSave();
                }}
                placeholder="Nombre del filtro"
                maxLength={60}
                aria-label="Nombre del filtro guardado"
                className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmSave}
                  disabled={!nameDraft.trim()}
                  className="flex-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  Aplicar y guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSavingName(false);
                    setNameDraft("");
                  }}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-white/30"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
