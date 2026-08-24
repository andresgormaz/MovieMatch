"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RecommendationCard, type Recommendation } from "@/components/RecommendationCard";

const HOME_FEED_SIZE = 4;

// Several recommendations instead of HomeHero's single pick -- rating one
// no longer empties the section and leaves the user with nothing to do
// (the original complaint this replaced: "la evalúan y se va, y quedan sin
// saber qué hacer"). Fetches its own data client-side against the same
// scoring /recommendations itself uses, just capped smaller.
export function HomeForYou() {
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/recommendations?limit=${HOME_FEED_SIZE}`);
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        setRecs(data.recommendations);
      } catch {
        setError(true);
        setRecs([]);
      }
    })();
  }, []);

  function handleRated(titleId: string) {
    setRecs((prev) => (prev ? prev.filter((r) => r.id !== titleId) : prev));
  }

  if (recs === null) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-32 w-full animate-pulse rounded-xl bg-surface" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-surface" />
      </div>
    );
  }

  if (error || recs.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
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

  return (
    <div className="flex flex-col gap-3">
      {recs.map((r) => (
        <RecommendationCard key={r.id} rec={r} onRated={handleRated} />
      ))}
    </div>
  );
}
