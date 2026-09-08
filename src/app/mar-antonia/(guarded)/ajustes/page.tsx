"use client";

import { useCallback, useEffect, useState } from "react";
import { BackToHomeLink } from "@/components/BackToHomeLink";

interface ChildInfo {
  id: string;
  name: string;
  inviteCode: string;
  ownerUserId: string;
}
interface CaregiverInfo {
  id: string;
  name: string | null;
  email: string;
  role: "MAMA" | "PAPA";
}

const ROLE_LABEL: Record<CaregiverInfo["role"], string> = { MAMA: "Mamá", PAPA: "Papá" };

export default function MarAntoniaAjustesPage() {
  const [child, setChild] = useState<ChildInfo | null>(null);
  const [caregivers, setCaregivers] = useState<CaregiverInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // The caregiver check in mar-antonia/(guarded)/layout.tsx already
    // guarantees at least one child exists for this user; this page only
    // ever operates on the first one, same scope as the Inicio page.
    const currentRes = await fetch("/api/mar-antonia/children/current");
    const { child: c, caregivers: cg } = await currentRes.json();
    setChild(c);
    setNameDraft(c.name);
    setCaregivers(cg);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    load();
  }, [load]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!child || !nameDraft.trim()) return;
    setSavingName(true);
    const res = await fetch(`/api/mar-antonia/children/${child.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameDraft.trim() }),
    });
    const { child: updated } = await res.json();
    setChild(updated);
    setSavingName(false);
  }

  function inviteUrl(code: string) {
    return `${window.location.origin}/mar-antonia/join/${code}`;
  }

  async function copyInvite() {
    if (!child) return;
    await navigator.clipboard.writeText(inviteUrl(child.inviteCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !child) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <BackToHomeLink href="/mar-antonia" />
        <p className="text-center text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <BackToHomeLink href="/mar-antonia" />
      <div>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="mt-1 text-sm text-muted">El perfil y quiénes lo comparten.</p>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold text-white">Perfil</h2>
        <form onSubmit={saveName} className="flex gap-2">
          <input
            id="child-name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
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
        <h2 className="font-semibold text-white">Cuidadores</h2>
        <ul className="flex flex-col gap-1 text-sm text-muted">
          {caregivers.map((c) => (
            <li key={c.id} className="flex items-center justify-between">
              <span>{c.name || c.email}</span>
              <span className="text-xs uppercase text-neutral-500">{ROLE_LABEL[c.role]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
