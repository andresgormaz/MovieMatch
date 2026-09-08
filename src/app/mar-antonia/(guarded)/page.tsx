"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SLEEP_TYPE_LABEL } from "@/lib/marAntonia/activityTypes";

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
type ActivityType = "MEAL" | "SLEEP" | "MILK" | "NIGHT_WAKE" | "DIAPER";
type SleepType = "SIESTA" | "NOCHE";
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
  sleepType: SleepType | null;
  sleepEndedAt: string | null;
}
interface DaySummary {
  date: string;
  count: number;
}

const ROLE_LABEL: Record<CaregiverInfo["role"], string> = { MAMA: "Mamá", PAPA: "Papá" };

// SLEEP has no entry here -- siesta and dormir (overnight) are two fully
// separate quick-log buttons with their own icon/label, keyed by sleepType
// instead of activity type. See QUICK_LOG_BUTTONS and activityIconLabel.
const TYPE_CONFIG: Record<Exclude<ActivityType, "SLEEP">, { label: string; icon: string }> = {
  MEAL: { label: "Comida", icon: "🍽️" },
  MILK: { label: "Leche", icon: "🍼" },
  NIGHT_WAKE: { label: "Despertada", icon: "🌙" },
  DIAPER: { label: "Pañal", icon: "🧷" },
};

const SLEEP_TYPE_ICON: Record<SleepType, string> = {
  SIESTA: "😴",
  NOCHE: "🛌",
};

type QuickLogButton = {
  key: string;
  label: string;
  icon: string;
  activityType: ActivityType;
  sleepType?: SleepType;
};

const QUICK_LOG_BUTTONS: QuickLogButton[] = [
  { key: "MEAL", label: TYPE_CONFIG.MEAL.label, icon: TYPE_CONFIG.MEAL.icon, activityType: "MEAL" },
  { key: "SIESTA", label: "Siesta", icon: SLEEP_TYPE_ICON.SIESTA, activityType: "SLEEP", sleepType: "SIESTA" },
  { key: "MILK", label: TYPE_CONFIG.MILK.label, icon: TYPE_CONFIG.MILK.icon, activityType: "MILK" },
  {
    key: "NIGHT_WAKE",
    label: TYPE_CONFIG.NIGHT_WAKE.label,
    icon: TYPE_CONFIG.NIGHT_WAKE.icon,
    activityType: "NIGHT_WAKE",
  },
  { key: "DIAPER", label: TYPE_CONFIG.DIAPER.label, icon: TYPE_CONFIG.DIAPER.icon, activityType: "DIAPER" },
  { key: "DORMIR", label: "Dormir", icon: SLEEP_TYPE_ICON.NOCHE, activityType: "SLEEP", sleepType: "NOCHE" },
];

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
  if (a.type === "SLEEP") {
    return a.sleepEndedAt ? `hasta ${formatTime(a.sleepEndedAt)}` : "en curso";
  }
  return null;
}

