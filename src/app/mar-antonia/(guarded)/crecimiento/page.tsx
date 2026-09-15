"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import {
  referenceBand,
  MEASURE_LABEL,
  MEASURE_UNIT,
  type GrowthMeasure,
  type ChildSex,
} from "@/lib/marAntonia/growthStandards";

interface ChildInfo {
  id: string;
  birthDate: string | null;
  sex: ChildSex | null;
}
interface CaregiverInfo {
  id: string;
  name: string | null;
  email: string;
  role: "MAMA" | "PAPA";
  isYou: boolean;
}
interface MeasurementInfo {
  id: string;
  occurredAt: string;
  caregiverId: string | null;
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
}

const ROLE_LABEL: Record<CaregiverInfo["role"], string> = { MAMA: "Mamá", PAPA: "Papá" };
const MEASURES: GrowthMeasure[] = ["weight", "height", "headCircumference"];
const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.4375;

function monthsBetween(birthIso: string, dateIso: string): number {
  return (new Date(dateIso).getTime() - new Date(birthIso).getTime()) / MS_PER_MONTH;
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export default function MarAntoniaCrecimientoPage() {
  const [child, setChild] = useState<ChildInfo | null>(null);
  const [caregivers, setCaregivers] = useState<CaregiverInfo[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftCaregiverId, setDraftCaregiverId] = useState<string | null>(null);
  const [draftWeight, setDraftWeight] = useState("");
  const [draftHeight, setDraftHeight] = useState("");
  const [draftHead, setDraftHead] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [currentRes, growthRes] = await Promise.all([
      fetch("/api/mar-antonia/children/current"),
      fetch("/api/mar-antonia/growth"),
    ]);
    const { child: c, caregivers: cg } = await currentRes.json();
    const { measurements: ms } = await growthRes.json();
    setChild(c);
    setCaregivers(cg);
    setMeasurements(ms);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setDraftDate(toDateInputValue(new Date()));
    setDraftCaregiverId(caregivers.find((c) => c.isYou)?.id ?? caregivers[0]?.id ?? null);
    setDraftWeight("");
    setDraftHeight("");
    setDraftHead("");
    setError(null);
    setFormOpen(true);
  }

  function openEdit(m: MeasurementInfo) {
    setEditingId(m.id);
    setDraftDate(toDateInputValue(new Date(m.occurredAt)));
    setDraftCaregiverId(m.caregiverId);
    setDraftWeight(m.weightKg != null ? String(m.weightKg) : "");
    setDraftHeight(m.heightCm != null ? String(m.heightCm) : "");
    setDraftHead(m.headCircumferenceCm != null ? String(m.headCircumferenceCm) : "");
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  async function save() {
    if (!draftDate) {
      setError("Elige una fecha.");
      return;
    }
    if (!draftWeight && !draftHeight && !draftHead) {
      setError("Ingresa al menos una medida.");
      return;
    }
    const body: Record<string, unknown> = {
      occurredAt: new Date(`${draftDate}T12:00:00`).toISOString(),
    };
    // Create only accepts a present number or an omitted key (a bare number
    // field, not nullable) -- edit additionally accepts an explicit null to
    // clear a field that had a value and was cleared in the form. Sending
    // null on create would fail validation, so it's only included when
    // editing an existing row.
    if (draftWeight) body.weightKg = Number(draftWeight);
    else if (editingId) body.weightKg = null;
    if (draftHeight) body.heightCm = Number(draftHeight);
    else if (editingId) body.heightCm = null;
    if (draftHead) body.headCircumferenceCm = Number(draftHead);
    else if (editingId) body.headCircumferenceCm = null;
    if (!editingId) body.caregiverId = draftCaregiverId;

    setSaving(true);
    setError(null);
    const res = await fetch(editingId ? `/api/mar-antonia/growth/${editingId}` : "/api/mar-antonia/growth", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.error ?? "No se pudo guardar. Inténtalo de nuevo.");
      return;
    }
    closeForm();
    load();
  }

  async function remove(id: string) {
    setSaving(true);
    await fetch(`/api/mar-antonia/growth/${id}`, { method: "DELETE" });
    setSaving(false);
    closeForm();
    load();
  }

  if (loading || !child) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <BackToHomeLink href="/mar-antonia" />
        <p className="text-center text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  const missingBirthInfo = !child.birthDate || !child.sex;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <BackToHomeLink href="/mar-antonia" />
      <div>
        <h1 className="text-2xl font-bold text-white">Crecimiento</h1>
        <p className="mt-1 text-sm text-muted">
          Peso, estatura y circunferencia de cabeza que te da el pediatra en cada control.
        </p>
      </div>

      {missingBirthInfo && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Para mostrar las curvas de crecimiento necesitamos la fecha de nacimiento y el sexo.{" "}
          <Link href="/mar-antonia/ajustes" className="font-semibold underline">
            Complétalos en Ajustes
          </Link>
          . Igual puedes registrar medidas sin esto -- las curvas aparecen apenas estén los datos.
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted">
        Las bandas de las curvas son una referencia aproximada basada en los estándares de crecimiento de la OMS, no
        un percentil exacto. La evaluación oficial del crecimiento la hace tu pediatra.
      </div>

      {!formOpen && (
        <button
          onClick={openCreate}
          className="w-fit rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
        >
          + Registrar medida
        </button>
      )}

      {formOpen && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="growth-date" className="text-sm font-semibold text-white">
              ¿Qué día?
            </label>
            <input
              id="growth-date"
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          {!editingId && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-white">¿Quién lo registra?</span>
              <div className="flex gap-2">
                {caregivers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setDraftCaregiverId(c.id)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      draftCaregiverId === c.id
                        ? "border-accent bg-accent/15 text-white"
                        : "border-white/15 text-neutral-300 hover:border-white/30"
                    }`}
                  >
                    {ROLE_LABEL[c.role]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="growth-weight" className="text-xs font-semibold text-white">
                Peso (kg)
              </label>
              <input
                id="growth-weight"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={draftWeight}
                onChange={(e) => setDraftWeight(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="growth-height" className="text-xs font-semibold text-white">
                Estatura (cm)
              </label>
              <input
                id="growth-height"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={draftHeight}
                onChange={(e) => setDraftHeight(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="growth-head" className="text-xs font-semibold text-white">
                Cabeza (cm)
              </label>
              <input
                id="growth-head"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={draftHead}
                onChange={(e) => setDraftHead(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar"}
            </button>
            {editingId && (
              <button
                onClick={() => remove(editingId)}
                disabled={saving}
                className="rounded-lg border border-red-500/40 px-3 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                Eliminar
              </button>
            )}
            <button onClick={closeForm} className="rounded-lg px-3 py-2.5 text-sm text-muted hover:text-white transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {measurements.length === 0 ? (
        <p className="text-center text-sm text-muted">Todavía no hay medidas registradas.</p>
      ) : (
        <>
          {child.birthDate &&
            child.sex &&
            MEASURES.map((measure) => (
              <GrowthChart
                key={measure}
                measure={measure}
                sex={child.sex!}
                birthDate={child.birthDate!}
                measurements={measurements}
              />
            ))}

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-white">Historial</h2>
            <ul className="flex flex-col gap-1.5">
              {[...measurements].reverse().map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => openEdit(m)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm hover:border-white/30 transition-colors"
                  >
                    <span className="text-neutral-300">{formatDate(m.occurredAt)}</span>
                    <span className="text-muted">
                      {[
                        m.weightKg != null ? `${m.weightKg} kg` : null,
                        m.heightCm != null ? `${m.heightCm} cm` : null,
                        m.headCircumferenceCm != null ? `${m.headCircumferenceCm} cm cabeza` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function measurementValue(m: MeasurementInfo, measure: GrowthMeasure): number | null {
  if (measure === "weight") return m.weightKg;
  if (measure === "height") return m.heightCm;
  return m.headCircumferenceCm;
}

function GrowthChart({
  measure,
  sex,
  birthDate,
  measurements,
}: {
  measure: GrowthMeasure;
  sex: ChildSex;
  birthDate: string;
  measurements: MeasurementInfo[];
}) {
  const points = measurements
    .map((m) => ({ months: monthsBetween(birthDate, m.occurredAt), value: measurementValue(m, measure) }))
    .filter((p): p is { months: number; value: number } => p.value != null && p.months >= 0);

  if (points.length === 0) return null;

  const dataMaxMonths = Math.max(...points.map((p) => p.months));
  const xMax = Math.max(24, Math.ceil(dataMaxMonths));
  const band = referenceBand(measure, sex, Math.min(xMax, 24), 1);

  const allValues = [...band.map((b) => b.low), ...band.map((b) => b.high), ...points.map((p) => p.value)];
  const yMin = Math.min(...allValues) * 0.95;
  const yMax = Math.max(...allValues) * 1.05;

  const W = 600;
  const H = 260;
  const PAD_L = 40;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 28;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const x = (months: number) => PAD_L + (months / xMax) * plotW;
  const y = (value: number) => PAD_T + plotH - ((value - yMin) / (yMax - yMin)) * plotH;

  const bandAreaPath =
    `M ${band.map((b) => `${x(b.months)},${y(b.low)}`).join(" L ")} ` +
    `L ${[...band].reverse().map((b) => `${x(b.months)},${y(b.high)}`).join(" L ")} Z`;
  const medianPath = `M ${band.map((b) => `${x(b.months)},${y(b.median)}`).join(" L ")}`;
  const sortedPoints = [...points].sort((a, b) => a.months - b.months);
  const dataPath = `M ${sortedPoints.map((p) => `${x(p.months)},${y(p.value)}`).join(" L ")}`;

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTicks);
  const xTicks = xMax <= 24 ? [0, 6, 12, 18, 24].filter((t) => t <= xMax) : [0, 6, 12, 18, 24, xMax];

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <span className="text-sm font-semibold text-white">
        {MEASURE_LABEL[measure]} para la edad
      </span>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Curva de ${MEASURE_LABEL[measure]}`}>
        {yTickValues.map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <text x={PAD_L - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="rgba(255,255,255,0.4)">
              {v.toFixed(measure === "weight" ? 1 : 0)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={H - PAD_B + 14} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.4)">
            {t}m
          </text>
        ))}
        <path d={bandAreaPath} fill="rgba(255,255,255,0.08)" />
        <path d={medianPath} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={dataPath} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {sortedPoints.map((p) => (
          <circle key={`${p.months}-${p.value}`} cx={x(p.months)} cy={y(p.value)} r={3.5} fill="var(--accent)" />
        ))}
      </svg>
      <span className="text-xs text-muted">
        Banda gris: rango típico OMS aproximado ({MEASURE_UNIT[measure]}). Línea punteada: mediana. Línea sólida:{" "}
        {MEASURE_LABEL[measure].toLowerCase()} registrado.
      </span>
    </div>
  );
}
