"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { BackToHomeLink } from "@/components/BackToHomeLink";

interface CategoryInfo {
  id: string;
  name: string;
  sortOrder: number;
}
interface ItemInfo {
  id: string;
  displayName: string;
  qty: number | null;
  unit: string | null;
  categoryId: string | null;
  category: CategoryInfo | null;
}
interface ListInfo {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  items: ItemInfo[];
}

const STATUS_LABEL: Record<ListInfo["status"], string> = {
  DRAFT: "Futura",
  ACTIVE: "En curso",
  COMPLETED: "Completada",
  ARCHIVED: "Archivada",
};

const UNCATEGORIZED = "__none__";

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [list, setList] = useState<ListInfo | null>(null);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [titleDraft, setTitleDraft] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategoryId, setNewItemCategoryId] = useState(UNCATEGORIZED);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/mi-super/lists/${id}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    const { list: l } = await res.json();
    setList(l);
    setTitleDraft(l.title);

    const currentRes = await fetch("/api/mi-super/households/current");
    if (currentRes.ok) {
      const { household } = await currentRes.json();
      const categoriesRes = await fetch(`/api/mi-super/households/${household.id}/categories`);
      const { categories: c } = await categoriesRes.json();
      setCategories(c);
    }
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

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setAdding(true);
    await fetch(`/api/mi-super/lists/${id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawName: newItemName.trim(),
        categoryId: newItemCategoryId === UNCATEGORIZED ? undefined : newItemCategoryId,
        clientMutationId: crypto.randomUUID(),
      }),
    });
    setNewItemName("");
    setAdding(false);
    load();
  }

  async function renameItem(itemId: string, displayName: string) {
    await fetch(`/api/mi-super/lists/${id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    load();
  }

  async function reassignItem(itemId: string, categoryId: string) {
    await fetch(`/api/mi-super/lists/${id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: categoryId === UNCATEGORIZED ? null : categoryId }),
    });
    load();
  }

  async function deleteItem(itemId: string) {
    await fetch(`/api/mi-super/lists/${id}/items/${itemId}`, { method: "DELETE" });
    load();
  }

  const groups = useMemo(() => {
    if (!list) return [];
    const byCategory = new Map<string, ItemInfo[]>();
    for (const item of list.items) {
      const key = item.categoryId ?? UNCATEGORIZED;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(item);
    }
    const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const result = sortedCategories
      .filter((c) => byCategory.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, items: byCategory.get(c.id)! }));
    if (byCategory.has(UNCATEGORIZED)) {
      result.push({ id: UNCATEGORIZED, name: "Sin categoría", items: byCategory.get(UNCATEGORIZED)! });
    }
    for (const group of result) {
      group.items.sort((a, b) => a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" }));
    }
    return result;
  }, [list, categories]);

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

      <form onSubmit={addItem} className="flex gap-2">
        <input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="Agregar producto (ej: Leche)"
          className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          value={newItemCategoryId}
          onChange={(e) => setNewItemCategoryId(e.target.value)}
          aria-label="Categoría para el nuevo producto"
          className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm outline-none focus:border-accent"
        >
          <option value={UNCATEGORIZED}>Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={adding}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          Agregar
        </button>
      </form>

      {list.items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Todavía no agregaste productos a esta lista.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <details key={group.id} open className="rounded-xl border border-border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-muted">
                {group.name} ({group.items.length})
              </summary>
              <ul className="mt-3 flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm">
                    <input
                      defaultValue={item.displayName}
                      onBlur={(e) =>
                        e.target.value.trim() &&
                        e.target.value !== item.displayName &&
                        renameItem(item.id, e.target.value.trim())
                      }
                      className="min-h-[44px] flex-1 bg-transparent outline-none"
                    />
                    <select
                      value={item.categoryId ?? UNCATEGORIZED}
                      onChange={(e) => reassignItem(item.id, e.target.value)}
                      aria-label={`Categoría de ${item.displayName}`}
                      className="rounded-md border border-white/10 bg-transparent px-1 py-1 text-xs text-muted outline-none"
                    >
                      <option value={UNCATEGORIZED}>Sin categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => deleteItem(item.id)}
                      aria-label={`Eliminar ${item.displayName}`}
                      className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-400 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
