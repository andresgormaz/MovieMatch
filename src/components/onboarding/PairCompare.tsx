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

type Slot = "A" | "B";
type Pair = { titleA: PairTitle; titleB: PairTitle };

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
  const [pair, setPair] = useState<Pair | null | undefined>(undefined);
  // Which slot(s) are mid-swap -- lets the two cards stay mounted and keep
  // their layout, showing a loading overlay only on the one(s) actually
  // changing, instead of blanking the whole comparison and popping in a
  // brand new one every time (jarring on a single "no la he visto" swap).
  const [loadingSlot, setLoadingSlot] = useState<Slot | "both" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = loadingSlot !== null;

  async function fetchPair(keepId?: string): Promise<Pair | null> {
    const params = new URLSearchParams();
    if (unlimited) params.set("unlimited", "1");
    if (keepId) params.set("keep", keepId);
    const res = await fetch(`/api/onboarding/pair?${params.toString()}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data.done || !data.pair ? null : data.pair;
  }

  async function loadInitialPair() {
    setError(null);
    setPair(undefined);
    try {
      const next = await fetchPair();
      if (!next) {
        setPair(null);
        onExhausted();
        return;
      }
      setPair(next);
    } catch (err) {
      // Leave pair as undefined -- the render branch below shows a retry
      // button instead of getting stuck on "Cargando..." forever. Surface
      // the real reason (visible in the UI) instead of a generic message,
      // since this has to be diagnosable from a phone with no devtools.
      const detail = err instanceof Error ? err.message : String(err);
      setError(`No se pudo cargar la siguiente comparación (${detail}). Inténtalo de nuevo.`);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    loadInitialPair();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

  async function choose(winnerId: string) {
    if (!pair || busy) return;
    setLoadingSlot("both");
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
      const next = await fetchPair();
      if (!next) {
        setPair(null);
        onExhausted();
        return;
      }
      setRound(nextRound);
      setPair(next);
    } catch {
      setError("No se pudo guardar tu elección. Inténtalo de nuevo.");
    } finally {
      setLoadingSlot(null);
    }
  }

  async function notSeen(slot: Slot) {
    if (!pair || busy) return;
    const changed = pair[slot === "A" ? "titleA" : "titleB"];
    const kept = pair[slot === "A" ? "titleB" : "titleA"];
    setLoadingSlot(slot);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleAId: pair.titleA.id, titleBId: pair.titleB.id, notSeenId: changed.id }),
      });
      if (!res.ok) throw new Error("failed");
      const next = await fetchPair(kept.id);
      if (!next) {
        setPair(null);
        onExhausted();
        return;
      }
      // pickNextPair's "keep" path always returns the fresh replacement as
      // titleA and the fixed title as titleB -- drop the replacement into
      // whichever slot actually changed and keep our own copy of the other
      // slot, so that card's object identity never changes and it doesn't
      // re-render.
      setPair(slot === "A" ? { titleA: next.titleA, titleB: kept } : { titleA: kept, titleB: next.titleA });
    } catch {
      setError("No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setLoadingSlot(null);
    }
  }

  async function notSeenBoth() {
    if (!pair || busy) return;
    setLoadingSlot("both");
    setError(null);
    try {
      const res = await fetch("/api/onboarding/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleAId: pair.titleA.id, titleBId: pair.titleB.id, bothNotSeen: true }),
      });
      if (!res.ok) throw new Error("failed");
      const next = await fetchPair();
      if (!next) {
        setPair(null);
        onExhausted();
        return;
      }
      setPair(next);
    } catch {
      setError("No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setLoadingSlot(null);
    }
  }

  if (pair === undefined) {
    if (error) {
      return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="whitespace-pre-wrap break-words text-left text-xs text-red-400">{error}</p>
          <button
            onClick={loadInitialPair}
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
          disabled={busy}
          loading={loadingSlot === "A" || loadingSlot === "both"}
          onChoose={() => choose(pair.titleA.id)}
          onNotSeen={() => notSeen("A")}
        />
        <PairOption
          title={pair.titleB}
          disabled={busy}
          loading={loadingSlot === "B" || loadingSlot === "both"}
          onChoose={() => choose(pair.titleB.id)}
          onNotSeen={() => notSeen("B")}
        />
      </div>

      <button
        onClick={notSeenBoth}
        disabled={busy}
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
  loading,
}: {
  title: PairTitle;
  onChoose: () => void;
  onNotSeen: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className={`flex flex-col transition-opacity duration-200 ${loading ? "opacity-40" : "opacity-100"}`}>
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
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}
    </div>
  );
}
