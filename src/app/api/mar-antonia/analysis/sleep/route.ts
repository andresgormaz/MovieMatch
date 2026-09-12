import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";

const LOOKBACK_DAYS = 90;
const MINUTE_MS = 60 * 1000;

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface NightRecord {
  date: string;
  bedtime: string;
  wakeTime: string | null;
  minutesToFallAsleep: number | null;
  totalSleepMinutes: number | null;
  nightWakeCount: number;
  daytimeNapMinutes: number;
  daytimeNapCount: number;
  bathMinutesBeforeBed: number | null;
  lastMealQuality: "GOOD" | "REGULAR" | "BAD" | null;
  lastMilkMinutesBeforeBed: number | null;
  hadOuting: boolean;
  diaperChangesThatDay: number;
}

interface GroupStats {
  label: string;
  nights: number;
  avgNightWakeCount: number | null;
  avgMinutesToFallAsleep: number | null;
  avgTotalSleepMinutes: number | null;
}

const MIN_NIGHTS_PER_GROUP = 3;

function summarizeGroup(label: string, nights: NightRecord[]): GroupStats {
  const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
  return {
    label,
    nights: nights.length,
    avgNightWakeCount: avg(nights.map((n) => n.nightWakeCount)),
    avgMinutesToFallAsleep: avg(
      nights.filter((n) => n.minutesToFallAsleep != null).map((n) => n.minutesToFallAsleep!),
    ),
    avgTotalSleepMinutes: avg(nights.filter((n) => n.totalSleepMinutes != null).map((n) => n.totalSleepMinutes!)),
  };
}

// Compares two groups of nights split by some same-day factor (bath timing,
// nap duration, etc.) -- omitted from the response entirely unless both
// sides have enough nights to say anything meaningful, rather than drawing a
// conclusion from two or three data points.
function compareGroups(
  factor: string,
  groupA: { label: string; nights: NightRecord[] },
  groupB: { label: string; nights: NightRecord[] },
) {
  if (groupA.nights.length < MIN_NIGHTS_PER_GROUP || groupB.nights.length < MIN_NIGHTS_PER_GROUP) return null;
  return {
    factor,
    groups: [summarizeGroup(groupA.label, groupA.nights), summarizeGroup(groupB.label, groupB.nights)],
  };
}

