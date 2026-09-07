"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface ChildInfo {
  id: string;
  name: string;
}
interface CaregiverInfo {
  id: string;
  name: string | null;
  email: string;
  role: "MAMA" | "PAPA";
  isYou: boolean;
}
type ActivityType = "MEAL" | "NAP" | "MILK" | "NIGHT_WAKE" | "DIAPER";
interface ActivityInfo {
  id: string;
  type: ActivityType;
  occurredAt: string;
  caregiverId: string | null;
  mealQuality: "GOOD" | "REGULAR" | "BAD" | null;
  milkOunces: number | null;
  wakeMood: "CALM" | "CRYING" | null;
  diaperContent: "PEE" | "POOP" | null;
  diaperAmount: "LITTLE" | "A_LOT" | null;
  diaperConsistency: "NORMAL" | "HARD" | "DIARRHEA" | null;
}
interface DaySummary {
  date: string;
  count: number;
}

const ROLE_LABEL: Record<CaregiverInfo["role"], string> = { MAMA: "Mamá", PAPA: "Papá" };

const TYPE_CONFIG: Record<ActivityType, { label: string; icon: string }> = {
  MEAL: { label: "Comida", icon: "🍽️" },
  NAP: { label: "Siesta", icon: "😴" },
  MILK: { label: "Leche", icon: "🍼" },
  NIGHT_WAKE: { label: "Despertada", icon: "🌙" },
  DIAPER: { label: "Pañal", icon: "🧷" },
};

const MEAL_QUALITY_LABEL: Record<NonNullable<ActivityInfo["mealQuality"]>, string> = {
  GOOD: "Bien",
  REGULAR: "Regular",
  BAD: "Mal",
};
const WAKE_MOOD_LABEL: Record<NonNullable<ActivityInfo["wakeMood"]>, string> = {
  CALM: "Tranquila",
  CRYING: "Llorando",
};
const DIAPER_CONTENT_LABEL: Record<NonNullable<ActivityInfo["diaperContent"]>, string> = {
  PEE: "Pipí",
  POOP: "Caca",
};
const DIAPER_AMOUNT_LABEL: Record<NonNullable<ActivityInfo["diaperAmount"]>, string> = {
  LITTLE: "poca",
  A_LOT: "mucha",
};
const DIAPER_CONSISTENCY_LABEL: Record<NonNullable<ActivityInfo["diaperConsistency"]>, string> = {
  NORMAL: "normal",
  HARD: "dura",
  DIARRHEA: "diarrea",
};

function activityDetail(a: ActivityInfo): string | null {
  if (a.type === "MEAL" && a.mealQuality) return MEAL_QUALITY_LABEL[a.mealQuality];
  if (a.type === "MILK" && a.milkOunces != null) return `${a.milkOunces} oz`;
  if (a.type === "NIGHT_WAKE" && a.wakeMood) return WAKE_MOOD_LABEL[a.wakeMood];
  if (a.type === "DIAPER" && a.diaperContent) {
    if (a.diaperContent === "POOP" && a.diaperAmount && a.diaperConsistency) {
      return `Caca (${DIAPER_AMOUNT_LABEL[a.diaperAmount]}, ${DIAPER_CONSISTENCY_LABEL[a.diaperConsistency]})`;
    }
    return DIAPER_CONTENT_LABEL[a.diaperContent];
  }
  return null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
}

