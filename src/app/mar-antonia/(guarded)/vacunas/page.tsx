"use client";

import { useCallback, useEffect, useState } from "react";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { CHILE_VACCINE_SCHEDULE, type VaccineDose } from "@/lib/marAntonia/vaccineSchedule";

interface CaregiverInfo {
  id: string;
  name: string | null;
  email: string;
  role: "MAMA" | "PAPA";
  isYou: boolean;
}
interface DoseRecord {
  id: string;
  vaccineKey: string;
  givenAt: string | null;
  caregiverId: string | null;
}

const ROLE_LABEL: Record<CaregiverInfo["role"], string> = { MAMA: "Mamá", PAPA: "Papá" };

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export default function MarAntoniaVacunasPage() {
  const [caregivers, setCaregivers] = useState<CaregiverInfo[]>([]);
  const [doses, setDoses] = useState<Record<string, DoseRecord>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [currentRes, vaccinesRes] = await Promise.all([
      fetch("/api/mar-antonia/children/current"),
      fetch("/api/mar-antonia/vaccines"),
    ]);
    const { caregivers: cg } = await currentRes.json();
    const { doses: given } = await vaccinesRes.json();
    setCaregivers(cg);
    setDoses(Object.fromEntries((given as DoseRecord[]).map((d) => [d.vaccineKey, d])));
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    load();
  }, [load]);

  async function markGiven(key: string, dateStr: string, caregiverId: string) {
    const res = await fetch(`/api/mar-antonia/vaccines/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caregiverId, givenAt: new Date(`${dateStr}T12:00:00`).toISOString() }),
    });
    if (res.ok) {
      const { dose } = await res.json();
      setDoses((prev) => ({ ...prev, [key]: dose }));
    }
  }

  async function unmark(key: string) {
    await fetch(`/api/mar-antonia/vaccines/${key}`, { method: "DELETE" });
    setDoses((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <BackToHomeLink href="/mar-antonia" />
        <p className="text-center text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  const total = CHILE_VACCINE_SCHEDULE.reduce((sum, stage) => sum + stage.doses.length, 0);
  const givenCount = Object.keys(doses).length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <BackToHomeLink href="/mar-antonia" />
      <div>
        <h1 className="text-2xl font-bold text-white">Vacunas</h1>
        <p className="mt-1 text-sm text-muted">
          Calendario del Programa Nacional de Inmunizaciones (PNI) de Chile · {givenCount}/{total} dosis marcadas
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted">
        Referencia general del esquema público de vacunación en Chile. Puede haber actualizaciones o variar según tu
        caso -- confirma siempre con tu pediatra, el consultorio, o{" "}
        <span className="text-neutral-300">vacunas.minsal.cl</span> el esquema y las dosis vigentes.
      </div>

      <div className="flex flex-col gap-4">
        {CHILE_VACCINE_SCHEDULE.map((stage) => (
          <div key={stage.ageLabel} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-white">{stage.ageLabel}</h2>
            <div className="flex flex-col gap-2">
              {stage.doses.map((dose) => (
                <DoseRow
                  key={dose.key}
                  dose={dose}
                  record={doses[dose.key] ?? null}
                  caregivers={caregivers}
                  onMark={markGiven}
                  onUnmark={unmark}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DoseRow({
  dose,
  record,
  caregivers,
  onMark,
  onUnmark,
}: {
  dose: VaccineDose;
  record: DoseRecord | null;
  caregivers: CaregiverInfo[];
  onMark: (key: string, dateStr: string, caregiverId: string) => void;
  onUnmark: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState(() => toDateInputValue(new Date()));
  const [caregiverDraft, setCaregiverDraft] = useState<string | null>(
    caregivers.find((c) => c.isYou)?.id ?? caregivers[0]?.id ?? null,
  );

  const given = record?.givenAt != null;

  function toggleOpen() {
    if (!open && record?.givenAt) setDateDraft(toDateInputValue(new Date(record.givenAt)));
    setOpen((v) => !v);
  }

  return (
    <div
      data-testid={`vaccine-dose-${dose.key}`}
      className={`rounded-xl border p-3 ${given ? "border-accent/40 bg-accent/5" : "border-border bg-surface"}`}
    >
      <button onClick={toggleOpen} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-white">
            {dose.vaccine} <span className="font-normal text-muted">· {dose.doseLabel}</span>
          </span>
          <span className="text-xs text-neutral-400">Protege contra: {dose.protectsAgainst}</span>
          {dose.notes && <span className="text-xs text-neutral-500">{dose.notes}</span>}
        </div>
        <span className={`shrink-0 text-xs font-semibold ${given ? "text-accent-hover" : "text-neutral-500"}`}>
          {given ? `✓ ${formatDate(record!.givenAt!)}` : "Pendiente"}
        </span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-white">¿Qué día se puso?</label>
            <input
              type="date"
              value={dateDraft}
              onChange={(e) => setDateDraft(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-white">¿Quién lo registra?</span>
            <div className="flex gap-2">
              {caregivers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCaregiverDraft(c.id)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    caregiverDraft === c.id
                      ? "border-accent bg-accent/15 text-white"
                      : "border-white/15 text-neutral-300 hover:border-white/30"
                  }`}
                >
                  {ROLE_LABEL[c.role]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (caregiverDraft) onMark(dose.key, dateDraft, caregiverDraft);
                setOpen(false);
              }}
              className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
            >
              {given ? "Guardar cambios" : "Marcar como puesta"}
            </button>
            {given && (
              <button
                onClick={() => {
                  onUnmark(dose.key);
                  setOpen(false);
                }}
                className="rounded-lg border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Quitar
              </button>
            )}
            <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-white transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