// A read-only look at this child's own MarAntonia history, trying to spot
// same-day factors (a bath close to bedtime, a longer daytime nap, what the
// last meal was like, an outing) that line up with better or worse nights
// (fewer night wake-ups, falling asleep faster, sleeping longer). Everything
// here is the caregiver's own data, fetched under their own session the same
// way every other MarAntonia route already does -- nothing new is exposed
// that requireAnyChild doesn't already gate.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let caregiver;
  try {
    caregiver = await requireAnyChild(session.user.id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const activities = await prisma.childActivity.findMany({
    where: { childId: caregiver.childId, occurredAt: { gte: since } },
    orderBy: { occurredAt: "asc" },
  });

  const nightSessions = activities.filter((a) => a.type === "SLEEP" && a.sleepType === "NOCHE");
  const activitiesByDay = new Map<string, typeof activities>();
  for (const a of activities) {
    const key = dateKey(a.occurredAt);
    const list = activitiesByDay.get(key) ?? [];
    list.push(a);
    activitiesByDay.set(key, list);
  }

  const nights: NightRecord[] = nightSessions.map((session) => {
    const bedtime = session.occurredAt;
    const wakeTime = session.sleepEndedAt;
    const dayKey = dateKey(bedtime);
    const sameDayActivities = activitiesByDay.get(dayKey) ?? [];

    const nightWakeCount = activities.filter(
      (a) =>
        a.type === "NIGHT_WAKE" &&
        a.occurredAt.getTime() >= bedtime.getTime() &&
        a.occurredAt.getTime() <= (wakeTime ?? new Date()).getTime(),
    ).length;

    const daytimeNaps = sameDayActivities.filter(
      (a) => a.type === "SLEEP" && a.sleepType === "SIESTA" && a.sleepEndedAt,
    );
    const daytimeNapMinutes = daytimeNaps.reduce(
      (sum, nap) => sum + (nap.sleepEndedAt!.getTime() - nap.occurredAt.getTime()) / MINUTE_MS,
      0,
    );

    const bathsBeforeBed = sameDayActivities.filter((a) => a.type === "BATH" && a.occurredAt < bedtime);
    const lastBath = bathsBeforeBed.at(-1) ?? null;

    const mealsBeforeBed = sameDayActivities.filter((a) => a.type === "MEAL" && a.occurredAt < bedtime);
    const lastMeal = mealsBeforeBed.at(-1) ?? null;

    const milksBeforeBed = sameDayActivities.filter((a) => a.type === "MILK" && a.occurredAt < bedtime);
    const lastMilk = milksBeforeBed.at(-1) ?? null;

    return {
      date: dayKey,
      bedtime: bedtime.toISOString(),
      wakeTime: wakeTime ? wakeTime.toISOString() : null,
      minutesToFallAsleep: session.sleepAchievedAt
        ? (session.sleepAchievedAt.getTime() - bedtime.getTime()) / MINUTE_MS
        : null,
      totalSleepMinutes: wakeTime ? (wakeTime.getTime() - bedtime.getTime()) / MINUTE_MS : null,
      nightWakeCount,
      daytimeNapMinutes: Math.round(daytimeNapMinutes),
      daytimeNapCount: daytimeNaps.length,
      bathMinutesBeforeBed: lastBath ? Math.round((bedtime.getTime() - lastBath.occurredAt.getTime()) / MINUTE_MS) : null,
      lastMealQuality: lastMeal?.mealQuality ?? null,
      lastMilkMinutesBeforeBed: lastMilk
        ? Math.round((bedtime.getTime() - lastMilk.occurredAt.getTime()) / MINUTE_MS)
        : null,
      hadOuting: sameDayActivities.some((a) => a.type === "OUTING"),
      diaperChangesThatDay: sameDayActivities.filter((a) => a.type === "DIAPER").length,
    };
  });

  // Only completed nights (a real end time) count for duration/wake-count
  // comparisons -- a still-open session doesn't yet have a real "how many
  // times did she wake up" answer.
  const completedNights = nights.filter((n) => n.wakeTime != null);

  const insights = [
    compareGroups(
      "Baño antes de dormir",
      { label: "Con baño en las 2h antes de dormir", nights: completedNights.filter((n) => n.bathMinutesBeforeBed != null && n.bathMinutesBeforeBed <= 120) },
      { label: "Sin baño (o más de 2h antes)", nights: completedNights.filter((n) => n.bathMinutesBeforeBed == null || n.bathMinutesBeforeBed > 120) },
    ),
    compareGroups(
      "Siesta durante el día",
      { label: "Siesta(s) de más de 90 min en total", nights: completedNights.filter((n) => n.daytimeNapMinutes > 90) },
      { label: "Siesta(s) de 90 min o menos", nights: completedNights.filter((n) => n.daytimeNapMinutes <= 90) },
    ),
    compareGroups(
      "Última comida del día",
      { label: "Última comida \"Bien\"", nights: completedNights.filter((n) => n.lastMealQuality === "GOOD") },
      { label: "Última comida \"Regular\" o \"Mal\"", nights: completedNights.filter((n) => n.lastMealQuality === "REGULAR" || n.lastMealQuality === "BAD") },
    ),
    compareGroups(
      "Paseo ese día",
      { label: "Con paseo", nights: completedNights.filter((n) => n.hadOuting) },
      { label: "Sin paseo", nights: completedNights.filter((n) => !n.hadOuting) },
    ),
    compareGroups(
      "Última leche antes de dormir",
      { label: "Última leche en la hora antes de dormir", nights: completedNights.filter((n) => n.lastMilkMinutesBeforeBed != null && n.lastMilkMinutesBeforeBed <= 60) },
      { label: "Sin leche (o más de 1h antes)", nights: completedNights.filter((n) => n.lastMilkMinutesBeforeBed == null || n.lastMilkMinutesBeforeBed > 60) },
    ),
  ].filter((i) => i !== null);

  return NextResponse.json({
    lookbackDays: LOOKBACK_DAYS,
    totalNights: nights.length,
    completedNights: completedNights.length,
    minNightsPerGroup: MIN_NIGHTS_PER_GROUP,
    nights,
    insights,
  });
}
