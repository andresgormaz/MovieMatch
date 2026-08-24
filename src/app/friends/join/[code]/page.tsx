"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Preview {
  person: { name: string };
  alreadyFriends: boolean;
}

export default function JoinFriendPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/friends/join/${code}`);
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
    const res = await fetch(`/api/friends/join/${code}`, { method: "POST" });
    setJoining(false);
    if (res.ok) setDone(true);
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
              {preview.alreadyFriends || done ? `Ya son amigos con ${preview.person.name}` : `¿Agregar a ${preview.person.name} como amigo?`}
            </h1>
            {!preview.alreadyFriends && !done && (
              <button
                onClick={accept}
                disabled={joining}
                className="w-full rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {joining ? "Agregando…" : "Agregar amigo"}
              </button>
            )}
            <button onClick={() => router.push("/friends")} className="text-xs text-muted underline">
              Ir a mis amigos
            </button>
          </>
        )}
      </div>
    </div>
  );
}
