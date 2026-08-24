"use client";

import { useEffect, useState } from "react";

interface Friend {
  id: string;
  name: string | null;
  email: string;
}

// Small "send this to a friend" widget for the title detail page. Fetches
// the friend list lazily (only once expanded) via the side-effect-free
// /api/friends/list -- GET /api/friends also marks the inbox as read, which
// would be wrong to trigger just from opening an unrelated title page.
export function RecommendToFriend({ titleId }: { titleId: string }) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || friends !== null) return;
    (async () => {
      try {
        const res = await fetch("/api/friends/list");
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        setFriends(data.friends);
      } catch {
        setError(true);
        setFriends([]);
      }
    })();
  }, [open, friends]);

  async function send(friendId: string) {
    if (sentTo.has(friendId)) return;
    setError(false);
    try {
      const res = await fetch("/api/friends/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId, titleId }),
      });
      if (!res.ok) throw new Error("failed");
      setSentTo((prev) => new Set(prev).add(friendId));
    } catch {
      setError(true);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted underline-offset-2 hover:text-white hover:underline"
      >
        Recomendar a un amigo
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <p className="text-xs font-semibold text-white">Recomendar a un amigo</p>
      {friends === null && <p className="text-xs text-muted">Cargando…</p>}
      {friends?.length === 0 && (
        <p className="text-xs text-muted">
          Todavía no tienes amigos agregados. Agrega a alguien desde la sección Amigos.
        </p>
      )}
      {error && <p className="text-xs text-red-400">No se pudo enviar. Inténtalo de nuevo.</p>}
      <div className="flex flex-wrap gap-1.5">
        {friends?.map((f) => (
          <button
            key={f.id}
            onClick={() => send(f.id)}
            disabled={sentTo.has(f.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              sentTo.has(f.id)
                ? "border-accent bg-accent/20 text-accent-hover"
                : "border-white/15 text-neutral-300 hover:border-white/30"
            }`}
          >
            {sentTo.has(f.id) ? `Enviado a ${f.name || f.email} ✓` : f.name || f.email}
          </button>
        ))}
      </div>
    </div>
  );
}
