"use client";

import { useState } from "react";
import { Poster } from "@/components/Poster";

export interface Recommendation {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  overview: string | null;
  posterUrl: string | null;
  genres: string[];
  directors: string[];
  matchPercent: number;
  reasons: string[];
}

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function RecommendationCard({
  rec,
  onRated,
}: {
  rec: Recommendation;
  onRated: (titleId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function rate(seen: boolean, score: number | null) {
    if (submitting) return;
    setSubmitting(true);
    await fetch("/api/titles/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titleId: rec.id, seen, score }),
    });
    onRated(rec.id);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex gap-4 p-4">
        <div className="h-40 w-28 flex-shrink-0 overflow-hidden rounded-lg shadow-lg shadow-black/40">
          <Poster name={rec.name} type={rec.type} posterUrl={rec.posterUrl} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-xs font-bold text-green-400">
              {rec.matchPercent}% match
            </span>
          </div>
          <h3 className="font-semibold text-white">
            {rec.name} {rec.releaseYear ? <span className="text-neutral-500">({rec.releaseYear})</span> : null}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {rec.type === "MOVIE" ? "Película" : "Serie"}
            {rec.directors.length ? ` · ${rec.directors.join(", ")}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">{rec.genres.join(" · ")}</p>
          {rec.reasons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {rec.reasons.map((r, i) => (
                <span key={i} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-neutral-300">
                  {r}
                </span>
              ))}
            </div>
          )}
          {rec.overview && (
            <p className="mt-2 line-clamp-2 text-xs text-muted">{rec.overview}</p>
          )}
        </div>
      </div>

      {!expanded ? (
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
          <button
            disabled={submitting}
            onClick={() => rate(false, null)}
            className="py-2.5 text-sm font-medium text-neutral-500 hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            No me interesa
          </button>
          <button
            disabled={submitting}
            onClick={() => setExpanded(true)}
            className="py-2.5 text-sm font-bold text-white hover:bg-accent transition-colors disabled:opacity-50"
          >
            Ya la vi ✓
          </button>
        </div>
      ) : (
        <div className="border-t border-border p-3">
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
