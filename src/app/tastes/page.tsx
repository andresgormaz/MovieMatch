"use client";

import { useEffect, useState } from "react";
import { BackToHomeLink } from "@/components/BackToHomeLink";

interface SummaryItem {
  key: string;
  label: string;
  score: number;
}
interface SummaryGroup {
  category: string;
  title: string;
  items: SummaryItem[];
}

// Everything onboarding and "vs" have ever inferred about your taste --
// tipo, género, masivo/indie, presupuesto, duración, popularidad, país,
// directores, actores -- grouped and ordered by score. Nothing here is a
// black box: every number is exactly what's used to score your
// recommendations right now, and +1/-1 nudges it directly instead of
// jumping to some absolute position on a fixed scale.
export default function TastesPage() {
  const [groups, setGroups] = useState<SummaryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/preferences");
    const data = await res.json();
    setGroups(data.groups);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, []);

  async function adjust(category: string, key: string, delta: 1 | -1) {
    const pendingId = `${category}:${key}`;
    if (pendingKey) return;
    setPendingKey(pendingId);
    setGroups((prev) =>
      prev.map((g) =>
        g.category !== category
          ? g
          : { ...g, items: g.items.map((it) => (it.key === key ? { ...it, score: it.score + delta } : it)).sort((a, b) => b.score - a.score) },
      ),
    );
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, key, delta }),
    });
    setPendingKey(null);
  }

  if (loading) {
    return <p className="px-4 py-16 text-center text-sm text-muted">Cargando…</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <BackToHomeLink />
      <div>
        <h1 className="text-2xl font-bold">Mis gustos</h1>
        <p className="mt-1 text-sm text-muted">
          Todo lo que aprendimos de tus calificaciones y de &quot;vs&quot;, agrupado y ordenado de mayor a menor. Usa
          los botones para corregir cualquier cosa a mano -- el ajuste se suma al puntaje que ya tenías, no lo
          reemplaza.
        </p>
      </div>

      {groups.map((g) => (
        <section key={g.category} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">{g.title}</h2>
          {g.items.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
              Todavía no hay señal acá.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              {g.items.map((item) => {
                const pendingId = `${g.category}:${item.key}`;
                const isPending = pendingKey === pendingId;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                  >
                    <p className="min-w-0 truncate text-sm text-white">{item.label}</p>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <p className={`w-8 text-right text-sm font-bold ${item.score > 0 ? "text-accent-hover" : item.score < 0 ? "text-red-400" : "text-muted"}`}>
                        {item.score > 0 ? "+" : ""}
                        {item.score}
                      </p>
                      <button
                        disabled={pendingKey !== null}
                        onClick={() => adjust(g.category, item.key, -1)}
                        aria-label={`Bajar ${item.label}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm text-muted transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-40"
                      >
                        −
                      </button>
                      <button
                        disabled={pendingKey !== null}
                        onClick={() => adjust(g.category, item.key, 1)}
                        aria-label={`Subir ${item.label}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm text-muted transition-colors hover:border-accent hover:text-accent-hover disabled:opacity-40"
                      >
                        +
                      </button>
                      {isPending && (
                        <div className="h-3 w-3 flex-shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
