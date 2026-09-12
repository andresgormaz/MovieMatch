"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { RolePicker, type CaregiverRole } from "@/components/marAntonia/RolePicker";

// First-run screen for MarAntonia: create a new child profile, or join one
// your partner already shared a code/link for. Reached automatically by the
// (guarded) layout whenever the current user isn't a caregiver of any child
// yet -- see src/app/mar-antonia/(guarded)/layout.tsx. That guard only
// redirects *into* onboarding, not away from it, and this page lives outside
// the guarded route group -- so someone who already has a profile (a stale
// bookmark, a link opened twice) could otherwise still land here and,
// without the create/join API's own guard against a second profile
// (src/app/api/mar-antonia/children/route.ts), end up confusingly split
// across two disconnected profiles. This check is the extra safety net.
export default function MarAntoniaOnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("MarAntonia");
  const [role, setRole] = useState<CaregiverRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/mar-antonia/children/current");
      if (res.ok) router.replace("/mar-antonia");
    })();
  }, [router]);

  async function createChild(e: React.FormEvent) {
    e.preventDefault();
    if (!role) {
      setError("Elige si eres mamá o papá.");
      return;
    }
    setCreating(true);
    setError(null);
    const res = await fetch("/api/mar-antonia/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || undefined, role }),
    });
    setCreating(false);
    if (!res.ok) {
      setError("No se pudo crear el perfil. Inténtalo de nuevo.");
      return;
    }
    router.push("/mar-antonia");
    router.refresh();
  }

  function goToInvite(e: React.FormEvent) {
    e.preventDefault();
    // Accepts either a bare code or a full invite link pasted in whole.
    const trimmed = code.trim();
    const match = trimmed.match(/\/mar-antonia\/join\/([^/?#]+)/);
    const finalCode = match ? match[1] : trimmed;
    if (finalCode) router.push(`/mar-antonia/join/${finalCode}`);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
      <BackToHomeLink href="/" label="Inicio" />
      <div>
        <h1 className="text-2xl font-bold">Bienvenido a MarAntonia</h1>
        <p className="mt-1 text-sm text-muted">
          Primero necesitas un perfil: créalo tú, o únete al que tu pareja ya armó.
        </p>
      </div>

      <form onSubmit={createChild} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="child-name" className="text-sm font-semibold text-white">
            Crear un perfil nuevo
          </label>
          <input
            id="child-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <RolePicker value={role} onChange={setRole} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={creating}
          className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {creating ? "Creando…" : "Crear perfil"}
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
