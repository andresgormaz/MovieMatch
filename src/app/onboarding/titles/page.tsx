"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Poster } from "@/components/Poster";
import { FavoritePicker } from "@/components/onboarding/FavoritePicker";

interface PairTitle {
  id: string;
  name: string;
  releaseYear: number | null;
  posterUrl: string | null;
  type: "MOVIE" | "SERIES";
}

type Phase = "loading" | "seed" | "compare" | "finishing";

export default function OnboardingTitlesPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [round, setRound] = useState(1);
  const [roundsTarget, setRoundsTarget] = useState(7);
  const [pair, setPair] = useState<{ titleA: PairTitle; titleB: PairTitle } | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/onboarding/progress");
      const data = await res.json();
      setRoundsTarget(data.roundsTarget);
      setRound(Math.min(data.roundsCompleted + 1, data.roundsTarget));
      // roundsCompleted > 0 means at least one pairwise round already
      // happened, which only occurs after the seed phase was left (picked
      // or explicitly skipped) -- resume straight into compare instead of
      // bouncing back to seed just because favorites were skipped.
      if (data.roundsCompleted >= data.roundsTarget) {
        finishOnboarding();
      } else if (data.roundsCompleted > 0 || (data.favoriteMovieDone && data.favoriteSeriesDone)) {
        setPhase("compare");
        loadPair([]);
      } else {
        setPhase("seed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

  async function loadPair(excludeIds: string[]) {
    setError(null);
    const params = excludeIds.length ? `?exclude=${excludeIds.join(",")}` : "";
    const res = await fetch(`/api/onboarding/pair${params}`);
    const data = await res.json();
    if (data.done || !data.pair) {
      finishOnboarding();
      return;
    }
    setPair(data.pair);
  }

  async function finishOnboarding() {
    setPhase("finishing");
    await fetch("/api/onboarding/complete", { method: "POST" });
    router.push("/recommendations");
  }

  async function choose(winnerId: string) {
    if (!pair || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleAId: pair.titleA.id, titleBId: pair.titleB.id, winnerId }),
      });
      if (!res.ok) throw new Error("failed");
      const nextRound = round + 1;
      if (nextRound > roundsTarget) {
        finishOnboarding();
        return;
      }
      setRound(nextRound);
      setExcluded([]);
      setPair(null);
      await loadPair([]);
    } catch {
      setError("No se pudo guardar tu elección. Probá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  function skipPair() {
    if (!pair || submitting) return;
    const nextExcluded = [...excluded, pair.titleA.id, pair.titleB.id];
    setExcluded(nextExcluded);
    setPair(null);
    loadPair(nextExcluded);
  }

  if (phase === "loading" || phase === "finishing") {
    return <p className="px-4 py-16 text-center text-sm text-muted">Cargando…</p>;
  }

  if (phase === "seed") {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
        <div>
          <h1 className="text-2xl font-bold">Contanos qué te gusta</h1>
          <p className="mt-1 text-sm text-muted">
            Elegí una película y una serie que te encanten. Con eso ya empezamos a entender tu gusto — el resto
            es opcional.
          </p>
        </div>
        <FavoritePicker label="Una película favorita" type="MOVIE" />
        <FavoritePicker label="Una serie favorita" type="SERIES" />
        <button
          onClick={() => {
            setPhase("compare");
            loadPair([]);
          }}
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
        <p className="mt-1 text-sm text-muted">Elegí la que más te guste. Ronda {round} de {roundsTarget}.</p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${Math.min(100, ((round - 1) / roundsTarget) * 100)}%` }}
          />
        </div>
      </div>

      {pair ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <PairOption title={pair.titleA} disabled={submitting} onChoose={() => choose(pair.titleA.id)} />
          <PairOption title={pair.titleB} disabled={submitting} onChoose={() => choose(pair.titleB.id)} />
        </div>
      ) : (
        <p className="text-center text-sm text-muted">Cargando…</p>
      )}

      {error && <p className="text-center text-xs text-red-400">{error}</p>}

      <button
        onClick={skipPair}
        disabled={submitting || !pair}
        className="mx-auto text-sm text-muted hover:text-white transition-colors disabled:opacity-50"
      >
        No vi ninguna de las dos
      </button>
    </div>
  );
}

function PairOption({
  title,
  onChoose,
  disabled,
}: {
  title: PairTitle;
  onChoose: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onChoose}
      disabled={disabled}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface text-left transition-colors hover:border-accent disabled:opacity-60"
    >
      <div className="aspect-[2/3] w-full">
        <Poster name={title.name} type={title.type} posterUrl={title.posterUrl} />
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-semibold text-white group-hover:underline" title={title.name}>
          {title.name}
        </p>
        <p className="text-xs text-muted">
          {title.type === "MOVIE" ? "Película" : "Serie"}
          {title.releaseYear ? ` · ${title.releaseYear}` : ""}
        </p>
      </div>
    </button>
  );
}
