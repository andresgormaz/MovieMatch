import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";

const DAYS_BACK = 14;

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A summary of the last two weeks' activity, one entry per day that has at
// least one logged activity, excluding today (already shown expanded on
// Inicio). Grouped in JS rather than a raw SQL date-trunc -- one child's
// activity volume is tiny (dozens of rows), so this is simpler than
// reaching for driver-specific SQL.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let caregiver;
  try {
    caregiver = await requireAnyChild(session.user.id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoff = new Date(todayStart.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000);

  const rows = await prisma.childActivity.findMany({
    where: { childId: caregiver.childId, occurredAt: { gte: cutoff, lt: todayStart } },
    select: { occurredAt: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = dateKey(row.occurredAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const days = [...counts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ days });
}
