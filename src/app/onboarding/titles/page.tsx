"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { TitleCard, type OnboardingTitle } from "@/components/onboarding/TitleCard";
import { ProgressBar } from "@/components/ProgressBar";

const GOAL = 20; // suggested minimum ratings before moving on

export default function OnboardingTitlesPage() {
  const [titles, setTitles] = useState<OnboardingTitle[]>([]);
  const [progress, setProgress] = useState({ rated: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const loadBatch = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/onboarding/titles");
    const data = await res.json();
    setTitles(data.titles);
    setProgress(data.progress);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadBatch();
  }, [loadBatch]);

  function handleRated(titleId: string) {
    setTitles((prev) => prev.filter((t) => t.id !== titleId));
    setProgress((p) => ({ ...p, rated: p.rated + 1 }));
  }

  useEffect(() => {
    if (!loading && titles.length === 0 && progress.rated < progress.total) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch next batch once current one is exhausted
      loadBatch();
    }
  }, [loading, titles.length, progress, loadBatch]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">¿Viste estas películas y series?</h1>
        <p className="mt-1 text-sm text-muted">
          Marca si las viste y califícalas del 1 al 10. Cuantas más títulos califiques, mejores
          serán tus recomendaciones.
        </p>
      </div>

      <ProgressBar value={progress.rated} total={progress.total} label="Calificadas" />

      {progress.rated >= GOAL && (
        <Link
          href="/onboarding/actors"
          className="rounded-xl border border-white/15 bg-surface px-4 py-3 text-center text-sm font-medium text-white hover:border-white/30 transition-colors"
        >
          Ya califiqué suficientes → Seguir con actores y directores
        </Link>
      )}

      <div className="flex flex-col gap-3">
        {titles.map((t) => (
          <TitleCard key={t.id} title={t} onRated={handleRated} />
        ))}
        {!loading && titles.length === 0 && progress.rated >= progress.total && progress.total > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="mb-3 text-white">¡Calificaste todo el catálogo inicial! 🎉</p>
            <Link
              href="/onboarding/actors"
              className="inline-block rounded-md bg-accent px-6 py-2.5 font-bold text-white hover:bg-accent-hover transition-colors"
            >
              Seguir con actores y directores
            </Link>
          </div>
        )}
        {loading && <p className="text-center text-sm text-muted">Cargando…</p>}
      </div>
    </div>
  );
}
