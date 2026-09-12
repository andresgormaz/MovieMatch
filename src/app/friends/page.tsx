"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Poster } from "@/components/Poster";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { PageTour } from "@/components/PageTour";
import type { TourStep } from "@/components/TourOverlay";

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="tour-friends-invite"]',
    title: "Suma a alguien",
    body: "Comparte tu link para que se agreguen como amigos -- así pueden mandarse recomendaciones.",
  },
  {
    selector: '[data-tour="tour-friends-received"]',
    title: "Lo que te recomendaron",
    body: "Cuando un amigo te manda un título, aparece aquí.",
  },
];

const DATE_LABEL = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

interface Friend {
  id: string;
  name: string | null;
  email: string;
}

interface ReceivedItem {
  id: string;
  from: string;
  createdAt: string;
  title: { id: string; name: string; type: "MOVIE" | "SERIES"; posterUrl: string | null; releaseYear: number | null };
}

export default function FriendsPage() {
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [received, setReceived] = useState<ReceivedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/friends");
    const data = await res.json();
    setFriendCode(data.friendCode);
    setFriends(data.friends);
    setReceived(data.received);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [load]);

  function inviteUrl() {
    return `${window.location.origin}/friends/join/${friendCode}`;
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <BackToHomeLink />
      <PageTour pageKey="friends" steps={TOUR_STEPS} />
      <div>
        <h1 className="text-2xl font-bold">Amigos</h1>
        <p className="mt-1 text-sm text-muted">
          Agrega amigos para mandarles títulos que crees que les van a gustar.
        </p>
      </div>

      {friendCode && (
        <div data-tour="tour-friends-invite" className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-white">Tu link para agregar amigos</p>
          <p className="mt-1 text-xs text-muted">Compártelo para que se agreguen mutuamente.</p>
          <button
            onClick={copyInvite}
            className="mt-3 w-full rounded-lg border border-white/15 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-white/30"
          >
            {copied ? "¡Copiado! ✓" : "Copiar link de invitación"}
          </button>
        </div>
      )}

      <div data-tour="tour-friends-received" className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-white">Te recomendaron</h2>
        {loading && <p className="text-center text-sm text-muted">Cargando…</p>}
        {!loading && received.length === 0 && (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
            Todavía no te recomendaron nada. Cuando un amigo te mande un título, aparece acá.
          </p>
        )}
        {received.length > 0 && (
          <div className="flex flex-col gap-3">
            {received.map((r) => (
              <Link
                key={r.id}
                href={`/title/${r.title.id}`}
                className="flex gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-white/30"
              >
                <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                  <Poster name={r.title.name} type={r.title.type} posterUrl={r.title.posterUrl} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  <p className="text-xs text-muted">
                    {r.from} · {DATE_LABEL.format(new Date(r.createdAt))}
                  </p>
                  <p className="truncate text-sm font-semibold text-white">
                    {r.title.name} {r.title.releaseYear ? <span className="text-neutral-500">({r.title.releaseYear})</span> : null}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-white">Tus amigos</h2>
        {!loading && friends.length === 0 && (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
            Todavía no tienes amigos agregados. Comparte tu link de invitación arriba.
          </p>
        )}
        {friends.length > 0 && (
          <div className="flex flex-col gap-2">
            {friends.map((f) => (
              <div key={f.id} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-neutral-200">
                {f.name || f.email}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
