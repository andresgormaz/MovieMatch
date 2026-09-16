"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Poster } from "@/components/Poster";
import { FavoritePicker } from "@/components/onboarding/FavoritePicker";
import { PairCompare } from "@/components/onboarding/PairCompare";

interface SamplePick {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  posterUrl: string | null;
  voteAverage: number | null;
}

type Phase = "loading" | "seed" | "compare" | "finishing";

// Total visible steps: 1 (favoritos) + N rondas de comparación. Used for the
// top-level progress indicator so there's a sense of "falta esto" from the
// very first screen, not just once the comparison rounds start.
function totalSteps(roundsTarget: number) {
  return 1 + roundsTarget;
}

export default function OnboardingTitlesPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [startingRound, setStartingRound] = useState(1);
  const [roundsTarget, setRoundsTarget] = useState(7);
  const [samplePick, setSamplePick] = useState<SamplePick | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/onboarding/progress");
      const data = await res.json();
      setRoundsTarget(data.roundsTarget);
      setStartingRound(Math.min(data.roundsCompleted + 1, data.roundsTarget));
      setSamplePick(data.samplePick ?? null);
      // hasStartedComparing (counts skipped rounds too) means the seed
      // phase was already left, picked or explicitly skipped -- resume
      // straight into compare instead of bouncing back to seed.
      if (data.roundsCompleted >= data.roundsTarget) {
        finishOnboarding();
      } else if (data.hasStartedComparing || (data.favoriteMovieDone && data.favoriteSeriesDone)) {
        setPhase("compare");
      } else {
        setPhase("seed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

  async function finishOnboarding() {
    setPhase("finishing");
    await fetch("/api/onboarding/complete", { method: "POST" });
    router.push("/dashboard");
  }

  if (phase === "loading" || phase === "finishing") {
    return <p className="px-4 py-16 text-center text-sm text-muted">Cargando…</p>;
  }

  if (phase === "seed") {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
        <div>
          <p className="text-xs font-medium text-muted">
            Paso 1 de {totalSteps(roundsTarget)}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-accent transition-all" style={{ width: `${100 / totalSteps(roundsTarget)}%` }} />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Cuéntanos qué te gusta</h1>
          <p className="mt-1 text-sm text-muted">
            Elige una película y una serie que te encanten. Con eso ya empezamos a entender tu gusto — el resto
            es opcional.
          </p>
        </div>

        {samplePick && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
            <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg">
              <Poster name={samplePick.name} type={samplePick.type} posterUrl={samplePick.posterUrl} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted">Así se van a ver tus recomendaciones</p>
              <p className="truncate text-sm font-semibold text-white">
                {samplePick.name} {samplePick.releaseYear ? `(${samplePick.releaseYear})` : ""}
              </p>
              {samplePick.voteAverage != null && (
                <p className="text-xs text-neutral-400">★ {samplePick.voteAverage.toFixed(1)} TMDB</p>
              )}
            </div>
          </div>
        )}

        <FavoritePicker label="Una película favorita" type="MOVIE" />
        <FavoritePicker label="Una serie favorita" type="SERIES" />
        <button
          onClick={() => setPhase("compare")}
          className="rounded-xl bg-accent px-6 py-3.5 text-center font-bold text-white hover:bg-accent-hover transition-colors"
        >
          Continuar →
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">¿Cuál te gusta más?</h1>
        <p className="mt-1 text-sm text-muted">Elige la que más te guste entre las que ya viste.</p>
      </div>

      <PairCompare
        unlimited={false}
        roundsTarget={roundsTarget}
        startingRound={startingRound}
        onExhausted={finishOnboarding}
      />
    </div>
  );
}
