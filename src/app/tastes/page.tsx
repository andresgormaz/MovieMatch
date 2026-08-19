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
  score: -1 | 0 | 1;
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
// genres, movies-vs-series, actors and directors -- in one place, editable
// by hand. Nothing here is a black box: if the algorithm got something
// wrong, fix it directly instead of trying to "outvote" it with more picks.
export default function TastesPage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [genreWeights, setGenreWeights] = useState<Record<number, number>>({});
  const [countryWeights, setCountryWeights] = useState<Record<string, number>>({});
  const [typeWeights, setTypeWeights] = useState<Record<"MOVIE" | "SERIES", number>>({ MOVIE: 0, SERIES: 0 });
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

  async function savePerson(personId: string, score: -1 | 0 | 1) {
    setSavingId(personId);
    setPeople((prev) => prev.map((p) => (p.personId === personId ? { ...p, score } : p)));
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
        <h2 className="text-sm font-semibold text-muted">Actores y directores</h2>
        {people.length === 0 && (
          <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
            Todavía no tenemos señal sobre actores o directores. Va a ir sumando a medida que califiques títulos.
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
                {p.department && <p className="text-xs text-muted">{p.department}</p>}
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
                    p.score === l.value ? "bg-accent" : "hover:bg-surface-hover"
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
