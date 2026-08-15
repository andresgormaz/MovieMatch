"use client";

import { useCallback, useEffect, useState } from "react";
import { ExploreCard, type ExploreTitle } from "@/components/explore/ExploreCard";
import { RangeInput } from "@/components/explore/RangeInput";
import { PersonAutocomplete } from "@/components/explore/PersonAutocomplete";

interface Genre {
  id: number;
  name: string;
}
interface Country {
  code: string;
  name: string;
}
interface PersonOption {
  id: string;
  name: string;
  photoUrl: string | null;
}

type Filters = {
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
  sort: "popularity" | "year" | "score" | "votes";
};

const EMPTY_FILTERS: Filters = {
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

function buildQuery(filters: Filters, page: number) {
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
  params.set("sort", filters.sort);
  params.set("page", String(page));
  return params.toString();
}

export default function ExplorePage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [titles, setTitles] = useState<ExploreTitle[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [genresRes, countriesRes] = await Promise.all([fetch("/api/genres"), fetch("/api/countries")]);
      setGenres((await genresRes.json()).genres);
      setCountries((await countriesRes.json()).countries);
    })();
  }, []);

  const runSearch = useCallback(async (f: Filters, p: number, append: boolean) => {
    setLoading(true);
    const res = await fetch(`/api/catalog?${buildQuery(f, p)}`);
    const data = await res.json();
    setTitles((prev) => (append ? [...prev, ...data.titles] : data.titles));
    setTotalPages(data.totalPages);
    setTotal(data.total);
    setPage(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial results load on mount
    runSearch(EMPTY_FILTERS, 1, false);
  }, [runSearch]);

  function toggleGenre(id: number) {
    setFilters((f) => ({
      ...f,
      genreIds: f.genreIds.includes(id) ? f.genreIds.filter((g) => g !== id) : [...f.genreIds, id],
    }));
  }

  function toggleCountry(code: string) {
    setFilters((f) => ({
      ...f,
      countries: f.countries.includes(code) ? f.countries.filter((c) => c !== code) : [...f.countries, code],
    }));
  }

  function applyFilters() {
    runSearch(filters, 1, false);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    runSearch(EMPTY_FILTERS, 1, false);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:flex-row">
      <aside className="flex-shrink-0 lg:w-72">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-20">
          <h2 className="text-lg font-bold text-white">Filtros</h2>

          <div className="flex gap-2">
            {[
              { value: "" as const, label: "Todo" },
              { value: "MOVIE" as const, label: "Películas" },
              { value: "SERIES" as const, label: "Series" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilters((f) => ({ ...f, type: tab.value }))}
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

          <RangeInput
            label="Año"
            from={filters.yearFrom}
            to={filters.yearTo}
            min={1900}
            max={2100}
            onChange={(from, to) => setFilters((f) => ({ ...f, yearFrom: from, yearTo: to }))}
          />

          <RangeInput
            label="Puntaje (0-10)"
            from={filters.scoreFrom}
            to={filters.scoreTo}
            step={0.5}
            min={0}
            max={10}
            onChange={(from, to) => setFilters((f) => ({ ...f, scoreFrom: from, scoreTo: to }))}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted">Popularidad mínima (cantidad de votos)</label>
            <input
              type="number"
              min={0}
              value={filters.votesMin}
              placeholder="Ej: 500"
              onChange={(e) =>
                setFilters((f) => ({ ...f, votesMin: e.target.value === "" ? "" : Number(e.target.value) }))
              }
              className="rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <RangeInput
            label="Presupuesto (USD, solo películas)"
            from={filters.budgetFrom}
            to={filters.budgetTo}
            step={1_000_000}
            min={0}
            onChange={(from, to) => setFilters((f) => ({ ...f, budgetFrom: from, budgetTo: to }))}
          />

          <PersonAutocomplete
            label="Actor"
            placeholder="Buscar actor…"
            selected={filters.actor}
            onSelect={(p) => setFilters((f) => ({ ...f, actor: p }))}
          />

          <PersonAutocomplete
            label="Director"
            placeholder="Buscar director…"
            selected={filters.director}
            onSelect={(p) => setFilters((f) => ({ ...f, director: p }))}
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

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted">Ordenar por</label>
            <select
              value={filters.sort}
              onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as Filters["sort"] }))}
              className="rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="popularity">Popularidad</option>
              <option value="year">Año (más nuevas primero)</option>
              <option value="score">Puntaje</option>
              <option value="votes">Cantidad de votos</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={applyFilters}
              className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
            >
              Aplicar filtros
            </button>
            <button
              onClick={clearFilters}
              className="rounded-md border border-white/15 px-3 py-2 text-sm text-neutral-300 hover:border-white/30 transition-colors"
            >
              Limpiar
            </button>
          </div>
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
  );
}
