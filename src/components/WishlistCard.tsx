"use client";

import { useState } from "react";
import { Poster } from "@/components/Poster";
import { ProviderBadges, type ProviderBadge } from "@/components/ProviderBadges";

export interface WishlistItem {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  overview: string | null;
  posterUrl: string | null;
  voteAverage: number | null;
  genres: string[];
  directors: string[];
  providers: ProviderBadge[];
}

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function WishlistCard({
  item,
  onRemoved,
}: {
  item: WishlistItem;
  onRemoved: (titleId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function markSeen(score: number) {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch("/api/titles/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId: item.id, seen: true, score }),
      });
      if (!res.ok) throw new Error("rate failed");
      onRemoved(item.id);
    } catch {
      setError(true);
      setSubmitting(false);
    }
  }

  async function removeFromWishlist() {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch(`/api/wishlist/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("wishlist remove failed");
      onRemoved(item.id);
    } catch {
      setError(true);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex gap-4 p-4">
        <div className="h-40 w-28 flex-shrink-0 overflow-hidden rounded-lg shadow-lg shadow-black/40">
          <Poster name={item.name} type={item.type} posterUrl={item.posterUrl} />
        </div>
        <div className="min-w-0 flex-1">
          {item.voteAverage != null && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium text-neutral-300">
              ★ {item.voteAverage.toFixed(1)} <span className="text-neutral-500">(TMDB)</span>
            </span>
          )}
          <h3 className="mt-1 font-semibold text-white">
            {item.name} {item.releaseYear ? <span className="text-neutral-500">({item.releaseYear})</span> : null}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {item.type === "MOVIE" ? "Película" : "Serie"}
            {item.directors.length ? ` · ${item.directors.join(", ")}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">{item.genres.join(" · ")}</p>
          <ProviderBadges providers={item.providers} />
          {item.overview && <p className="mt-2 line-clamp-2 text-xs text-muted">{item.overview}</p>}
          {error && <p className="mt-2 text-xs text-red-400">No se pudo guardar. Probá de nuevo.</p>}
        </div>
      </div>

      {!expanded ? (
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
          <button
            disabled={submitting}
            onClick={removeFromWishlist}
            className="py-2.5 text-sm font-medium text-neutral-500 hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            Quitar de la lista
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
                onClick={() => markSeen(s)}
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
