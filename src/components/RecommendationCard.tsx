"use client";

import { useState } from "react";
import Link from "next/link";
import { Poster } from "@/components/Poster";
import { ProviderBadges, type ProviderBadge } from "@/components/ProviderBadges";

export interface Recommendation {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  overview: string | null;
  posterUrl: string | null;
  genres: string[];
  directors: string[];
  voteAverage: number | null;
  voteCount: number | null;
  inTheaters: boolean;
  providers: ProviderBadge[];
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
  const [error, setError] = useState(false);

  async function rate(seen: boolean, score: number | null) {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch("/api/titles/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId: rec.id, seen, score }),
      });
      if (!res.ok) throw new Error("rate failed");
      onRated(rec.id);
    } catch {
      setError(true);
      setSubmitting(false);
    }
  }

  async function addToWishlist() {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId: rec.id }),
      });
      if (!res.ok) throw new Error("wishlist add failed");
      onRated(rec.id);
    } catch {
      setError(true);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex gap-4 p-4">
        <Link
          href={`/title/${rec.id}`}
          className="h-40 w-28 flex-shrink-0 overflow-hidden rounded-lg shadow-lg shadow-black/40"
        >
          <Poster name={rec.name} type={rec.type} posterUrl={rec.posterUrl} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-xs font-bold text-green-400">
              {rec.matchPercent}% match
            </span>
            {rec.voteAverage != null && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium text-neutral-300">
                ★ {rec.voteAverage.toFixed(1)}{" "}
                <span className="text-neutral-500">
                  (TMDB{rec.voteCount != null ? `, ${rec.voteCount.toLocaleString("es")} votos` : ""})
                </span>
              </span>
            )}
            {rec.inTheaters && (
              <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs font-bold text-accent">
                🎬 En cines
              </span>
            )}
          </div>
          <h3 className="mt-1 font-semibold text-white">
            <Link href={`/title/${rec.id}`} className="hover:underline">
              {rec.name}
            </Link>{" "}
            {rec.releaseYear ? <span className="text-neutral-500">({rec.releaseYear})</span> : null}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {rec.type === "MOVIE" ? "Película" : "Serie"}
            {rec.reasons[0]
              ? ` · ${rec.reasons[0]}`
              : rec.directors.length
                ? ` · ${rec.directors.join(", ")}`
                : ""}
          </p>
          <ProviderBadges providers={rec.providers} />
          {error && <p className="mt-2 text-xs text-red-400">No se pudo guardar. Inténtalo de nuevo.</p>}
        </div>
      </div>

      {!expanded ? (
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
          <button
            disabled={submitting}
            onClick={() => rate(false, null)}
            className="py-2.5 text-sm font-medium text-neutral-300 hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            No me interesa
          </button>
          <button
            disabled={submitting}
            onClick={addToWishlist}
            className="py-2.5 text-sm font-medium text-neutral-300 hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            La voy a ver
          </button>
          <button
            disabled={submitting}
            onClick={() => setExpanded(true)}
            className="py-2.5 text-sm font-medium text-neutral-300 hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            Ya la vi
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
