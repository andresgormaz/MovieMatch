"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProviderBadges, type ProviderBadge } from "@/components/ProviderBadges";
import { StarRating } from "@/components/StarRating";
import { SeriesWatchProgressPicker } from "@/components/SeriesWatchProgressPicker";
import { formatScore } from "@/lib/format";
import { seasonsSummary, type WatchProgress } from "@/lib/seriesStatus";

interface TodayPick {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  backdropUrl: string | null;
  genres: string[];
  voteAverage: number | null;
  seasonsCount: number | null;
  status: string | null;
  score: number;
  reasons: string[];
  providers: ProviderBadge[];
}

// The single-protagonist home hero: one big pick instead of a wall of cards,
// so there's exactly one thing to decide about on open. Fetches its own data
// client-side (limit=1 against the same scoring the recommendations page
// uses) so the server component around it stays a fast, simple shell.
export function HomeHero() {
  const [pick, setPick] = useState<TodayPick | null | undefined>(undefined);
  const [showScores, setShowScores] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  // Which score was just tapped, kept lit in gold for a beat before the
  // card switches to the "gracias" state -- same confirmation as
  // "Calificar lo que ya viste", so tapping N stars visibly confirms N
  // stars registered instead of the card vanishing the instant you tap.
  const [confirmedScore, setConfirmedScore] = useState<number | null>(null);
  // Series-only: must be picked before a series can be marked seen (see the
  // render branch below) -- movies skip this state entirely.
  const [watchProgress, setWatchProgress] = useState<WatchProgress | null>(null);

  async function load() {
    setError(false);
    try {
      const res = await fetch("/api/recommendations?limit=1");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setPick(data.recommendations[0] ?? null);
    } catch {
      setError(true);
      setPick(null);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, []);

  async function rate(seen: boolean, score: number | null, notInterested = false) {
    if (!pick || submitting) return;
    setSubmitting(true);
    if (score !== null) setConfirmedScore(score);
    try {
      const res = await fetch("/api/titles/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId: pick.id, seen, score, notInterested, watchProgress }),
      });
      if (!res.ok) throw new Error("rate failed");
      if (score !== null) await new Promise((resolve) => setTimeout(resolve, 550));
      setDone(true);
    } catch {
      setError(true);
      setSubmitting(false);
      setConfirmedScore(null);
    }
  }

  async function addToWishlist() {
    if (!pick || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId: pick.id }),
      });
      if (!res.ok) throw new Error("wishlist failed");
      setDone(true);
    } catch {
      setError(true);
      setSubmitting(false);
    }
  }

  if (pick === undefined) {
    return <div className="h-72 w-full animate-pulse rounded-2xl bg-surface sm:h-80" />;
  }

  if (!pick) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">
          No encontramos más recomendaciones nuevas por ahora. Califica algo más o explora el catálogo.
        </p>
        <Link
          href="/explore"
          className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
        >
          Explorar catálogo →
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-white">Listo, gracias por calificar 🎬</p>
        <Link
          href="/recommendations"
          className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
        >
          Ver todas tus recomendaciones →
        </Link>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
      <Link href={`/title/${pick.id}`} className="relative block h-56 w-full sm:h-72">
        {pick.backdropUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pick.backdropUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-accent/30 to-black" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
      </Link>

      <div className="relative -mt-14 flex flex-col gap-3 px-5 pb-5 sm:-mt-16">
        <span className="w-fit rounded bg-green-500/15 px-2 py-0.5 text-xs font-bold text-green-400">
          Puntaje: {formatScore(pick.score)}
        </span>

        <div>
          <Link href={`/title/${pick.id}`} className="hover:underline">
            <h2 className="text-2xl font-bold text-white">
              {pick.name} {pick.releaseYear ? <span className="text-neutral-500">({pick.releaseYear})</span> : null}
            </h2>
          </Link>
          <p className="mt-0.5 text-sm text-muted">
            {pick.type === "MOVIE" ? "Película" : "Serie"}
            {pick.voteAverage != null ? ` · ★ ${pick.voteAverage.toFixed(1)} TMDB` : ""}
            {pick.genres.length ? ` · ${pick.genres.slice(0, 3).join(", ")}` : ""}
          </p>
          {pick.type === "SERIES" && seasonsSummary(pick.seasonsCount, pick.status) && (
            <p className="mt-0.5 text-sm text-muted">{seasonsSummary(pick.seasonsCount, pick.status)}</p>
          )}
          {pick.reasons[0] && <p className="mt-1 text-sm text-neutral-300">{pick.reasons[0]}</p>}
        </div>

        <ProviderBadges providers={pick.providers} />

        {error && <p className="text-xs text-red-400">No se pudo guardar. Inténtalo de nuevo.</p>}

        {!showScores ? (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex flex-1 gap-1.5">
              <button
                disabled={submitting}
                onClick={() => rate(false, null, true)}
                className="flex-1 rounded-lg border border-white/15 px-2 py-2 text-xs font-medium text-neutral-300 hover:border-white/30 transition-colors disabled:opacity-50"
              >
                No me interesa
              </button>
              <button
                disabled={submitting}
                onClick={addToWishlist}
                className="flex-1 rounded-lg border border-white/15 px-2 py-2 text-xs font-medium text-neutral-300 hover:border-white/30 transition-colors disabled:opacity-50"
              >
                La voy a ver
              </button>
              <button
                disabled={submitting}
                onClick={() => setShowScores(true)}
                className="flex-1 rounded-lg border border-white/15 px-2 py-2 text-xs font-medium text-neutral-300 hover:border-white/30 transition-colors disabled:opacity-50"
              >
                Ya la vi
              </button>
            </div>
            <Link href="/recommendations" className="flex-shrink-0 text-sm text-muted hover:text-white transition-colors">
              Ver más →
            </Link>
          </div>
        ) : pick.type === "SERIES" && !watchProgress ? (
          <SeriesWatchProgressPicker disabled={submitting} onPick={setWatchProgress} />
        ) : (
          <div className="mt-1 flex justify-center">
            <StarRating disabled={submitting} selected={confirmedScore ?? undefined} onRate={(s) => rate(true, s)} />
          </div>
        )}
      </div>
    </div>
  );
}
