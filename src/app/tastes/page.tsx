"use client";

import { useEffect, useState } from "react";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { WeightSelector } from "@/components/onboarding/WeightSelector";

interface Genre {
  id: number;
  name: string;
}
interface Country {
  code: string;
  name: string;
}
interface PersonRating {
  personId: string;
  score: number;
  isInferred: boolean;
  name: string;
  photoUrl: string | null;
  department: string | null;
}

const PERSON_LEVELS: { value: -1 | 0 | 1; label: string; aria: string }[] = [
  { value: -1, label: "👎", aria: "No me gusta" },
  { value: 0, label: "😐", aria: "Neutral" },
  { value: 1, label: "👍", aria: "Me gusta" },
];

// Everything onboarding and "vs" have ever inferred about your taste --
// genres, movies-vs-series, mainstream/indie, presupuesto, duración, actores
// y directores -- in one place, editable by hand. Nothing here is a black
// box: if the algorithm got something wrong, fix it directly instead of
// trying to "outvote" it with more picks.
export default function TastesPage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [genreWeights, setGenreWeights] = useState<Record<number, number>>({});
  const [countryWeights, setCountryWeights] = useState<Record<string, number>>({});
  const [typeWeights, setTypeWeights] = useState<Record<"MOVIE" | "SERIES", number>>({ MOVIE: 0, SERIES: 0 });
  const [audienceWeights, setAudienceWeights] = useState<Record<"MAINSTREAM" | "INDIE", number>>({
    MAINSTREAM: 0,
    INDIE: 0,
  });
  const [budgetWeights, setBudgetWeights] = useState<Record<"MEGA" | "SMALL", number>>({ MEGA: 0, SMALL: 0 });
  const [runtimeWeights, setRuntimeWeights] = useState<Record<"SHORT" | "MEDIUM" | "LONG", number>>({
    SHORT: 0,
    MEDIUM: 0,
    LONG: 0,
  });
  const [people, setPeople] = useState<PersonRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/preferences");
    const data = await res.json();
    setGenres(data.genres);
    setCountries(data.countries);
    setGenreWeights(
      Object.fromEntries(data.genrePreferences.map((g: { genreId: number; weight: number }) => [g.genreId, g.weight])),
    );
    setCountryWeights(
      Object.fromEntries(
        data.countryPreferences.map((c: { countryCode: string; weight: number }) => [c.countryCode, c.weight]),
      ),
    );
    setTypeWeights({
      MOVIE: data.typePreferences.find((t: { type: string }) => t.type === "MOVIE")?.weight ?? 0,
      SERIES: data.typePreferences.find((t: { type: string }) => t.type === "SERIES")?.weight ?? 0,
    });
    setAudienceWeights({
      MAINSTREAM: data.audiencePreferences.find((a: { tier: string }) => a.tier === "MAINSTREAM")?.weight ?? 0,
      INDIE: data.audiencePreferences.find((a: { tier: string }) => a.tier === "INDIE")?.weight ?? 0,
    });
    setBudgetWeights({
      MEGA: data.budgetPreferences.find((b: { tier: string }) => b.tier === "MEGA")?.weight ?? 0,
      SMALL: data.budgetPreferences.find((b: { tier: string }) => b.tier === "SMALL")?.weight ?? 0,
    });
    setRuntimeWeights({
      SHORT: data.runtimePreferences.find((r: { bucket: string }) => r.bucket === "SHORT")?.weight ?? 0,
      MEDIUM: data.runtimePreferences.find((r: { bucket: string }) => r.bucket === "MEDIUM")?.weight ?? 0,
      LONG: data.runtimePreferences.find((r: { bucket: string }) => r.bucket === "LONG")?.weight ?? 0,
    });
    setPeople(data.personRatings);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, []);

  async function saveGenre(genreId: number, weight: number) {
    setGenreWeights((prev) => ({ ...prev, [genreId]: weight }));
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genrePreferences: [{ genreId, weight }] }),
    });
  }

  async function saveCountry(countryCode: string, weight: number) {
    setCountryWeights((prev) => ({ ...prev, [countryCode]: weight }));
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryPreferences: [{ countryCode, weight }] }),
    });
  }

  async function saveType(type: "MOVIE" | "SERIES", weight: number) {
    setTypeWeights((prev) => ({ ...prev, [type]: weight }));
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typePreferences: [{ type, weight }] }),
    });
  }

  async function saveAudience(tier: "MAINSTREAM" | "INDIE", weight: number) {
    setAudienceWeights((prev) => ({ ...prev, [tier]: weight }));
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audiencePreferences: [{ tier, weight }] }),
    });
  }

  async function saveBudget(tier: "MEGA" | "SMALL", weight: number) {
    setBudgetWeights((prev) => ({ ...prev, [tier]: weight }));
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budgetPreferences: [{ tier, weight }] }),
    });
  }

  async function saveRuntime(bucket: "SHORT" | "MEDIUM" | "LONG", weight: number) {
    setRuntimeWeights((prev) => ({ ...prev, [bucket]: weight }));
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runtimePreferences: [{ bucket, weight }] }),
    });
  }

  async function savePerson(personId: string, score: -1 | 0 | 1) {
    setSavingId(personId);
    setPeople((prev) => prev.map((p) => (p.personId === personId ? { ...p, score, isInferred: false } : p)));
    await fetch("/api/people/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, score }),
    });
    setSavingId(null);
  }

  if (loading) {
    return <p className="px-4 py-16 text-center text-sm text-muted">Cargando…</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <BackToHomeLink />
      <div>
        <h1 className="text-2xl font-bold">Mis gustos</h1>
        <p className="mt-1 text-sm text-muted">
          Todo lo que aprendimos de tus calificaciones y de &quot;vs&quot; -- puedes corregir cualquier cosa a mano.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Películas o series</h2>
        <WeightSelector label="Películas" value={typeWeights.MOVIE} onChange={(v) => saveType("MOVIE", v)} />
        <WeightSelector label="Series" value={typeWeights.SERIES} onChange={(v) => saveType("SERIES", v)} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Géneros</h2>
        {genres.map((g) => (
          <WeightSelector
            key={g.id}
            label={g.name}
            value={genreWeights[g.id] ?? 0}
            onChange={(v) => saveGenre(g.id, v)}
          />
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Nacionalidad de las películas/series</h2>
        {countries.map((c) => (
          <WeightSelector
            key={c.code}
            label={c.name}
            value={countryWeights[c.code] ?? 0}
            onChange={(v) => saveCountry(c.code, v)}
          />
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Masivo o independiente</h2>
        <WeightSelector
          label="Producciones masivas"
          value={audienceWeights.MAINSTREAM}
          onChange={(v) => saveAudience("MAINSTREAM", v)}
        />
        <WeightSelector
          label="Producciones independientes"
          value={audienceWeights.INDIE}
          onChange={(v) => saveAudience("INDIE", v)}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Presupuesto (solo películas)</h2>
        <WeightSelector label="Megaproducciones" value={budgetWeights.MEGA} onChange={(v) => saveBudget("MEGA", v)} />
        <WeightSelector
          label="Bajo presupuesto"
          value={budgetWeights.SMALL}
          onChange={(v) => saveBudget("SMALL", v)}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Duración</h2>
        <WeightSelector label="Cortas" value={runtimeWeights.SHORT} onChange={(v) => saveRuntime("SHORT", v)} />
        <WeightSelector label="Duración media" value={runtimeWeights.MEDIUM} onChange={(v) => saveRuntime("MEDIUM", v)} />
        <WeightSelector label="Largas" value={runtimeWeights.LONG} onChange={(v) => saveRuntime("LONG", v)} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Actores y directores</h2>
        <p className="text-xs text-muted">
          Se marcan solos cuando calificas con 4-5★ varios títulos que comparten a la misma persona -- puedes
          corregir cualquiera a mano.
        </p>
        {people.length === 0 && (
          <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
            Todavía no tenemos señal sobre actores o directores. Va a ir sumando a medida que califiques títulos con
            4-5★.
          </p>
        )}
        {people.map((p) => (
          <div
            key={p.personId}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-black/40">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg">🎭</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-white">{p.name}</p>
                <p className="text-xs text-muted">
                  {p.department}
                  {p.isInferred && (p.department ? " · inferido" : "Inferido automáticamente")}
                </p>
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-1">
              {PERSON_LEVELS.map((l) => (
                <button
                  key={l.value}
                  disabled={savingId === p.personId}
                  onClick={() => savePerson(p.personId, l.value)}
                  aria-label={l.aria}
                  className={`rounded-full px-2 py-1 text-base transition-colors disabled:opacity-50 ${
                    p.score === l.value || (l.value === 1 && p.score >= 1) ? "bg-accent" : "hover:bg-surface-hover"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
