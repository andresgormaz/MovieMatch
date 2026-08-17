"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BackToHomeLink } from "@/components/BackToHomeLink";

interface GroupMemberInfo {
  id: string;
  name: string | null;
  email: string;
}
interface GroupInfo {
  id: string;
  name: string | null;
  inviteCode: string;
  ownerId: string;
  members: GroupMemberInfo[];
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/groups");
    const data = await res.json();
    setGroups(data.groups);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    load();
  }, [load]);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName || undefined }),
    });
    setNewName("");
    setCreating(false);
    load();
  }

  async function leaveGroup(id: string) {
    await fetch(`/api/groups/${id}/leave`, { method: "POST" });
    load();
  }

  function inviteUrl(code: string) {
    return `${window.location.origin}/groups/join/${code}`;
  }

  async function copyInvite(group: GroupInfo) {
    await navigator.clipboard.writeText(inviteUrl(group.inviteCode));
    setCopiedId(group.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <BackToHomeLink />
      <div>
        <h1 className="text-2xl font-bold">Grupos</h1>
        <p className="mt-1 text-sm text-muted">
          Vincula tu cuenta con otras personas para recibir recomendaciones que combinan los
          gustos de todo el grupo y evitan lo que ya vio cualquiera de ustedes.
        </p>
      </div>

      <form onSubmit={createGroup} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre del grupo (opcional, ej: Con Ana)"
          className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          Crear grupo
        </button>
      </form>

      {loading && <p className="text-center text-sm text-muted">Cargando…</p>}

      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">{g.name || "Grupo sin nombre"}</h2>
              <Link
                href={`/groups/${g.id}`}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-hover transition-colors"
              >
                Ver recomendaciones
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted">
              Miembros: {g.members.map((m) => m.name || m.email).join(", ")}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => copyInvite(g)}
                className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-neutral-300 hover:border-white/30 transition-colors"
              >
                {copiedId === g.id ? "¡Copiado! ✓" : "Copiar link de invitación"}
              </button>
              <button
                onClick={() => leaveGroup(g.id)}
                className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-neutral-400 hover:border-accent hover:text-white transition-colors"
              >
                Salir del grupo
              </button>
            </div>
          </div>
        ))}
        {!loading && groups.length === 0 && (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
            Todavía no tienes grupos. Crea uno y comparte el link de invitación con quien quieras
            vincular.
          </p>
        )}
      </div>
    </div>
  );
}
