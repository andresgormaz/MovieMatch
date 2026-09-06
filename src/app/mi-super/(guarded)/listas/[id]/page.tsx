"use client";

import { use, useCallback, useEffect, useState } from "react";
import { BackToHomeLink } from "@/components/BackToHomeLink";

interface ListInfo {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
}

const STATUS_LABEL: Record<ListInfo["status"], string> = {
  DRAFT: "Futura",
  ACTIVE: "En curso",
  COMPLETED: "Completada",
  ARCHIVED: "Archivada",
};

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [list, setList] = useState<ListInfo | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/mi-super/lists/${id}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    const { list: l } = await res.json();
    setList(l);
    setTitleDraft(l.title);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    load();
  }, [load]);

  async function saveTitle(e: React.FormEvent) {
    e.preventDefault();
    if (!titleDraft.trim()) return;
    const res = await fetch(`/api/mi-super/lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft.trim() }),
    });
    const { list: updated } = await res.json();
    setList(updated);
  }

  async function startShopping() {
    const res = await fetch(`/api/mi-super/lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    const { list: updated } = await res.json();
    setList(updated);
  }

  if (notFound) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <BackToHomeLink href="/mi-super/listas" label="Listas" />
        <p className="text-center text-sm text-muted">No encontramos esta lista.</p>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <BackToHomeLink href="/mi-super/listas" label="Listas" />
        <p className="text-center text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <BackToHomeLink href="/mi-super/listas" label="Listas" />

      <div className="flex flex-col gap-3">
        <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
          {STATUS_LABEL[list.status]}
        </span>
        <form onSubmit={saveTitle} className="flex gap-2">
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-lg font-bold text-white outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
          >
            Guardar
          </button>
        </form>
        {list.status === "DRAFT" && (
          <button
            onClick={startShopping}
            className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
          >
            Empezar a comprar
          </button>
        )}
      </div>

      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Pronto vas a poder agregar productos a esta lista acá.
      </p>
    </div>
  );
}
