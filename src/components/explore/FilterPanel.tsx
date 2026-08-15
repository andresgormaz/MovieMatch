"use client";

import { RangeInput } from "@/components/explore/RangeInput";
import { PersonAutocomplete } from "@/components/explore/PersonAutocomplete";

export interface PersonOption {
  id: string;
  name: string;
  photoUrl: string | null;
}

export interface Genre {
  id: number;
  name: string;
}
export interface Country {
  code: string;
  name: string;
}

export type SortOption = "popularity" | "year" | "score" | "votes";

export interface CatalogFilters {
  type: "" | "MOVIE" | "SERIES";
  yearFrom: number | "";
  yearTo: number | "";
  scoreFrom: number | "";
  scoreTo: number | "";
  votesMin: number | "";
  budgetFrom: number | "";
  budgetTo: number | "";
  genreIds: number[];
  countries: string[];
  actor: PersonOption | null;
  director: PersonOption | null;
  sort: SortOption;
}

export const EMPTY_CATALOG_FILTERS: CatalogFilters = {
  type: "",
  yearFrom: "",
  yearTo: "",
  scoreFrom: "",
  scoreTo: "",
  votesMin: "",
  budgetFrom: "",
  budgetTo: "",
  genreIds: [],
  countries: [],
  actor: null,
  director: null,
  sort: "popularity",
};

export function buildCatalogQuery(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.yearFrom !== "") params.set("yearFrom", String(filters.yearFrom));
  if (filters.yearTo !== "") params.set("yearTo", String(filters.yearTo));
  if (filters.scoreFrom !== "") params.set("scoreFrom", String(filters.scoreFrom));
  if (filters.scoreTo !== "") params.set("scoreTo", String(filters.scoreTo));
  if (filters.votesMin !== "") params.set("votesMin", String(filters.votesMin));
  if (filters.budgetFrom !== "") params.set("budgetFrom", String(filters.budgetFrom));
  if (filters.budgetTo !== "") params.set("budgetTo", String(filters.budgetTo));
  if (filters.genreIds.length) params.set("genreIds", filters.genreIds.join(","));
  if (filters.countries.length) params.set("countries", filters.countries.join(","));
  if (filters.actor) params.set("actorId", filters.actor.id);
  if (filters.director) params.set("directorId", filters.director.id);
  return params;
}

export function FilterPanel({
  filters,
  onChange,
  genres,
  countries,
  onApply,
  onClear,
  showSort = false,
  showType = true,
}: {
  filters: CatalogFilters;
  onChange: (updater: (prev: CatalogFilters) => CatalogFilters) => void;
  genres: Genre[];
  countries: Country[];
  onApply: () => void;
  onClear: () => void;
  showSort?: boolean;
  showType?: boolean;
}) {
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

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-lg font-bold text-white">Filtros</h2>

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
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
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

      <RangeInput
        label="Año"
        from={filters.yearFrom}
        to={filters.yearTo}
        min={1900}
        max={2100}
        onChange={(from, to) => onChange((f) => ({ ...f, yearFrom: from, yearTo: to }))}
      />

      <RangeInput
        label="Puntaje (0-10)"
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
          onChange={(e) => onChange((f) => ({ ...f, votesMin: e.target.value === "" ? "" : Number(e.target.value) }))}
          className="rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <RangeInput
        label="Presupuesto (USD, solo películas)"
        from={filters.budgetFrom}
        to={filters.budgetTo}
        step={1_000_000}
        min={0}
        onChange={(from, to) => onChange((f) => ({ ...f, budgetFrom: from, budgetTo: to }))}
      />

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

      {showSort && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted">Ordenar por</label>
          <select
            value={filters.sort}
            onChange={(e) => onChange((f) => ({ ...f, sort: e.target.value as SortOption }))}
            className="rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="popularity">Popularidad</option>
            <option value="year">Año (más nuevas primero)</option>
            <option value="score">Puntaje</option>
            <option value="votes">Cantidad de votos</option>
          </select>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onApply}
          className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
        >
          Aplicar filtros
        </button>
        <button
          onClick={onClear}
          className="rounded-md border border-white/15 px-3 py-2 text-sm text-neutral-300 hover:border-white/30 transition-colors"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}
