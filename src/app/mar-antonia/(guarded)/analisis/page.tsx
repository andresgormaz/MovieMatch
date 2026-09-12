"use client";

import { useEffect, useState } from "react";
import { BackToHomeLink } from "@/components/BackToHomeLink";

interface NightRecord {
  date: string;
  bedtime: string;
  wakeTime: string | null;
  minutesToFallAsleep: number | null;
  totalSleepMinutes: number | null;
  nightWakeCount: number;
}

interface GroupStats {
  label: string;
  nights: number;
  avgNightWakeCount: number | null;
  avgMinutesToFallAsleep: number | null;
  avgTotalSleepMinutes: number | null;
}

interface Insight {
  factor: string;
  groups: GroupStats[];
}

interface AnalysisResponse {
  lookbackDays: number;
  totalNights: number;
  completedNights: number;
  minNightsPerGroup: number;
  nights: NightRecord[];
  insights: Insight[];
}

function formatMinutes(minutes: number | null) {
  if (minutes == null) return "—";
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function formatDay(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function MarAntoniaAnalisisPage() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mar-antonia/analysis/sleep")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "No se pudo cargar el análisis.");
        }
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <BackToHomeLink href="/mar-antonia" />
      <div>
        <h1 className="text-2xl font-bold text-white">Análisis de sueño</h1>
        <p className="mt-1 text-sm text-muted">Qué del día parece coincidir con mejores o peores noches.</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!data && !error && <p className="text-sm text-muted">Cargando…</p>}

      {data && (
        <>
          <p className="text-sm text-muted">
            {data.completedNights} noche{data.completedNights === 1 ? "" : "s"} completa
            {data.completedNights === 1 ? "" : "s"} registrada
            {data.completedNights === 1 ? "" : "s"} en los últimos {data.lookbackDays} días.
          </p>

          {data.insights.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
              Todavía no hay suficientes noches registradas (se necesitan al menos {data.minNightsPerGroup} en cada
              grupo a comparar) para sacar conclusiones. Sigan registrando y vuelvan a revisar en unos días.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {data.insights.map((insight) => (
                <InsightCard key={insight.factor} insight={insight} />
              ))}
            </div>
          )}

          {data.nights.length > 0 && (
            <details className="rounded-xl border border-border bg-surface p-3">
              <summary className="cursor-pointer text-sm font-semibold text-muted">
                Ver noche por noche ({data.nights.length})
              </summary>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {[...data.nights].reverse().map((n) => (
                  <li
                    key={n.bedtime}
                    className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5 last:border-0"
                  >
                    <span className="capitalize text-neutral-300">{formatDay(n.date)}</span>
                    <span className="text-muted">
                      {n.nightWakeCount} despertar{n.nightWakeCount === 1 ? "" : "es"} ·{" "}
                      {formatMinutes(n.totalSleepMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const [a, b] = insight.groups;
  const wakeA = a.avgNightWakeCount ?? 0;
  const wakeB = b.avgNightWakeCount ?? 0;
  const maxWake = Math.max(wakeA, wakeB, 0.1);
  const better = wakeA === wakeB ? null : wakeA < wakeB ? 0 : 1;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <span className="text-sm font-semibold text-white">{insight.factor}</span>
      <div className="flex flex-col gap-2.5">
        {insight.groups.map((g, i) => (
          <div key={g.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-xs text-neutral-300">
              <span>
                {g.label}
                {i === better && <span className="text-accent-hover"> · menos despertares</span>}
              </span>
              <span className="text-muted">n={g.nights}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full ${i === better ? "bg-accent" : "bg-white/25"}`}
                style={{ width: `${Math.max(6, ((g.avgNightWakeCount ?? 0) / maxWake) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted">
              {g.avgNightWakeCount?.toFixed(1) ?? "—"} despertares/noche en promedio
              {g.avgMinutesToFallAsleep != null && ` · tardó ${formatMinutes(g.avgMinutesToFallAsleep)} en dormirse`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
