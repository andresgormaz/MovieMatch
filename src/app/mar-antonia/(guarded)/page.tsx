"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SLEEP_TYPE_LABEL, OUTING_TYPE_LABEL, MILK_OUNCES_OPTIONS } from "@/lib/marAntonia/activityTypes";

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
type ActivityType = "MEAL" | "SLEEP" | "MILK" | "NIGHT_WAKE" | "DIAPER" | "BATH" | "OUTING";
type SleepType = "SIESTA" | "NOCHE";
type OutingType = "CAR" | "PARK" | "FAMILY_VISIT" | "OTHER";
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
  sleepAchievedAt: string | null;
  outingType: OutingType | null;
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
  BATH: { label: "Baño", icon: "🛁" },
  OUTING: { label: "Paseo", icon: "🚗" },
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
  { key: "BATH", label: TYPE_CONFIG.BATH.label, icon: TYPE_CONFIG.BATH.icon, activityType: "BATH" },
  { key: "OUTING", label: TYPE_CONFIG.OUTING.label, icon: TYPE_CONFIG.OUTING.icon, activityType: "OUTING" },
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
    if (a.sleepType !== "NOCHE") {
      return a.sleepEndedAt ? `hasta ${formatTime(a.sleepEndedAt)}` : "en curso";
    }
    // NOCHE has a third checkpoint (sleepAchievedAt, "logrado") between
    // start and end -- shown as how long it took to fall asleep, separate
    // from the total sleep duration.
    if (!a.sleepAchievedAt) {
      return a.sleepEndedAt ? `hasta ${formatTime(a.sleepEndedAt)}` : "intentando dormir";
    }
    const toSleep = `tardó ${formatDurationMinutes(a.occurredAt, a.sleepAchievedAt)} en dormirse`;
    return a.sleepEndedAt ? `${toSleep} · hasta ${formatTime(a.sleepEndedAt)}` : `${toSleep} · durmiendo`;
  }
  if (a.type === "OUTING" && a.outingType) return OUTING_TYPE_LABEL[a.outingType];
  return null;
}

