"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackToHomeLink } from "@/components/BackToHomeLink";

// First-run screen for MiSuper: create a new household, or join one someone
// already shared a code/link for. Reached automatically by the
// (guarded) layout whenever the current user has no household membership
// yet -- see src/app/mi-super/(guarded)/layout.tsx.
export default function MiSuperOnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function createHousehold(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch("/api/mi-super/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || undefined }),
    });
    setCreating(false);
    if (!res.ok) {
      setError("No se pudo crear el hogar. Inténtalo de nuevo.");
      return;
    }
    router.push("/mi-super");
    router.refresh();
  }

  function goToInvite(e: React.FormEvent) {
    e.preventDefault();
    // Accepts either a bare code or a full invite link pasted in whole.
    const trimmed = code.trim();
    const match = trimmed.match(/\/mi-super\/join\/([^/?#]+)/);
    const finalCode = match ? match[1] : trimmed;
    if (finalCode) router.push(`/mi-super/join/${finalCode}`);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
      <BackToHomeLink href="/" label="Inicio" />
      <div>
        <h1 className="text-2xl font-bold">Bienvenido a MiSuper</h1>
        <p className="mt-1 text-sm text-muted">
          Primero necesitas un hogar: créalo tú, o únete al que alguien más ya armó.
        </p>
      </div>

      <form onSubmit={createHousehold} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <label htmlFor="household-name" className="text-sm font-semibold text-white">
          Crear un hogar nuevo
        </label>
        <input
          id="household-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (opcional, ej: Casa de los Gormaz)"
          className="rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={creating}
          className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {creating ? "Creando…" : "Crear hogar"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <div className="h-px flex-1 bg-white/10" />
        o
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={goToInvite} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <label htmlFor="invite-code" className="text-sm font-semibold text-white">
          ¿Tienes un código de invitación?
        </label>
        <input
          id="invite-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Pega el código o el link completo"
          className="rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="mt-1 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-neutral-200 hover:border-white/30 transition-colors"
        >
          Continuar
        </button>
      </form>
    </div>
  );
}
