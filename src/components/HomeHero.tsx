"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProviderBadges, type ProviderBadge } from "@/components/ProviderBadges";

interface TodayPick {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  backdropUrl: string | null;
  genres: string[];
  voteAverage: number | null;
  matchPercent: number;
  reasons: string[];
  providers: ProviderBadge[];
}

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

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

  async function rate(seen: boolean, score: number | null) {
    if (!pick || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/titles/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId: pick.id, seen, score }),
      });
      if (!res.ok) throw new Error("rate failed");
      setDone(true);
    } catch {
      setError(true);
      setSubmitting(false);
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
          No encontramos más recomendaciones nuevas por ahora. Calificá algo más o explorá el catálogo.
        </p>
        <Link
          href="/explore"
          className="mt-4 inline-block rounded-md bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
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
          className="mt-4 inline-block rounded-md bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
        >
          Ver todas tus recomendaciones →
        </Link>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="relative h-56 w-full sm:h-72">
        {pick.backdropUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pick.backdropUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-accent/30 to-black" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
      </div>

      <div className="relative -mt-14 flex flex-col gap-3 px-5 pb-5 sm:-mt-16">
        <span className="w-fit rounded bg-green-500/15 px-2 py-0.5 text-xs font-bold text-green-400">
          {pick.matchPercent}% match para vos
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
          {pick.reasons[0] && <p className="mt-1 text-sm text-neutral-300">{pick.reasons[0]}</p>}
        </div>

        <ProviderBadges providers={pick.providers} />

        {error && <p className="text-xs text-red-400">No se pudo guardar. Probá de nuevo.</p>}

        {!showScores ? (
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              disabled={submitting}
              onClick={() => rate(false, null)}
              className="rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-neutral-300 hover:border-white/30 transition-colors disabled:opacity-50"
            >
              No me interesa
            </button>
            <button
              disabled={submitting}
              onClick={addToWishlist}
              className="rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-neutral-300 hover:border-white/30 transition-colors disabled:opacity-50"
            >
              La voy a ver
            </button>
            <button
              disabled={submitting}
              onClick={() => setShowScores(true)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Ya la vi ✓
            </button>
            <Link
              href="/recommendations"
              className="ml-auto flex items-center text-sm text-muted hover:text-white transition-colors"
            >
              Ver más →
            </Link>
          </div>
        ) : (
          <div className="mt-1 grid grid-cols-5 gap-1.5 sm:w-80">
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
        )}
      </div>
    </div>
  );
}
