"use client";

import { useState } from "react";
import Link from "next/link";
import { Poster } from "@/components/Poster";
import { StarRating } from "@/components/StarRating";
import { SeriesWatchProgressPicker } from "@/components/SeriesWatchProgressPicker";
import type { WatchProgress } from "@/lib/seriesStatus";

export interface SeenUnratedItem {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  posterUrl: string | null;
}

// The list feeding this comes from VS comparisons marking both sides
// "seen" without a score -- this is where that gap actually gets closed.
export function RateSeenList({ initialItems }: { initialItems: SeenUnratedItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  // Which score was just tapped, kept lit in gold for a beat before the
  // card disappears -- confirms the right number of stars registered
  // instead of the card vanishing the instant you tap.
  const [confirmedScore, setConfirmedScore] = useState<{ id: string; score: number } | null>(null);
  // Series-only, keyed by titleId: must be picked before that series can be
  // marked seen. A "vs" win records seen=true without asking this, so it's
  // always unset here -- this is exactly where it gets backfilled.
  const [watchProgressById, setWatchProgressById] = useState<Record<string, WatchProgress>>({});

  async function rate(titleId: string, score: number, watchProgress: WatchProgress | null) {
    if (submittingId) return;
    setSubmittingId(titleId);
    setErrorId(null);
    setConfirmedScore({ id: titleId, score });
    try {
      const res = await fetch("/api/titles/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId, seen: true, score, watchProgress }),
      });
      if (!res.ok) throw new Error("rate failed");
      await new Promise((resolve) => setTimeout(resolve, 550));
      setItems((prev) => prev.filter((i) => i.id !== titleId));
    } catch {
      setErrorId(titleId);
      setConfirmedScore(null);
    } finally {
      setSubmittingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
        No tienes nada pendiente de calificar. Todo lo que marcaste como visto ya tiene tu nota.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
          <Link href={`/title/${item.id}`} className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg">
            <Poster name={item.name} type={item.type} posterUrl={item.posterUrl} />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/title/${item.id}`} className="hover:underline">
              <p className="truncate text-sm font-semibold text-white">{item.name}</p>
            </Link>
            <p className="text-xs text-muted">
              {item.type === "MOVIE" ? "Película" : "Serie"}
              {item.releaseYear ? ` · ${item.releaseYear}` : ""}
            </p>
            {errorId === item.id && <p className="mt-1 text-xs text-red-400">No se pudo guardar. Inténtalo de nuevo.</p>}
            <div className="mt-2">
              {item.type === "SERIES" && !watchProgressById[item.id] ? (
                <SeriesWatchProgressPicker
                  disabled={submittingId === item.id}
                  onPick={(v) => setWatchProgressById((prev) => ({ ...prev, [item.id]: v }))}
                />
              ) : (
                <StarRating
                  size="sm"
                  disabled={submittingId === item.id}
                  selected={confirmedScore?.id === item.id ? confirmedScore.score : undefined}
                  onRate={(s) => rate(item.id, s, watchProgressById[item.id] ?? null)}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
