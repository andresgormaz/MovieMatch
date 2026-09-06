"use client";

import { useCallback, useEffect, useState } from "react";
import { BackToHomeLink } from "@/components/BackToHomeLink";

interface HouseholdInfo {
  id: string;
  name: string | null;
  inviteCode: string;
  ownerUserId: string;
}
interface MemberInfo {
  id: string;
  name: string | null;
  email: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
}
interface CategoryInfo {
  id: string;
  name: string;
  sortOrder: number;
}

export default function AjustesPage() {
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // The membership check in mi-super/(guarded)/layout.tsx already
    // guarantees at least one household exists for this user; this page
    // only ever operates on the first one, same scope as the Inicio page.
    const membershipsRes = await fetch("/api/mi-super/households/current");
    const { household: h } = await membershipsRes.json();
    setHousehold(h);
    setNameDraft(h.name || "");

    const [membersRes, categoriesRes] = await Promise.all([
      fetch(`/api/mi-super/households/${h.id}/members`),
      fetch(`/api/mi-super/households/${h.id}/categories`),
    ]);
    const { members: m } = await membersRes.json();
    const { categories: c } = await categoriesRes.json();
    setMembers(m);
    setCategories(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    load();
  }, [load]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!household) return;
    setSavingName(true);
    const res = await fetch(`/api/mi-super/households/${household.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameDraft || undefined }),
    });
    const { household: updated } = await res.json();
    setHousehold(updated);
    setSavingName(false);
  }

  function inviteUrl(code: string) {
    return `${window.location.origin}/mi-super/join/${code}`;
  }

  async function copyInvite() {
    if (!household) return;
    await navigator.clipboard.writeText(inviteUrl(household.inviteCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!household) return;
    setCategoryError(null);
    const res = await fetch(`/api/mi-super/households/${household.id}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategory }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setCategoryError(error || "No se pudo crear la categoría");
      return;
    }
    setNewCategory("");
    load();
  }

  async function renameCategory(id: string, name: string) {
    const res = await fetch(`/api/mi-super/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) load();
  }

  async function deleteCategory(id: string) {
    await fetch(`/api/mi-super/categories/${id}`, { method: "DELETE" });
    load();
  }

  async function moveCategory(id: string, direction: "up" | "down") {
    await fetch(`/api/mi-super/categories/${id}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    load();
  }

  if (loading || !household) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <BackToHomeLink href="/mi-super" />
        <p className="text-center text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <BackToHomeLink href="/mi-super" />
      <div>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="mt-1 text-sm text-muted">Tu hogar, quién forma parte de él y sus categorías.</p>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold text-white">Hogar</h2>
        <form onSubmit={saveName} className="flex gap-2">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Nombre del hogar (ej: Casa de Ana)"
            className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={savingName}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            Guardar
          </button>
        </form>
        <button
          onClick={copyInvite}
          className="w-fit rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-300 hover:border-white/30 transition-colors"
        >
          {copied ? "¡Copiado! ✓" : "Copiar link de invitación"}
        </button>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold text-white">Integrantes</h2>
        <ul className="flex flex-col gap-1 text-sm text-muted">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between">
              <span>{m.name || m.email}</span>
              <span className="text-xs uppercase text-neutral-500">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold text-white">Categorías</h2>
        <form onSubmit={addCategory} className="flex gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Nueva categoría"
            className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
          >
            Agregar
          </button>
        </form>
        {categoryError && <p className="text-xs text-red-400">{categoryError}</p>}
        <ul className="flex flex-col gap-1.5">
          {categories.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm">
              <input
                defaultValue={c.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && renameCategory(c.id, e.target.value.trim())}
                className="flex-1 bg-transparent outline-none"
              />
              <button
                onClick={() => moveCategory(c.id, "up")}
                disabled={i === 0}
                aria-label={`Subir ${c.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:text-white disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => moveCategory(c.id, "down")}
                disabled={i === categories.length - 1}
                aria-label={`Bajar ${c.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:text-white disabled:opacity-30"
              >
                ↓
              </button>
              <button
                onClick={() => deleteCategory(c.id)}
                aria-label={`Eliminar ${c.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
