"use client";

import { useEffect, useState } from "react";
import { Poster } from "@/components/Poster";

interface PairTitle {
  id: string;
  name: string;
  releaseYear: number | null;
  posterUrl: string | null;
  type: "MOVIE" | "SERIES";
}

// The comparison mechanic itself -- shared by the first-time onboarding
// flow (fixed round target) and the ongoing /vs page (no target, just keeps
// going). Picking a winner only makes sense once both sides are actually
// seen, so each option has its own "No la he visto" to swap just that one
// out, plus a bulk "No vi ninguna de las dos" when neither rings a bell --
// both keep the round from ending on an unfair guess.
export function PairCompare({
  unlimited,
  roundsTarget,
  startingRound = 1,
  onRoundComplete,
  onExhausted,
}: {
  unlimited: boolean;
  roundsTarget?: number;
  startingRound?: number;
  onRoundComplete?: (round: number) => void;
  onExhausted: () => void;
}) {
  const [round, setRound] = useState(startingRound);
  const [pair, setPair] = useState<{ titleA: PairTitle; titleB: PairTitle } | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPair(keepId?: string) {
    setError(null);
    setPair(undefined);
    try {
      const params = new URLSearchParams();
      if (unlimited) params.set("unlimited", "1");
      if (keepId) params.set("keep", keepId);
      const res = await fetch(`/api/onboarding/pair?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      if (data.done || !data.pair) {
        setPair(null);
        onExhausted();
        return;
      }
      setPair(data.pair);
    } catch {
      // Leave pair as undefined -- the render branch below shows a retry
      // button instead of getting stuck on "Cargando..." forever.
      setError("No se pudo cargar la siguiente comparación. Inténtalo de nuevo.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    loadPair();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

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
      onRoundComplete?.(nextRound);
      if (!unlimited && roundsTarget && nextRound > roundsTarget) {
        setPair(null);
        onExhausted();
        return;
      }
      setRound(nextRound);
      await loadPair();
    } catch {
      setError("No se pudo guardar tu elección. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function notSeen(titleId: string, keepId: string) {
    if (!pair || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleAId: pair.titleA.id, titleBId: pair.titleB.id, notSeenId: titleId }),
      });
      if (!res.ok) throw new Error("failed");
      await loadPair(keepId);
    } catch {
      setError("No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function notSeenBoth() {
    if (!pair || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleAId: pair.titleA.id, titleBId: pair.titleB.id, bothNotSeen: true }),
      });
      if (!res.ok) throw new Error("failed");
      await loadPair();
    } catch {
      setError("No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pair === undefined) {
    if (error) {
      return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => loadPair()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return <p className="text-center text-sm text-muted">Cargando…</p>;
  }
  if (pair === null) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {roundsTarget && (
        <div>
          <p className="text-sm text-muted">
            Ronda {round} de {roundsTarget}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${Math.min(100, ((round - 1) / roundsTarget) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <PairOption
          title={pair.titleA}
          disabled={submitting}
          onChoose={() => choose(pair.titleA.id)}
          onNotSeen={() => notSeen(pair.titleA.id, pair.titleB.id)}
        />
        <PairOption
          title={pair.titleB}
          disabled={submitting}
          onChoose={() => choose(pair.titleB.id)}
          onNotSeen={() => notSeen(pair.titleB.id, pair.titleA.id)}
        />
      </div>

      <button
        onClick={notSeenBoth}
        disabled={submitting}
        className="mx-auto text-sm text-muted transition-colors hover:text-white disabled:opacity-50"
      >
        No vi ninguna de las dos
      </button>

      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}

function PairOption({
  title,
  onChoose,
  onNotSeen,
  disabled,
}: {
  title: PairTitle;
  onChoose: () => void;
  onNotSeen: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <button
        onClick={onChoose}
        disabled={disabled}
        className="group flex flex-col text-left transition-colors hover:border-accent disabled:opacity-60"
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
      <button
        onClick={onNotSeen}
        disabled={disabled}
        className="border-t border-border py-1.5 text-center text-xs text-muted transition-colors hover:text-white disabled:opacity-50"
      >
        No la he visto
      </button>
    </div>
  );
}
