"use client";

import { useState } from "react";

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

  async function rate(seen: boolean, score: number | null) {
    if (submitting) return;
    setSubmitting(true);
    await fetch("/api/titles/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titleId: title.id, seen, score }),
    });
    onRated(title.id);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
      <div className="flex gap-4 p-4">
        <div className="h-32 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-800">
          {title.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={title.posterUrl} alt={title.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl">
              {title.type === "MOVIE" ? "🎬" : "📺"}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-white">
            {title.name} {title.releaseYear ? <span className="text-neutral-500">({title.releaseYear})</span> : null}
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            {title.type === "MOVIE" ? "Película" : "Serie"}
            {title.directors.length ? ` · ${title.directors.join(", ")}` : ""}
          </p>
          <p className="mt-1 text-xs text-neutral-500">{title.genres.join(" · ")}</p>
        </div>
      </div>

      {!showScores ? (
        <div className="grid grid-cols-2 divide-x divide-neutral-800 border-t border-neutral-800">
          <button
            disabled={submitting}
            onClick={() => rate(false, null)}
            className="py-3 text-sm font-medium text-neutral-400 hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            No la vi
          </button>
          <button
            disabled={submitting}
            onClick={() => setShowScores(true)}
            className="py-3 text-sm font-medium text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            La vi ✓
          </button>
        </div>
      ) : (
        <div className="border-t border-neutral-800 p-3">
          <p className="mb-2 text-center text-xs text-neutral-500">¿Qué tan buena te pareció? (1-10)</p>
          <div className="grid grid-cols-5 gap-1.5">
            {SCORES.map((s) => (
              <button
                key={s}
                disabled={submitting}
                onClick={() => rate(true, s)}
                className="rounded-lg border border-neutral-700 py-2 text-sm font-medium hover:border-white hover:bg-white hover:text-neutral-900 transition-colors disabled:opacity-50"
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
