"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RolePicker, type CaregiverRole } from "@/components/marAntonia/RolePicker";

interface Preview {
  child: { id: string; name: string; caregivers: { label: string; role: CaregiverRole }[] };
  alreadyCaregiver: boolean;
}

export default function JoinChildPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<CaregiverRole | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/mar-antonia/children/join/${code}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo cargar la invitación");
        return;
      }
      setPreview(await res.json());
    })();
  }, [code]);

  async function accept() {
    if (!role) {
      setError("Elige si eres mamá o papá.");
      return;
    }
    setError(null);
    setJoining(true);
    const res = await fetch(`/api/mar-antonia/children/join/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setJoining(false);
    if (res.ok) {
      router.push("/mar-antonia");
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
            <h1 className="text-xl font-bold text-white">Unite al perfil de &quot;{preview.child.name}&quot;</h1>
            <p className="text-sm text-muted">
              Integrantes actuales:{" "}
              {preview.child.caregivers.map((c) => `${c.label} (${c.role === "MAMA" ? "Mamá" : "Papá"})`).join(", ") ||
                "nadie todavía"}
            </p>
            {preview.alreadyCaregiver ? (
              <p className="text-sm text-white">Ya eres parte de este perfil.</p>
            ) : (
              <>
                <RolePicker value={role} onChange={setRole} />
                <button
                  onClick={accept}
                  disabled={joining}
                  className="w-full rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {joining ? "Uniéndome…" : "Unirme"}
                </button>
              </>
            )}
            <button onClick={() => router.push("/mar-antonia")} className="text-xs text-muted underline">
              Ir a MarAntonia
            </button>
          </>
        )}
      </div>
    </div>
  );
}
