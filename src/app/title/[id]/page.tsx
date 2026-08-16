"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Poster } from "@/components/Poster";
import { ProviderBadges, type ProviderBadge } from "@/components/ProviderBadges";

interface CastMember {
  id: string;
  name: string;
  photoUrl: string | null;
}

interface CrewMember {
  id: string;
  name: string;
  job: string;
}

interface SimilarTitle {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  posterUrl: string | null;
}

interface TitleDetail {
  id: string;
  name: string;
  originalName: string | null;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number | null;
  voteCount: number | null;
  budget: number | null;
  originCountry: string | null;
  originCountryName: string | null;
  genres: string[];
  cast: CastMember[];
  crew: CrewMember[];
  providers: ProviderBadge[];
  similar: SimilarTitle[];
  myRating: { seen: boolean; score: number | null } | null;
  inWishlist: boolean;
}

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function formatBudget(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function TitleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [title, setTitle] = useState<TitleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScores, setShowScores] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/titles/${id}`);
        if (!res.ok) throw new Error("not found");
        setTitle(await res.json());
      } catch {
        setError("No pudimos cargar esta ficha. Probá de nuevo en un momento.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function rate(seen: boolean, score: number | null) {
    if (submitting || !title) return;
    setSubmitting(true);
    setActionError(false);
    try {
      const res = await fetch("/api/titles/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId: title.id, seen, score }),
      });
      if (!res.ok) throw new Error("rate failed");
      setTitle({ ...title, myRating: { seen, score }, inWishlist: false });
      setShowScores(false);
    } catch {
      setActionError(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleWishlist() {
    if (submitting || !title) return;
    setSubmitting(true);
    setActionError(false);
    try {
      const res = title.inWishlist
        ? await fetch(`/api/wishlist/${title.id}`, { method: "DELETE" })
        : await fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ titleId: title.id }),
          });
      if (!res.ok) throw new Error("wishlist failed");
      setTitle({ ...title, inWishlist: !title.inWishlist });
    } catch {
      setActionError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="px-4 py-16 text-center text-sm text-muted">Cargando…</p>;
  }
  if (error || !title) {
    return (
      <p className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
        {error ?? "No encontramos este título."}
      </p>
    );
  }

  const director = title.crew.filter((c) => c.job === "Director" || c.job === "Creator");
  const studio = title.crew.filter((c) => c.job === "Estudio");

  return (
    <div className="flex flex-col">
      <div className="relative w-full overflow-hidden">
        {title.backdropUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={title.backdropUrl} alt="" className="h-56 w-full object-cover sm:h-80" />
        ) : (
          <div className="h-40 w-full bg-gradient-to-br from-red-950/40 to-black" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      <div className="mx-auto -mt-20 flex w-full max-w-4xl flex-col gap-6 px-4 pb-12 sm:-mt-28 sm:flex-row">
        <div className="h-56 w-40 flex-shrink-0 overflow-hidden rounded-xl shadow-2xl shadow-black/60 sm:h-72 sm:w-48">
          <Poster name={title.name} type={title.type} posterUrl={title.posterUrl} />
        </div>

        <div className="flex-1 pt-2 sm:pt-16">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            {title.name} {title.releaseYear ? <span className="text-neutral-500">({title.releaseYear})</span> : null}
          </h1>
          {title.originalName && title.originalName !== title.name && (
            <p className="mt-0.5 text-sm text-muted">Título original: {title.originalName}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded bg-white/10 px-2 py-1 text-xs font-medium text-neutral-300">
              {title.type === "MOVIE" ? "Película" : "Serie"}
            </span>
            {title.voteAverage != null && (
              <span className="rounded bg-white/10 px-2 py-1 text-xs font-medium text-neutral-300">
                ★ {title.voteAverage.toFixed(1)}{" "}
                <span className="text-neutral-500">
                  (TMDB{title.voteCount != null ? `, ${title.voteCount.toLocaleString("es")} votos` : ""})
                </span>
              </span>
            )}
            {title.originCountryName && (
              <span className="rounded bg-white/10 px-2 py-1 text-xs font-medium text-neutral-300">
                {title.originCountryName}
              </span>
            )}
          </div>

          {title.genres.length > 0 && <p className="mt-2 text-sm text-muted">{title.genres.join(" · ")}</p>}

          <ProviderBadges providers={title.providers} />

          {title.overview && <p className="mt-4 text-sm leading-relaxed text-neutral-200">{title.overview}</p>}

          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {director.length > 0 && (
              <div>
                <dt className="inline text-muted">{title.type === "MOVIE" ? "Dirección: " : "Creación: "}</dt>
                <dd className="inline text-neutral-200">{director.map((d) => d.name).join(", ")}</dd>
              </div>
            )}
            {studio.length > 0 && (
              <div>
                <dt className="inline text-muted">Estudio: </dt>
                <dd className="inline text-neutral-200">{studio.map((s) => s.name).join(", ")}</dd>
              </div>
            )}
            {title.budget ? (
              <div>
                <dt className="inline text-muted">Presupuesto: </dt>
                <dd className="inline text-neutral-200">{formatBudget(title.budget)}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {!showScores ? (
              <>
                <button
                  disabled={submitting}
                  onClick={() => rate(false, null)}
                  className="rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-neutral-300 hover:border-white/30 transition-colors disabled:opacity-50"
                >
                  No me interesa
                </button>
                <button
                  disabled={submitting}
                  onClick={toggleWishlist}
                  className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                    title.inWishlist
                      ? "border-accent bg-accent/20 text-white"
                      : "border-white/15 text-neutral-300 hover:border-white/30"
                  }`}
                >
                  {title.inWishlist ? "En tu lista ✓" : "La voy a ver"}
                </button>
                <button
                  disabled={submitting}
                  onClick={() => setShowScores(true)}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {title.myRating?.seen ? `Tu nota: ${title.myRating.score} · cambiar` : "Ya la vi ✓"}
                </button>
              </>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {SCORES.map((s) => (
                  <button
                    key={s}
                    disabled={submitting}
                    onClick={() => rate(true, s)}
                    className="rounded-md border border-white/15 px-3 py-2 text-sm font-medium hover:border-accent hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          {actionError && <p className="mt-2 text-xs text-red-400">No se pudo guardar. Probá de nuevo.</p>}
        </div>
      </div>

      {title.cast.length > 0 && (
        <div className="mx-auto w-full max-w-4xl px-4 pb-10">
          <h2 className="mb-3 text-lg font-bold text-white">Reparto</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {title.cast.map((c) => (
              <div key={c.id} className="flex w-20 flex-shrink-0 flex-col items-center gap-1.5 text-center">
                <div className="h-20 w-20 overflow-hidden rounded-full bg-white/10">
                  {c.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photoUrl} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg text-neutral-500">
                      {c.name.charAt(0)}
                    </div>
                  )}
                </div>
                <p className="line-clamp-2 text-[11px] text-neutral-300">{c.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {title.similar.length > 0 && (
        <div className="mx-auto w-full max-w-4xl px-4 pb-16">
          <h2 className="mb-3 text-lg font-bold text-white">Títulos similares</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {title.similar.map((s) => (
              <Link key={s.id} href={`/title/${s.id}`} className="group flex flex-col gap-1.5">
                <div className="aspect-[2/3] w-full overflow-hidden rounded-lg shadow-lg shadow-black/40 transition-transform group-hover:scale-[1.02]">
                  <Poster name={s.name} type={s.type} posterUrl={s.posterUrl} />
                </div>
                <p className="truncate text-xs text-white group-hover:underline" title={s.name}>
                  {s.name}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
