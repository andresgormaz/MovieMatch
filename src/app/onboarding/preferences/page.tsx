"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WeightSelector } from "@/components/onboarding/WeightSelector";

interface Genre {
  id: number;
  name: string;
}
interface Country {
  code: string;
  name: string;
}

export default function OnboardingPreferencesPage() {
  const router = useRouter();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [genreWeights, setGenreWeights] = useState<Record<number, number>>({});
  const [countryWeights, setCountryWeights] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
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
      setLoading(false);
    })();
  }, []);

  async function handleFinish() {
    setSaving(true);
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        genrePreferences: Object.entries(genreWeights).map(([genreId, weight]) => ({
          genreId: Number(genreId),
          weight,
        })),
        countryPreferences: Object.entries(countryWeights).map(([countryCode, weight]) => ({
          countryCode,
          weight,
        })),
      }),
    });
    await fetch("/api/onboarding/complete", { method: "POST" });
    router.push("/recommendations");
  }

  if (loading) {
    return <p className="px-4 py-8 text-center text-sm text-muted">Cargando…</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Últimas preguntas</h1>
        <p className="mt-1 text-sm text-muted">
          Cuéntanos qué géneros y qué cines te gustan más. Puedes dejar en neutral los que no te
          importan.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Géneros</h2>
        {genres.map((g) => (
          <WeightSelector
            key={g.id}
            label={g.name}
            value={genreWeights[g.id] ?? 0}
            onChange={(v) => setGenreWeights((prev) => ({ ...prev, [g.id]: v }))}
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
            onChange={(v) => setCountryWeights((prev) => ({ ...prev, [c.code]: v }))}
          />
        ))}
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <button
            onClick={handleFinish}
            disabled={saving}
            className="w-full rounded-md bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Ver mis recomendaciones →"}
          </button>
        </div>
      </div>
    </div>
  );
}