// Siesta and Dormir are separate categories from the user's point of view,
// so a SLEEP row shows its own icon/label by sleepType instead of a generic
// "Dormir" header for both (activityDetail above then only needs to carry
// the en-curso/hasta-status suffix).
function activityIconLabel(a: ActivityInfo): { icon: string; label: string } {
  if (a.type === "SLEEP") {
    const type = a.sleepType ?? "SIESTA";
    return { icon: SLEEP_TYPE_ICON[type], label: SLEEP_TYPE_LABEL[type] };
  }
  return TYPE_CONFIG[a.type];
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

function toTimeInputValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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
  // The calendar day the edited/created entry belongs to -- draftTime only
  // carries the hour/minute, this supplies the rest so an edit never jumps
  // to a different day-bucket just because the clock advanced.
  const [draftBaseDate, setDraftBaseDate] = useState<Date>(() => new Date());
  const [draftTime, setDraftTime] = useState("");
  const [draftMealQuality, setDraftMealQuality] = useState<ActivityInfo["mealQuality"]>(null);
  const [draftMilkOunces, setDraftMilkOunces] = useState("");
  const [draftWakeMood, setDraftWakeMood] = useState<ActivityInfo["wakeMood"]>(null);
  const [draftDiaperContent, setDraftDiaperContent] = useState<ActivityInfo["diaperContent"]>(null);
  const [draftDiaperAmount, setDraftDiaperAmount] = useState<ActivityInfo["diaperAmount"]>(null);
  const [draftDiaperConsistency, setDraftDiaperConsistency] = useState<ActivityInfo["diaperConsistency"]>(null);
  const [draftSleepType, setDraftSleepType] = useState<SleepType | null>(null);
  // Create-mode only ("¿inicio o fin?") -- edit mode fixes both times of an
  // existing session directly instead, see draftSleepEnded below.
  const [draftSleepPhase, setDraftSleepPhase] = useState<"START" | "END" | null>(null);
  // Create-mode phase=END only: the session a "fin" tap is about to close,
  // fetched once a subtype is picked -- "loading" while in flight, null once
  // fetched and nothing is open.
  const [openSleepSession, setOpenSleepSession] = useState<ActivityInfo | "loading" | null>(null);
  // Edit-mode only: whether the session being edited already has an end
  // time, and that time itself (empty draftSleepEndTime means "clear it
  // back to in-progress" on save).
  const [draftSleepEnded, setDraftSleepEnded] = useState(false);
  const [draftSleepEndTime, setDraftSleepEndTime] = useState("");
  const [draftSleepEndBaseDate, setDraftSleepEndBaseDate] = useState<Date>(() => new Date());
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

  useEffect(() => {
    if (editingContext || expandedType !== "SLEEP" || draftSleepPhase !== "END" || !draftSleepType) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the open-session lookup for the "fin" panel
    setOpenSleepSession("loading");
    fetch(`/api/mar-antonia/activities/sleep?sleepType=${draftSleepType}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setOpenSleepSession(data.activity ?? null);
      })
      .catch(() => {
        if (!cancelled) setOpenSleepSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [editingContext, expandedType, draftSleepPhase, draftSleepType]);

  function resetDraft() {
    setError(null);
    setDraftMealQuality(null);
    setDraftMilkOunces("");
    setDraftWakeMood(null);
    setDraftDiaperContent(null);
    setDraftDiaperAmount(null);
    setDraftDiaperConsistency(null);
    setDraftSleepType(null);
    setDraftSleepPhase(null);
    setOpenSleepSession(null);
    setDraftSleepEnded(false);
    setDraftSleepEndTime("");
  }

  function isQuickLogButtonActive(button: QuickLogButton) {
    return (
      !editingContext &&
      expandedType === button.activityType &&
      (button.activityType !== "SLEEP" || draftSleepType === button.sleepType)
    );
  }

  function openCreate(button: QuickLogButton) {
    if (isQuickLogButtonActive(button)) {
      setExpandedType(null);
      return;
    }
    setEditingContext(null);
    setExpandedType(button.activityType);
    resetDraft();
    setDraftCaregiverId(myCaregiverId);
    // Siesta/Dormir are separate buttons, so the subtype is fixed by which
    // one was tapped -- no picker needed to choose it.
    if (button.sleepType) setDraftSleepType(button.sleepType);
    const now = new Date();
    setDraftBaseDate(now);
    setDraftTime(toTimeInputValue(now));
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
    setDraftSleepType(activity.sleepType);
    const occurredAt = new Date(activity.occurredAt);
    setDraftBaseDate(occurredAt);
    setDraftTime(toTimeInputValue(occurredAt));
    const ended = activity.sleepEndedAt != null;
    setDraftSleepEnded(ended);
    const endBase = ended ? new Date(activity.sleepEndedAt!) : new Date();
    setDraftSleepEndBaseDate(endBase);
    setDraftSleepEndTime(toTimeInputValue(endBase));
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

    // SLEEP doesn't fit the single-instant/single-detail shape the rest of
    // this function assumes (start vs. end are two different requests, and
    // "fin" doesn't take a manual time at all) -- handled entirely on its
    // own below.
    if (expandedType === "SLEEP") {
      await saveSleepActivity();
      return;
    }

    if (!draftTime) {
      setError("Elige una hora.");
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

    const [hours, minutes] = draftTime.split(":").map(Number);
    const occurredAt = new Date(draftBaseDate);
    occurredAt.setHours(hours, minutes, 0, 0);

    const isPoop = expandedType === "DIAPER" && draftDiaperContent === "POOP";
    const detail = {
      occurredAt: occurredAt.toISOString(),
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

  async function saveSleepActivity() {
    if (!draftSleepType) {
      setError("Elige si es siesta o noche.");
      return;
    }

    if (editingContext) {
      // Editing an existing session: both times are directly fixable, and
      // an end time can be cleared back to "en curso".
      if (!draftTime) {
        setError("Elige una hora.");
        return;
      }
      if (draftSleepEnded && !draftSleepEndTime) {
        setError("Elige la hora de fin.");
        return;
      }
      const [hours, minutes] = draftTime.split(":").map(Number);
      const occurredAt = new Date(draftBaseDate);
      occurredAt.setHours(hours, minutes, 0, 0);

      let sleepEndedAt: string | null = null;
      if (draftSleepEnded) {
        const [endHours, endMinutes] = draftSleepEndTime.split(":").map(Number);
        const endedAt = new Date(draftSleepEndBaseDate);
        endedAt.setHours(endHours, endMinutes, 0, 0);
        sleepEndedAt = endedAt.toISOString();
      }

      setSaving(true);
      setError(null);
      const res = await fetch(`/api/mar-antonia/activities/${editingContext.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caregiverId: draftCaregiverId,
          occurredAt: occurredAt.toISOString(),
          sleepType: draftSleepType,
          sleepEndedAt,
        }),
      });
      setSaving(false);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo guardar. Inténtalo de nuevo.");
        return;
      }
      const dayKey = editingContext.dayKey;
      closePanel();
      afterMutation(dayKey);
      return;
    }

    if (!draftSleepPhase) {
      setError(draftSleepType === "NOCHE" ? "Elige si es hacer dormir o despertar." : "Elige si es inicio o fin.");
      return;
    }

    if (draftSleepPhase === "START") {
      if (!draftTime) {
        setError("Elige una hora.");
        return;
      }
      const [hours, minutes] = draftTime.split(":").map(Number);
      const occurredAt = new Date(draftBaseDate);
      occurredAt.setHours(hours, minutes, 0, 0);

      setSaving(true);
      setError(null);
      const res = await fetch("/api/mar-antonia/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "SLEEP",
          sleepType: draftSleepType,
          caregiverId: draftCaregiverId,
          occurredAt: occurredAt.toISOString(),
        }),
      });
      setSaving(false);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo guardar. Inténtalo de nuevo.");
        return;
      }
      closePanel();
      afterMutation(TODAY);
      return;
    }

    // phase === "END" -- no manual time here, the end is always the system
    // clock at the moment this is saved.
    if (!openSleepSession || openSleepSession === "loading") {
      setError(`No hay ninguna sesión de ${SLEEP_TYPE_LABEL[draftSleepType].toLowerCase()} en curso.`);
      return;
    }

    setSaving(true);
    setError(null);
    const res = await fetch("/api/mar-antonia/activities/sleep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sleepType: draftSleepType, caregiverId: draftCaregiverId }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar. Inténtalo de nuevo.");
      return;
    }
    closePanel();
    // The closed session's start could belong to an earlier day (an
    // overnight "noche"), so a full reload is simpler and safer than
    // guessing which day-bucket to refresh.
    await load();
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
    const { icon, label } = activityIconLabel(a);
    return (
      <li key={a.id}>
        <button
          onClick={() => openEdit(a, dayKey)}
          className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-surface px-3 py-2 text-left text-sm hover:border-white/30 transition-colors"
        >
          <span className="text-lg">{icon}</span>
          <span className="flex-1">{label}</span>
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

      <div className="grid grid-cols-3 gap-2">
        {QUICK_LOG_BUTTONS.map((button) => (
          <button
            key={button.key}
            onClick={() => openCreate(button)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-3 text-xs font-semibold transition-colors ${
              isQuickLogButtonActive(button)
                ? "border-accent bg-accent/15 text-white"
                : "border-border bg-surface text-neutral-300 hover:border-white/30"
            }`}
          >
            <span className="text-xl">{button.icon}</span>
            {button.label}
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

          {expandedType === "SLEEP" && !editingContext && (
            <PillGroup
              label={draftSleepType === "NOCHE" ? "¿Hacer dormir o despertar?" : "¿Inicio o fin?"}
              options={
                draftSleepType === "NOCHE"
                  ? [
                      { value: "START" as const, label: "Hacer dormir" },
                      { value: "END" as const, label: "Despertar" },
                    ]
                  : [
                      { value: "START" as const, label: "Inicio" },
                      { value: "END" as const, label: "Fin" },
                    ]
              }
              value={draftSleepPhase}
              onChange={setDraftSleepPhase}
            />
          )}

          {(expandedType !== "SLEEP" || editingContext || draftSleepPhase === "START") && (
            <div className="flex flex-col gap-2">
              <label htmlFor="activity-time" className="text-sm font-semibold text-white">
                {expandedType === "SLEEP" ? "Hora de inicio" : "¿A qué hora?"}
              </label>
              <input
                id="activity-time"
                type="time"
                value={draftTime}
                onChange={(e) => setDraftTime(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          )}

          {expandedType === "SLEEP" && !editingContext && draftSleepPhase === "END" && draftSleepType && (
            <p className="text-sm text-muted">
              {openSleepSession === "loading" && "Buscando…"}
              {openSleepSession === null &&
                `No hay ninguna sesión de ${SLEEP_TYPE_LABEL[draftSleepType].toLowerCase()} en curso.`}
              {openSleepSession && openSleepSession !== "loading" && (
                <>
                  Empezó a las {formatTime(openSleepSession.occurredAt)}.{" "}
                  {draftSleepType === "NOCHE"
                    ? "Se registrará el despertar con la hora actual."
                    : "Se registrará el fin con la hora actual."}
                </>
              )}
            </p>
          )}

          {expandedType === "SLEEP" && editingContext && (
            <PillGroup
              label="¿Terminó?"
              options={[
                { value: "yes" as const, label: "Sí" },
                { value: "no" as const, label: "Todavía no" },
              ]}
              value={draftSleepEnded ? "yes" : "no"}
              onChange={(v) => setDraftSleepEnded(v === "yes")}
            />
          )}

          {expandedType === "SLEEP" && editingContext && draftSleepEnded && (
            <div className="flex flex-col gap-2">
              <label htmlFor="sleep-end-time" className="text-sm font-semibold text-white">
                Hora de fin
              </label>
              <input
                id="sleep-end-time"
                type="time"
                value={draftSleepEndTime}
                onChange={(e) => setDraftSleepEndTime(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          )}

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
              disabled={
                saving ||
                (expandedType === "SLEEP" &&
                  !editingContext &&
                  draftSleepPhase === "END" &&
                  (!openSleepSession || openSleepSession === "loading"))
              }
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
