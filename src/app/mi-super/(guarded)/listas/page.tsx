"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BackToHomeLink } from "@/components/BackToHomeLink";

interface ListInfo {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  plannedAt: string | null;
}

const SECTIONS: { status: ListInfo["status"]; label: string; empty: string }[] = [
  { status: "ACTIVE", label: "Activas", empty: "Ninguna lista en curso." },
  { status: "DRAFT", label: "Futuras", empty: "Ninguna lista planeada todavía." },
  { status: "COMPLETED", label: "Completadas", empty: "Todavía no completas ninguna compra." },
];

export default function ListasPage() {
  const [lists, setLists] = useState<ListInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/mi-super/lists");
    const data = await res.json();
    setLists(data.lists);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    load();
  }, [load]);

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    await fetch("/api/mi-super/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    setNewTitle("");
    setCreating(false);
    load();
  }

  async function startShopping(id: string) {
    await fetch(`/api/mi-super/lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    load();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <BackToHomeLink href="/mi-super" />
      <div>
        <h1 className="text-2xl font-bold">Listas</h1>
        <p className="mt-1 text-sm text-muted">Planea tu próxima compra o retoma una en curso.</p>
      </div>

      <form onSubmit={createList} className="flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nombre de la lista (ej: Compra del mes)"
          className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          Crear lista
        </button>
      </form>

      {loading && <p className="text-center text-sm text-muted">Cargando…</p>}

      {!loading &&
        SECTIONS.map(({ status, label, empty }) => {
          const sectionLists = lists.filter((l) => l.status === status);
          return (
            <section key={status} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{label}</h2>
              {sectionLists.length === 0 ? (
                <p className="rounded-xl border border-border bg-surface p-4 text-center text-sm text-muted">
                  {empty}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {sectionLists.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"
                    >
                      <Link href={`/mi-super/listas/${l.id}`} className="font-semibold text-white hover:underline">
                        {l.title}
                      </Link>
                      {l.status === "DRAFT" && (
                        <button
                          onClick={() => startShopping(l.id)}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-hover transition-colors"
                        >
                          Empezar a comprar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
    </div>
  );
}