function formatDay(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const TODAY = "today";

export default function MarAntoniaHomePage() {
  const [child, setChild] = useState<ChildInfo | null>(null);
  const [caregivers, setCaregivers] = useState<CaregiverInfo[]>([]);
  const [todayActivities, setTodayActivities] = useState<ActivityInfo[]>([]);
  const [pastDays, setPastDays] = useState<DaySummary[]>([]);
  const [pastDayActivities, setPastDayActivities] = useState<Record<string, ActivityInfo[]>>({});
  const [loading, setLoading] = useState(true);

  // dayKey is TODAY or a "YYYY-MM-DD" past date -- lets save/delete know
  // which bucket to refresh regardless of where the row being edited lives.
  const [expandedType, setExpandedType] = useState<ActivityType | null>(null);
  const [editingContext, setEditingContext] = useState<{ id: string; dayKey: string } | null>(null);
  const [draftCaregiverId, setDraftCaregiverId] = useState<string | null>(null);
  const [draftMealQuality, setDraftMealQuality] = useState<ActivityInfo["mealQuality"]>(null);
  const [draftMilkOunces, setDraftMilkOunces] = useState("");
  const [draftWakeMood, setDraftWakeMood] = useState<ActivityInfo["wakeMood"]>(null);
  const [draftDiaperContent, setDraftDiaperContent] = useState<ActivityInfo["diaperContent"]>(null);
  const [draftDiaperAmount, setDraftDiaperAmount] = useState<ActivityInfo["diaperAmount"]>(null);
  const [draftDiaperConsistency, setDraftDiaperConsistency] = useState<ActivityInfo["diaperConsistency"]>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myCaregiverId = useMemo(() => caregivers.find((c) => c.isYou)?.id ?? null, [caregivers]);

  const reloadToday = useCallback(async () => {
    const res = await fetch("/api/mar-antonia/activities");
    const { activities } = await res.json();
    setTodayActivities(activities);
  }, []);

  const reloadPastDay = useCallback(async (date: string) => {
    const res = await fetch(`/api/mar-antonia/activities?date=${date}`);
    const { activities } = await res.json();
    setPastDayActivities((prev) => ({ ...prev, [date]: activities }));
  }, []);

  const reloadPastDaysSummary = useCallback(async () => {
    const res = await fetch("/api/mar-antonia/activities/days");
    const { days } = await res.json();
    setPastDays(days);
  }, []);

  const load = useCallback(async () => {
    const currentRes = await fetch("/api/mar-antonia/children/current");
    if (!currentRes.ok) return;
    const { child: c } = await currentRes.json();
    setChild(c);

    const caregiversRes = await fetch(`/api/mar-antonia/children/${c.id}/caregivers`);
    const { caregivers: cg } = await caregiversRes.json();
    setCaregivers(cg);

    await Promise.all([reloadToday(), reloadPastDaysSummary()]);
    setLoading(false);
  }, [reloadToday, reloadPastDaysSummary]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    load();
  }, [load]);

  function resetDraft() {
    setError(null);
    setDraftMealQuality(null);
    setDraftMilkOunces("");
    setDraftWakeMood(null);
    setDraftDiaperContent(null);
    setDraftDiaperAmount(null);
    setDraftDiaperConsistency(null);
  }

  function openCreate(type: ActivityType) {
    if (!editingContext && expandedType === type) {
      setExpandedType(null);
      return;
    }
    setEditingContext(null);
    setExpandedType(type);
    resetDraft();
    setDraftCaregiverId(myCaregiverId);
  }

  function openEdit(activity: ActivityInfo, dayKey: string) {
    setEditingContext({ id: activity.id, dayKey });
    setExpandedType(activity.type);
    resetDraft();
    setDraftCaregiverId(activity.caregiverId);
    setDraftMealQuality(activity.mealQuality);
    setDraftMilkOunces(activity.milkOunces != null ? String(activity.milkOunces) : "");
    setDraftWakeMood(activity.wakeMood);
    setDraftDiaperContent(activity.diaperContent);
    setDraftDiaperAmount(activity.diaperAmount);
    setDraftDiaperConsistency(activity.diaperConsistency);
  }

  function closePanel() {
    setExpandedType(null);
    setEditingContext(null);
  }

  async function afterMutation(dayKey: string) {
    if (dayKey === TODAY) {
      await reloadToday();
    } else {
      await reloadPastDay(dayKey);
      await reloadPastDaysSummary();
    }
  }

  async function saveActivity() {
    if (!expandedType) return;
    if (!draftCaregiverId) {
      setError("Elige quién lo registra.");
      return;
    }
    if (expandedType === "MEAL" && !draftMealQuality) {
      setError("Elige cómo comió.");
      return;
    }
    if (expandedType === "MILK" && !draftMilkOunces) {
      setError("Escribe cuántas onzas.");
      return;
    }
    if (expandedType === "NIGHT_WAKE" && !draftWakeMood) {
      setError("Elige cómo se despertó.");
      return;
    }
    if (expandedType === "DIAPER" && !draftDiaperContent) {
      setError("Elige qué tenía el pañal.");
      return;
    }
    if (expandedType === "DIAPER" && draftDiaperContent === "POOP" && !draftDiaperAmount) {
      setError("Elige cuánta caca tenía.");
      return;
    }
    if (expandedType === "DIAPER" && draftDiaperContent === "POOP" && !draftDiaperConsistency) {
      setError("Elige cómo era la caca.");
      return;
    }

    const isPoop = expandedType === "DIAPER" && draftDiaperContent === "POOP";
    const detail = {
      mealQuality: expandedType === "MEAL" ? draftMealQuality : undefined,
      milkOunces: expandedType === "MILK" ? Number(draftMilkOunces) : undefined,
      wakeMood: expandedType === "NIGHT_WAKE" ? draftWakeMood : undefined,
      diaperContent: expandedType === "DIAPER" ? draftDiaperContent : undefined,
      // Explicit null (not just omitted) so editing a POOP diaper back to
      // PEE actually clears these instead of leaving the old values stored.
      diaperAmount: isPoop ? draftDiaperAmount : expandedType === "DIAPER" ? null : undefined,
      diaperConsistency: isPoop ? draftDiaperConsistency : expandedType === "DIAPER" ? null : undefined,
    };

    setSaving(true);
    setError(null);
    const res = editingContext
      ? await fetch(`/api/mar-antonia/activities/${editingContext.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caregiverId: draftCaregiverId, ...detail }),
        })
      : await fetch("/api/mar-antonia/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: expandedType, caregiverId: draftCaregiverId, ...detail }),
        });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar. Inténtalo de nuevo.");
      return;
    }
    const dayKey = editingContext?.dayKey ?? TODAY;
    closePanel();
    afterMutation(dayKey);
  }

  async function deleteActivity() {
    if (!editingContext) return;
    setSaving(true);
    await fetch(`/api/mar-antonia/activities/${editingContext.id}`, { method: "DELETE" });
    setSaving(false);
    const dayKey = editingContext.dayKey;
    closePanel();
    afterMutation(dayKey);
  }

  function handlePastDayToggle(date: string, open: boolean) {
    if (open && !pastDayActivities[date]) reloadPastDay(date);
  }

  function renderRow(a: ActivityInfo, dayKey: string) {
    const caregiverRole = caregivers.find((c) => c.id === a.caregiverId)?.role;
    const detail = activityDetail(a);
    return (
      <li key={a.id}>
        <button
          onClick={() => openEdit(a, dayKey)}
          className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-surface px-3 py-2 text-left text-sm hover:border-white/30 transition-colors"
        >
          <span className="text-lg">{TYPE_CONFIG[a.type].icon}</span>
          <span className="flex-1">{TYPE_CONFIG[a.type].label}</span>
          <span className="text-muted">{formatTime(a.occurredAt)}</span>
          {caregiverRole && <span className="text-xs text-neutral-500">{ROLE_LABEL[caregiverRole]}</span>}
          {detail && <span className="text-xs font-semibold text-accent-hover">{detail}</span>}
        </button>
      </li>
    );
  }

  if (loading || !child) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <p className="text-center text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Hola 👋</h1>
        <p className="mt-1 text-sm text-muted">{child.name}</p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {(Object.keys(TYPE_CONFIG) as ActivityType[]).map((type) => (
          <button
            key={type}
            onClick={() => openCreate(type)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-3 text-xs font-semibold transition-colors ${
              !editingContext && expandedType === type
                ? "border-accent bg-accent/15 text-white"
                : "border-border bg-surface text-neutral-300 hover:border-white/30"
            }`}
          >
            <span className="text-xl">{TYPE_CONFIG[type].icon}</span>
            {TYPE_CONFIG[type].label}
          </button>
        ))}
      </div>

      {expandedType && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
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

          {expandedType === "MEAL" && (
            <PillGroup
              label="¿Cómo comió?"
              options={[
                { value: "GOOD" as const, label: "Bien" },
                { value: "REGULAR" as const, label: "Regular" },
                { value: "BAD" as const, label: "Mal" },
              ]}
              value={draftMealQuality}
              onChange={setDraftMealQuality}
            />
          )}

          {expandedType === "MILK" && (
            <div className="flex flex-col gap-2">
              <label htmlFor="milk-ounces" className="text-sm font-semibold text-white">
                ¿Cuántas onzas?
              </label>
              <input
                id="milk-ounces"
                type="number"
                step="0.5"
                min="0"
                value={draftMilkOunces}
                onChange={(e) => setDraftMilkOunces(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          )}

          {expandedType === "NIGHT_WAKE" && (
            <PillGroup
              label="¿Cómo se despertó?"
              options={[
                { value: "CALM" as const, label: "Tranquila" },
                { value: "CRYING" as const, label: "Llorando" },
              ]}
              value={draftWakeMood}
              onChange={setDraftWakeMood}
            />
          )}

          {expandedType === "DIAPER" && (
            <>
              <PillGroup
                label="¿Qué tenía?"
                options={[
                  { value: "PEE" as const, label: "Pipí" },
                  { value: "POOP" as const, label: "Caca" },
                ]}
                value={draftDiaperContent}
                onChange={(v) => {
                  setDraftDiaperContent(v);
                  // Amount/consistency only make sense for POOP -- clear
                  // them if the pill switches back to PEE.
                  if (v === "PEE") {
                    setDraftDiaperAmount(null);
                    setDraftDiaperConsistency(null);
                  }
                }}
              />
              {draftDiaperContent === "POOP" && (
                <>
                  <PillGroup
                    label="¿Cuánta?"
                    options={[
                      { value: "LITTLE" as const, label: "Poca" },
                      { value: "A_LOT" as const, label: "Mucha" },
                    ]}
                    value={draftDiaperAmount}
                    onChange={setDraftDiaperAmount}
                  />
                  <PillGroup
                    label="¿Cómo era?"
                    options={[
                      { value: "NORMAL" as const, label: "Normal" },
                      { value: "HARD" as const, label: "Dura" },
                      { value: "DIARRHEA" as const, label: "Diarrea" },
                    ]}
                    value={draftDiaperConsistency}
                    onChange={setDraftDiaperConsistency}
                  />
                </>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={saveActivity}
              disabled={saving}
              className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando…" : editingContext ? "Guardar cambios" : "Guardar"}
            </button>
            {editingContext && (
              <button
                onClick={deleteActivity}
                disabled={saving}
                className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-red-400 hover:border-red-400/50 transition-colors disabled:opacity-50"
              >
                Eliminar
              </button>
            )}
            <button onClick={closePanel} className="rounded-lg px-3 py-2.5 text-sm text-muted hover:text-white transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {todayActivities.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Todavía no registraste nada hoy.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">{todayActivities.map((a) => renderRow(a, TODAY))}</ul>
      )}

      {pastDays.length > 0 && (
        <div className="flex flex-col gap-2">
          {pastDays.map((day) => (
            <details
              key={day.date}
              className="rounded-xl border border-border bg-surface p-3"
              onToggle={(e) => handlePastDayToggle(day.date, e.currentTarget.open)}
            >
              <summary className="cursor-pointer text-sm font-semibold capitalize text-muted">
                {formatDay(day.date)} ({day.count})
              </summary>
              <ul className="mt-3 flex flex-col gap-1.5">
                {(pastDayActivities[day.date] ?? []).map((a) => renderRow(a, day.date))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function PillGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-white">{label}</span>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              value === opt.value ? "border-accent bg-accent/15 text-white" : "border-white/15 text-neutral-300 hover:border-white/30"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
