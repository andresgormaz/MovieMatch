"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PersonCard, type OnboardingPerson } from "@/components/onboarding/PersonCard";
import { ProgressBar } from "@/components/ProgressBar";

const GOAL = 15;

export default function OnboardingActorsPage() {
  const [people, setPeople] = useState<OnboardingPerson[]>([]);
  const [rated, setRated] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadBatch = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/onboarding/people");
    const data = await res.json();
    setPeople(data.people);
    setRated(data.progress.rated);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadBatch();
  }, [loadBatch]);

  function handleRated(personId: string) {
    setPeople((prev) => prev.filter((p) => p.id !== personId));
    setRated((r) => r + 1);
  }

  useEffect(() => {
    if (!loading && people.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch next batch once current one is exhausted
      loadBatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, people.length]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">¿Qué actores y directores te gustan?</h1>
        <p className="mt-1 text-sm text-muted">
          Priorizamos gente que sale en títulos que ya viste. Califica los que reconozcas.
        </p>
      </div>

      <ProgressBar value={rated} total={GOAL} label="Calificados" />

      {rated >= GOAL && (
        <Link
          href="/onboarding/preferences"
          className="rounded-xl border border-white/15 bg-surface px-4 py-3 text-center text-sm font-medium text-white hover:border-white/30 transition-colors"
        >
          Ya califiqué suficientes → Últimas preguntas
        </Link>
      )}

      <div className="flex flex-col gap-3">
        {people.map((p) => (
          <PersonCard key={p.id} person={p} onRated={handleRated} />
        ))}
        {loading && <p className="text-center text-sm text-muted">Cargando…</p>}
      </div>

      <Link href="/onboarding/preferences" className="text-center text-sm text-muted underline">
        Saltar este paso
      </Link>
    </div>
  );
}
