"use client";

import { useState } from "react";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  onboardingCompletedAt: string | null;
  lastVisitAt: string | null;
  titlesRated: number;
  titlesSeenUnrated: number;
  notInterestedCount: number;
  avgScore: number | null;
  personRatings: number;
  wishlistCount: number;
  vsTotal: number;
  vsSkipped: number;
  totalActions: number;
  groups: string[];
}

const DATE_FORMAT = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function relative(iso: string | null): string {
  const days = daysAgo(iso);
  if (days === null) return "Nunca";
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

// Read-only usage snapshot for every registered account -- gated the same
// way as /admin/import (SEED_SECRET typed into the page, sent as a query
// param), not behind login, matching how the rest of /admin/* already
// works. See /api/admin/users for why there's no "time spent" figure here:
// nothing in this app tracks session duration, so this reports the
// activity counts that actually exist instead of inventing one.
export default function AdminUsersPage() {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);

  async function load() {
    if (!secret.trim()) {
      setError("Escribe el SEED_SECRET antes de cargar.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users?secret=${encodeURIComponent(secret.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setUsers(null);
    } finally {
      setLoading(false);
    }
  }

  const totals = users
    ? {
        count: users.length,
        onboardingDone: users.filter((u) => u.onboardingCompletedAt).length,
        titlesRated: users.reduce((sum, u) => sum + u.titlesRated, 0),
        totalActions: users.reduce((sum, u) => sum + u.totalActions, 0),
      }
    : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Usuarios registrados</h1>
        <p className="mt-1 text-sm text-muted">
          Avance de cada cuenta: onboarding, calificaciones, listas y última visita. La app no registra
          tiempo de uso (no hay analítica de sesiones) -- estos son los conteos reales que sí se guardan.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs text-muted" htmlFor="secret">
            SEED_SECRET
          </label>
          <input
            id="secret"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            disabled={loading}
            placeholder="El mismo secreto de siempre"
            onKeyDown={(e) => e.key === "Enter" && load()}
            className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-neutral-500 focus:border-accent disabled:opacity-50"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "Cargando…" : "Cargar"}
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-400">{error}</p>
      )}

      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Usuarios" value={String(totals.count)} />
          <SummaryCard label="Onboarding completo" value={`${totals.onboardingDone}/${totals.count}`} />
          <SummaryCard label="Títulos calificados" value={String(totals.titlesRated)} />
          <SummaryCard label="Acciones totales" value={String(totals.totalActions)} />
        </div>
      )}

      {users && (
        <div className="flex flex-col gap-3">
          {users.map((u) => (
            <UserCard key={u.id} user={u} />
          ))}
          {users.length === 0 && (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
              Todavía no hay ninguna cuenta registrada.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function UserCard({ user }: { user: AdminUser }) {
  const registered = daysAgo(user.createdAt);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-white">{user.name || "Sin nombre"}</p>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <div className="text-right text-xs text-muted">
          <p>
            Registrado el {DATE_FORMAT.format(new Date(user.createdAt))}
            {registered !== null && ` (hace ${registered} días)`}
          </p>
          <p>Última visita: {relative(user.lastVisitAt)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge ok={Boolean(user.onboardingCompletedAt)}>
          {user.onboardingCompletedAt
            ? `Onboarding completo (${DATE_FORMAT.format(new Date(user.onboardingCompletedAt))})`
            : "Onboarding incompleto"}
        </Badge>
        {user.groups.length > 0 ? (
          user.groups.map((g, i) => (
            <span
              key={i}
              className="rounded-full border border-white/15 px-2.5 py-1 text-xs font-medium text-neutral-300"
            >
              Grupo: {g}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-white/15 px-2.5 py-1 text-xs font-medium text-neutral-400">
            Sin grupos
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-4">
        <Stat label="Calificados" value={user.titlesRated} />
        <Stat label="Vistos sin calificar" value={user.titlesSeenUnrated} />
        <Stat label="No me interesa" value={user.notInterestedCount} />
        <Stat label="En su lista" value={user.wishlistCount} />
        <Stat label="Personas calificadas" value={user.personRatings} />
        <Stat label="VS jugados" value={`${user.vsTotal - user.vsSkipped} (${user.vsSkipped} saltados)`} />
        <Stat label="Nota promedio" value={user.avgScore != null ? user.avgScore.toFixed(1) : "—"} />
        <Stat label="Acciones totales" value={user.totalActions} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        ok ? "bg-accent/20 text-accent-hover" : "border border-white/15 text-neutral-400"
      }`}
    >
      {children}
    </span>
  );
}
