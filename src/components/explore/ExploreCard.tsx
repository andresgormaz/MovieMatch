"use client";

import { useState } from "react";
import Link from "next/link";
import { Poster } from "@/components/Poster";
import { ProviderBadges, type ProviderBadge } from "@/components/ProviderBadges";
import { StarRating, StarDisplay } from "@/components/StarRating";

export interface ExploreTitle {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  posterUrl: string | null;
  voteAverage: number | null;
  voteCount: number | null;
  budget: number | null;
  genres: string[];
  directors: string[];
  providers: ProviderBadge[];
  myRating: { seen: boolean; score: number | null } | null;
}

function formatBudget(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function ExploreCard({ title }: { title: ExploreTitle }) {
  const [rating, setRating] = useState(title.myRating);
  const [editing, setEditing] = useState(false);
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
        body: JSON.stringify({ titleId: title.id, seen, score }),
      });
      if (!res.ok) throw new Error("rate failed");
      setRating({ seen, score });
      setEditing(false);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <Link href={`/title/${title.id}`} className="block aspect-[2/3] w-full">
        <Poster name={title.name} type={title.type} posterUrl={title.posterUrl} />
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <h3 className="truncate text-sm font-semibold text-white" title={title.name}>
          <Link href={`/title/${title.id}`} className="hover:underline">
            {title.name}
          </Link>
        </h3>
        <p className="text-[11px] text-muted">
          {title.releaseYear ?? "—"}{" "}
          {title.voteAverage
            ? `· ⭐ ${title.voteAverage.toFixed(1)} (TMDB${title.voteCount != null ? `, ${title.voteCount.toLocaleString("es")} votos` : ""})`
            : ""}
        </p>
        {title.genres.length > 0 && <p className="truncate text-[11px] text-muted">{title.genres.join(" · ")}</p>}
        {title.budget ? <p className="text-[11px] text-muted">Presupuesto: {formatBudget(title.budget)}</p> : null}
        <ProviderBadges providers={title.providers} />
        {error && <p className="text-[11px] text-red-400">No se pudo guardar. Inténtalo de nuevo.</p>}
      </div>

      {rating && !editing ? (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center justify-center gap-1.5 border-t border-border py-2 text-center text-xs text-muted hover:bg-surface-hover transition-colors"
        >
          {!rating.seen ? (
            "No vista · cambiar"
          ) : rating.score ? (
            <>
              <StarDisplay score={rating.score} className="text-xs" /> · cambiar
            </>
          ) : (
            "Vista, sin calificar · calificar"
          )}
        </button>
      ) : !editing ? (
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
          <button
            disabled={submitting}
            onClick={() => rate(false, null)}
            className="py-2 text-xs font-medium text-neutral-300 hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            No la vi
          </button>
          <button
            disabled={submitting}
            onClick={() => setEditing(true)}
            className="py-2 text-xs font-medium text-neutral-300 hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            La vi
          </button>
        </div>
      ) : (
        <div className="flex justify-center border-t border-border p-2">
          <StarRating disabled={submitting} onRate={(s) => rate(true, s)} size="sm" />
        </div>
      )}
    </div>
  );
}
