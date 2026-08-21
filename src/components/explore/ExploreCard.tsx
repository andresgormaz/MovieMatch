"use client";

import { useState } from "react";
import Link from "next/link";
import { Poster } from "@/components/Poster";
import { ProviderBadges, type ProviderBadge } from "@/components/ProviderBadges";
import { StarRating, StarDisplay } from "@/components/StarRating";
import { SeriesWatchProgressPicker } from "@/components/SeriesWatchProgressPicker";
import { seasonsSummary, watchProgressLabel, type WatchProgress } from "@/lib/seriesStatus";

export interface ExploreTitle {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  posterUrl: string | null;
  voteAverage: number | null;
  voteCount: number | null;
  budget: number | null;
  seasonsCount: number | null;
  status: string | null;
  genres: string[];
  directors: string[];
  providers: ProviderBadge[];
  myRating: { seen: boolean; score: number | null; notInterested: boolean; watchProgress: string | null } | null;
}

function formatBudget(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function ExploreCard({
  title,
  onRated,
}: {
  title: ExploreTitle;
  // When provided (e.g. "Calificar populares"), the card is removed from
  // the caller's list once rated instead of collapsing into the "cambiar"
  // summary -- keeps a rate-many-quickly feed moving instead of leaving
  // already-closed cards sitting in the grid.
  onRated?: (titleId: string) => void;
}) {
  const [rating, setRating] = useState(title.myRating);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  // Which score was just tapped, kept lit in gold for a beat before the
  // picker collapses back into the summary button.
  const [confirmedScore, setConfirmedScore] = useState<number | null>(null);
  // Series-only: must be picked before a series can be marked seen.
  const [watchProgress, setWatchProgress] = useState<WatchProgress | null>(null);

  async function rate(seen: boolean, score: number | null, notInterested = false) {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    if (score !== null) setConfirmedScore(score);
    try {
      const res = await fetch("/api/titles/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId: title.id, seen, score, notInterested, watchProgress }),
      });
      if (!res.ok) throw new Error("rate failed");
      if (score !== null) await new Promise((resolve) => setTimeout(resolve, 550));
      if (onRated) {
        onRated(title.id);
      } else {
        setRating({ seen, score, notInterested, watchProgress: seen ? watchProgress : null });
        setEditing(false);
      }
      setConfirmedScore(null);
    } catch {
      setError(true);
      setConfirmedScore(null);
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
        {title.type === "SERIES" && seasonsSummary(title.seasonsCount, title.status) && (
          <p className="text-[11px] text-muted">{seasonsSummary(title.seasonsCount, title.status)}</p>
        )}
        <ProviderBadges providers={title.providers} />
        {error && <p className="text-[11px] text-red-400">No se pudo guardar. Inténtalo de nuevo.</p>}
      </div>

      {rating && !editing ? (
        <button
          onClick={() => {
            // Re-opening to change an existing rating shouldn't force
            // re-picking watch progress if it's already known.
            setWatchProgress((rating.watchProgress as WatchProgress) ?? null);
            setEditing(true);
          }}
          className="flex items-center justify-center gap-1.5 border-t border-border py-2 text-center text-xs text-muted hover:bg-surface-hover transition-colors"
        >
          {!rating.seen ? (
            rating.notInterested ? "No me interesa · cambiar" : "No la vi · cambiar"
          ) : rating.score ? (
            <>
              <StarDisplay score={rating.score} className="text-xs" />
              {watchProgressLabel(rating.watchProgress) && ` · ${watchProgressLabel(rating.watchProgress)}`}
              {" · cambiar"}
            </>
          ) : (
            "Vista, sin calificar · calificar"
          )}
        </button>
      ) : !editing ? (
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
          <button
            disabled={submitting}
            onClick={() => rate(false, null, false)}
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
      ) : title.type === "SERIES" && !watchProgress ? (
        <div className="border-t border-border p-2">
          <SeriesWatchProgressPicker disabled={submitting} onPick={setWatchProgress} />
        </div>
      ) : (
        <div className="flex justify-center border-t border-border p-2">
          <StarRating
            disabled={submitting}
            selected={confirmedScore ?? undefined}
            onRate={(s) => rate(true, s)}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}