function formatDurationMinutes(startIso: string, endIso: string) {
  const minutes = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
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

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Builds a Date from separate "YYYY-MM-DD" and "HH:mm" input values, both in
// local time -- used instead of a single Date-typed draft so the date and
// time pickers can be two independent, directly-editable fields.
function combineDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
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
  // Scrolled into view whenever the quick-log panel opens -- tapping a row
  // buried in an already-expanded past day (far down the page) otherwise
  // opens the editor off-screen above, at the same spot every panel opens,
  // making it look like nothing happened.
  const panelRef = useRef<HTMLDivElement>(null);
  const [draftCaregiverId, setDraftCaregiverId] = useState<string | null>(null);
  // The calendar day the entry is logged under ("YYYY-MM-DD"), independently
  // editable from draftTime -- both default to now, but either can be
  // changed to backdate an entry (e.g. logging something from yesterday
  // that was forgotten in the moment).
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [draftMealQuality, setDraftMealQuality] = useState<ActivityInfo["mealQuality"]>(null);
  const [draftMilkOunces, setDraftMilkOunces] = useState("");
  const [draftWakeMood, setDraftWakeMood] = useState<ActivityInfo["wakeMood"]>(null);
  const [draftDiaperContent, setDraftDiaperContent] = useState<ActivityInfo["diaperContent"]>(null);
  const [draftDiaperAmount, setDraftDiaperAmount] = useState<ActivityInfo["diaperAmount"]>(null);
  const [draftDiaperConsistency, setDraftDiaperConsistency] = useState<ActivityInfo["diaperConsistency"]>(null);
  const [draftOutingType, setDraftOutingType] = useState<OutingType | null>(null);
  const [draftSleepType, setDraftSleepType] = useState<SleepType | null>(null);
  // Create-mode only ("¿inicio o fin?", or for NOCHE "¿hacer dormir o
  // despertar?") -- edit mode fixes both times of an existing session
  // directly instead, see draftSleepEnded below.
  const [draftSleepPhase, setDraftSleepPhase] = useState<"START" | "END" | null>(null);
  // Create-mode, NOCHE + phase="START" only: "hacer dormir" itself splits
  // into starting the bedtime attempt (INICIO) vs. marking that it worked
  // (LOGRADO) -- lets the time it took to fall asleep be tracked separately
  // from the total sleep duration. Siesta has no such middle step.
  const [draftSleepSubPhase, setDraftSleepSubPhase] = useState<"INICIO" | "LOGRADO" | null>(null);
  // Create-mode phase=END, or NOCHE subPhase=LOGRADO: the open session that
  // action is about to act on, fetched once enough of the picker is
  // resolved -- "loading" while in flight, null once fetched and nothing
  // (usable) is open.
  const [openSleepSession, setOpenSleepSession] = useState<ActivityInfo | "loading" | null>(null);
  // Edit-mode only: whether the session being edited already has an end
  // time, and that time itself (empty draftSleepEndTime means "clear it
  // back to in-progress" on save).
  const [draftSleepEnded, setDraftSleepEnded] = useState(false);
  const [draftSleepEndTime, setDraftSleepEndTime] = useState("");
  const [draftSleepEndDate, setDraftSleepEndDate] = useState("");
  // Edit-mode only, NOCHE entries only: same idea as draftSleepEnded/
  // draftSleepEndTime but for the "logrado" (sleepAchievedAt) checkpoint.
  const [draftSleepAchieved, setDraftSleepAchieved] = useState(false);
  const [draftSleepAchievedTime, setDraftSleepAchievedTime] = useState("");
  const [draftSleepAchievedDate, setDraftSleepAchievedDate] = useState("");
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
    // Every request here is a network round trip to a remote (Turso)
    // database, not a local query -- today's feed and the day summary don't
    // depend on the child/caregivers bootstrap at all, so firing all three
    // at once instead of waiting on the bootstrap first cuts real load time.
    const [currentRes] = await Promise.all([
      fetch("/api/mar-antonia/children/current"),
      reloadToday(),
      reloadPastDaysSummary(),
    ]);
    if (!currentRes.ok) return;
    const { child: c, caregivers: cg } = await currentRes.json();
    setChild(c);
    setCaregivers(cg);
    setLoading(false);
  }, [reloadToday, reloadPastDaysSummary]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    load();
  }, [load]);

  useEffect(() => {
    if (expandedType) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [expandedType, editingContext]);

  useEffect(() => {
    if (editingContext || expandedType !== "SLEEP" || !draftSleepType) return;
    const needsOpenSession =
      draftSleepPhase === "END" ||
      (draftSleepType === "NOCHE" && draftSleepPhase === "START" && draftSleepSubPhase === "LOGRADO") ||
      (draftSleepPhase === "START" && (draftSleepType !== "NOCHE" || draftSleepSubPhase === "INICIO"));
    if (!needsOpenSession) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the open-session lookup for the "fin"/"logrado" panel
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
  }, [editingContext, expandedType, draftSleepPhase, draftSleepSubPhase, draftSleepType]);

  function resetDraft() {
    setError(null);
    setDraftMealQuality(null);
    setDraftMilkOunces("");
    setDraftWakeMood(null);
    setDraftDiaperContent(null);
    setDraftDiaperAmount(null);
    setDraftDiaperConsistency(null);
    setDraftOutingType(null);
    setDraftSleepType(null);
    setDraftSleepPhase(null);
    setDraftSleepSubPhase(null);
    setOpenSleepSession(null);
    setDraftSleepEnded(false);
    setDraftSleepEndTime("");
    setDraftSleepAchieved(false);
    setDraftSleepAchievedTime("");
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
    setDraftDate(toDateInputValue(now));
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
    setDraftOutingType(activity.outingType);
    setDraftSleepType(activity.sleepType);
    const occurredAt = new Date(activity.occurredAt);
    setDraftDate(toDateInputValue(occurredAt));
    setDraftTime(toTimeInputValue(occurredAt));
    const ended = activity.sleepEndedAt != null;
    setDraftSleepEnded(ended);
    const endBase = ended ? new Date(activity.sleepEndedAt!) : new Date();
    setDraftSleepEndDate(toDateInputValue(endBase));
    setDraftSleepEndTime(toTimeInputValue(endBase));
    const achieved = activity.sleepAchievedAt != null;
    setDraftSleepAchieved(achieved);
    const achievedBase = achieved ? new Date(activity.sleepAchievedAt!) : new Date();
    setDraftSleepAchievedDate(toDateInputValue(achievedBase));
    setDraftSleepAchievedTime(toTimeInputValue(achievedBase));
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

  // Like afterMutation, but for a save where the date itself may have just
  // changed (creating or editing with a picked date, not just a time) -- the
  // entry can move to a completely different day-bucket than the one it was
  // opened from. Always refreshes today's feed and the day summary, and also
  // re-fetches whichever *past*-day buckets (the old one, the new one, or
  // both) are already cached/expanded, so neither shows stale data.
  async function refreshAfterSave(originalDayKey: string | null, occurredAtIso: string) {
    const occurredDate = new Date(occurredAtIso);
    const newDayKey = isSameLocalDay(occurredDate, new Date()) ? TODAY : toDateInputValue(occurredDate);

    await Promise.all([reloadToday(), reloadPastDaysSummary()]);

    const staleDayKeys = new Set<string>();
    if (originalDayKey && originalDayKey !== TODAY) staleDayKeys.add(originalDayKey);
    if (newDayKey !== TODAY) staleDayKeys.add(newDayKey);

    await Promise.all(
      [...staleDayKeys].filter((d) => pastDayActivities[d] !== undefined).map((d) => reloadPastDay(d)),
    );
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

    if (!draftDate) {
      setError("Elige una fecha.");
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
      setError("Elige cuántas onzas.");
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
    if (expandedType === "OUTING" && !draftOutingType) {
      setError("Elige el tipo de paseo.");
      return;
    }

    const occurredAt = combineDateTime(draftDate, draftTime);

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
      outingType: expandedType === "OUTING" ? draftOutingType : undefined,
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
    const originalDayKey = editingContext?.dayKey ?? null;
    closePanel();
    await refreshAfterSave(originalDayKey, occurredAt.toISOString());
  }

  async function saveSleepActivity() {
    if (!draftSleepType) {
      setError("Elige si es siesta o noche.");
      return;
    }

    if (editingContext) {
      // Editing an existing session: both times (and now both dates) are
      // directly fixable, and an end time can be cleared back to "en curso".
      if (!draftDate) {
        setError("Elige una fecha.");
        return;
      }
      if (!draftTime) {
        setError("Elige una hora.");
        return;
      }
      if (draftSleepEnded && (!draftSleepEndDate || !draftSleepEndTime)) {
        setError("Elige la fecha y hora de fin.");
        return;
      }
      if (draftSleepType === "NOCHE" && draftSleepAchieved && (!draftSleepAchievedDate || !draftSleepAchievedTime)) {
        setError("Elige la fecha y hora en que logró dormir.");
        return;
      }
      const occurredAt = combineDateTime(draftDate, draftTime);

      let sleepEndedAt: string | null = null;
      if (draftSleepEnded) {
        sleepEndedAt = combineDateTime(draftSleepEndDate, draftSleepEndTime).toISOString();
      }

      let sleepAchievedAt: string | null = null;
      if (draftSleepType === "NOCHE" && draftSleepAchieved) {
        sleepAchievedAt = combineDateTime(draftSleepAchievedDate, draftSleepAchievedTime).toISOString();
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
          sleepAchievedAt,
        }),
      });
      setSaving(false);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo guardar. Inténtalo de nuevo.");
        return;
      }
      const originalDayKey = editingContext.dayKey;
      closePanel();
      await refreshAfterSave(originalDayKey, occurredAt.toISOString());
      return;
    }

    if (!draftSleepPhase) {
      setError(draftSleepType === "NOCHE" ? "Elige si es hacer dormir o despertar." : "Elige si es inicio o fin.");
      return;
    }

    if (draftSleepPhase === "START") {
      // NOCHE's "hacer dormir" splits into starting the bedtime attempt
      // (falls through to the same create-a-session logic siesta's "inicio"
      // uses) vs. marking that it worked (a distinct action, no manual
      // time, closer in shape to "despertar").
      if (draftSleepType === "NOCHE") {
        if (!draftSleepSubPhase) {
          setError("Elige si es inicio o logrado.");
          return;
        }
        if (draftSleepSubPhase === "LOGRADO") {
          if (!openSleepSession || openSleepSession === "loading" || openSleepSession.sleepAchievedAt) {
            setError("No hay ninguna sesión de dormir en curso para marcar como lograda.");
            return;
          }
          setSaving(true);
          setError(null);
          const res = await fetch("/api/mar-antonia/activities/sleep/achieved", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caregiverId: draftCaregiverId }),
          });
          setSaving(false);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            setError(body.error ?? "No se pudo guardar. Inténtalo de nuevo.");
            return;
          }
          closePanel();
          await load();
          return;
        }
      }

      if (!draftDate) {
        setError("Elige una fecha.");
        return;
      }
      if (!draftTime) {
        setError("Elige una hora.");
        return;
      }
      const occurredAt = combineDateTime(draftDate, draftTime);

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
      await refreshAfterSave(null, occurredAt.toISOString());
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

  // Status line shown while creating a SLEEP entry for an action that needs
  // to look up the currently open session first ("despertar"/"fin", or
  // NOCHE's "logrado") -- null when no such lookup is in play right now.
  function sleepStatusMessage(): string | null {
    if (editingContext || expandedType !== "SLEEP" || !draftSleepType) return null;
    const isLogrado =
      draftSleepType === "NOCHE" && draftSleepPhase === "START" && draftSleepSubPhase === "LOGRADO";
    const isEnd = draftSleepPhase === "END";
    // The plain "start a new session" path (Inicio, or Siesta's own single
    // START phase) -- checked against any already-open session up front so
    // the block is explained before Guardar is even tapped, instead of only
    // surfacing as a raw server error after the fact.
    const isStartCreate =
      draftSleepPhase === "START" && (draftSleepType !== "NOCHE" || draftSleepSubPhase === "INICIO");
    if (!isLogrado && !isEnd && !isStartCreate) return null;

    if (openSleepSession === "loading") return "Buscando…";

    if (isStartCreate) {
      if (!openSleepSession) return null;
      const closeVerb = draftSleepType === "NOCHE" ? "“Despertar”" : "“Fin”";
      return `Ya hay una sesión de ${SLEEP_TYPE_LABEL[draftSleepType].toLowerCase()} en curso, iniciada a las ${formatTime(openSleepSession.occurredAt)}. Ciérrala en ${closeVerb} antes de iniciar una nueva.`;
    }

    if (openSleepSession === null) {
      return `No hay ninguna sesión de ${SLEEP_TYPE_LABEL[draftSleepType].toLowerCase()} en curso.`;
    }
    if (isLogrado) {
      if (openSleepSession.sleepAchievedAt) {
        return `Ya se registró que logró dormir a las ${formatTime(openSleepSession.sleepAchievedAt)}.`;
      }
      return `Empezó a intentar dormir a las ${formatTime(openSleepSession.occurredAt)}. Se registrará que logró dormir con la hora actual.`;
    }
    const verb = draftSleepType === "NOCHE" ? "el despertar" : "el fin";
    return `Empezó a las ${formatTime(openSleepSession.occurredAt)}. Se registrará ${verb} con la hora actual.`;
  }

  // Whether Guardar should be disabled because this SLEEP create-mode
  // action needs a usable open session and doesn't have one yet (still
  // loading, none found, or -- for "logrado" -- already marked), or --
  // for starting a brand new session -- because one is already open.
  function sleepActionBlocked(): boolean {
    if (editingContext || expandedType !== "SLEEP") return false;
    const isLogrado =
      draftSleepType === "NOCHE" && draftSleepPhase === "START" && draftSleepSubPhase === "LOGRADO";
    const isEnd = draftSleepPhase === "END";
    const isStartCreate =
      draftSleepPhase === "START" && (draftSleepType !== "NOCHE" || draftSleepSubPhase === "INICIO");
    if (!isLogrado && !isEnd && !isStartCreate) return false;

    if (openSleepSession === "loading") return true;
    if (isStartCreate) return openSleepSession != null;
    if (!openSleepSession) return true;
    return isLogrado && openSleepSession.sleepAchievedAt != null;
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
        <div ref={panelRef} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
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
              onChange={(v) => {
                setDraftSleepPhase(v);
                setDraftSleepSubPhase(null);
                setError(null);
              }}
            />
          )}

          {expandedType === "SLEEP" && !editingContext && draftSleepType === "NOCHE" && draftSleepPhase === "START" && (
            <PillGroup
              label="¿Inicio o logrado?"
              options={[
                { value: "INICIO" as const, label: "Inicio" },
                { value: "LOGRADO" as const, label: "Logrado" },
              ]}
              value={draftSleepSubPhase}
              onChange={(v) => {
                setDraftSleepSubPhase(v);
                setError(null);
              }}
            />
          )}

          {(expandedType !== "SLEEP" ||
            editingContext ||
            (draftSleepPhase === "START" && (draftSleepType !== "NOCHE" || draftSleepSubPhase === "INICIO"))) && (
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <label htmlFor="activity-date" className="text-sm font-semibold text-white">
                  {expandedType === "SLEEP" ? "Día de inicio" : "¿Qué día?"}
                </label>
                <input
                  id="activity-date"
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
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
            </div>
          )}

          {sleepStatusMessage() && <p className="text-sm text-muted">{sleepStatusMessage()}</p>}

          {expandedType === "SLEEP" && editingContext && draftSleepType === "NOCHE" && (
            <PillGroup
              label="¿Logró dormir?"
              options={[
                { value: "yes" as const, label: "Sí, ya se durmió" },
                { value: "no" as const, label: "No, aún no" },
              ]}
              value={draftSleepAchieved ? "yes" : "no"}
              onChange={(v) => setDraftSleepAchieved(v === "yes")}
            />
          )}

          {expandedType === "SLEEP" && editingContext && draftSleepType === "NOCHE" && draftSleepAchieved && (
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <label htmlFor="sleep-achieved-date" className="text-sm font-semibold text-white">
                  Día en que logró dormir
                </label>
                <input
                  id="sleep-achieved-date"
                  type="date"
                  value={draftSleepAchievedDate}
                  onChange={(e) => setDraftSleepAchievedDate(e.target.value)}
                  className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <label htmlFor="sleep-achieved-time" className="text-sm font-semibold text-white">
                  Hora en que logró dormir
                </label>
                <input
                  id="sleep-achieved-time"
                  type="time"
                  value={draftSleepAchievedTime}
                  onChange={(e) => setDraftSleepAchievedTime(e.target.value)}
                  className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
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
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <label htmlFor="sleep-end-date" className="text-sm font-semibold text-white">
                  Día de fin
                </label>
                <input
                  id="sleep-end-date"
                  type="date"
                  value={draftSleepEndDate}
                  onChange={(e) => setDraftSleepEndDate(e.target.value)}
                  className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
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
            <PillGroup
              label="¿Cuántas onzas?"
              options={MILK_OUNCES_OPTIONS.map((oz) => ({ value: String(oz), label: `${oz} oz` }))}
              value={draftMilkOunces || null}
              onChange={setDraftMilkOunces}
            />
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

          {expandedType === "OUTING" && (
            <PillGroup
              label="¿A dónde?"
              options={[
                { value: "CAR" as const, label: "En coche" },
                { value: "PARK" as const, label: "Parque" },
                { value: "FAMILY_VISIT" as const, label: "Visita familia" },
                { value: "OTHER" as const, label: "Otro" },
              ]}
              value={draftOutingType}
              onChange={setDraftOutingType}
            />
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={saveActivity}
              disabled={saving || sleepActionBlocked()}
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
