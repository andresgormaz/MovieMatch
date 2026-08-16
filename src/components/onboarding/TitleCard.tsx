"use client";

import { useState } from "react";
import { Poster } from "@/components/Poster";

export interface OnboardingTitle {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  overview: string | null;
  posterUrl: string | null;
  genres: string[];
  directors: string[];
}

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function TitleCard({
  title,
  onRated,
}: {
  title: OnboardingTitle;
  onRated: (titleId: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [error, setError] = useState(false);

  async function rate(seen: boolean, score: number | null) {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch("/api/titles/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId: title.id, seen, score }),
      });
      if (!res.ok) throw new Error("rate failed");
      onRated(title.id);
    } catch {
      setError(true);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex gap-4 p-4">
        <div className="h-36 w-24 flex-shrink-0 overflow-hidden rounded-lg shadow-lg shadow-black/40">
          <Poster name={title.name} type={title.type} posterUrl={title.posterUrl} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-white">
            {title.name} {title.releaseYear ? <span className="text-neutral-500">({title.releaseYear})</span> : null}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {title.type === "MOVIE" ? "Película" : "Serie"}
            {title.directors.length ? ` · ${title.directors.join(", ")}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">{title.genres.join(" · ")}</p>
          {error && <p className="mt-1 text-xs text-red-400">No se pudo guardar. Probá de nuevo.</p>}
        </div>
      </div>

      {!showScores ? (
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
          <button
            disabled={submitting}
            onClick={() => rate(false, null)}
            className="py-3 text-sm font-medium text-neutral-400 hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            No la vi
          </button>
          <button
            disabled={submitting}
            onClick={() => setShowScores(true)}
            className="py-3 text-sm font-bold text-white hover:bg-accent transition-colors disabled:opacity-50"
          >
            La vi ✓
          </button>
        </div>
      ) : (
        <div className="border-t border-border p-3">
          <p className="mb-2 text-center text-xs text-muted">¿Qué tan buena te pareció? (1-10)</p>
          <div className="grid grid-cols-5 gap-1.5">
            {SCORES.map((s) => (
              <button
                key={s}
                disabled={submitting}
                onClick={() => rate(true, s)}
                className="rounded-md border border-white/15 py-2 text-sm font-medium hover:border-accent hover:bg-accent transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
