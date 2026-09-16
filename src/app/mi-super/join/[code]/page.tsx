"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Preview {
  household: { id: string; name: string | null; members: string[] };
  alreadyMember: boolean;
}

export default function JoinHouseholdPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/mi-super/households/join/${code}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo cargar la invitación");
        return;
      }
      setPreview(await res.json());
    })();
  }, [code]);

  async function accept() {
    setJoining(true);
    const res = await fetch(`/api/mi-super/households/join/${code}`, { method: "POST" });
    setJoining(false);
    if (res.ok) {
      router.push("/mi-super");
      router.refresh();
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-57px)] items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/25 via-background to-background" />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-surface/90 p-8 text-center backdrop-blur">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!error && !preview && <p className="text-sm text-muted">Cargando invitación…</p>}
        {preview && (
          <>
            <h1 className="text-xl font-bold text-white">
              {preview.household.name ? `Unite a "${preview.household.name}"` : "Te invitaron a un hogar en MiSuper"}
            </h1>
            <p className="text-sm text-muted">
              Integrantes actuales: {preview.household.members.join(", ") || "nadie todavía"}
            </p>
            {preview.alreadyMember ? (
              <p className="text-sm text-white">Ya eres parte de este hogar.</p>
            ) : (
              <button
                onClick={accept}
                disabled={joining}
                className="w-full rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {joining ? "Uniéndome…" : "Unirme al hogar"}
              </button>
            )}
            <button onClick={() => router.push("/mi-super")} className="text-xs text-muted underline">
              Ir a MiSuper
            </button>
          </>
        )}
      </div>
    </div>
  );
}
