import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";
import { validateActivityDetail, SLEEP_TYPE_LABEL } from "@/lib/marAntonia/activityTypes";

const CAREGIVER_SELECT = { id: true, name: true, email: true } as const;

// GET ?date=YYYY-MM-DD (defaults to today, local server time) -- one day's
// worth of activities, newest first.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let caregiver;
  try {
    caregiver = await requireAnyChild(session.user.id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const date = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const activities = await prisma.childActivity.findMany({
    where: { childId: caregiver.childId, occurredAt: { gte: dayStart, lt: dayEnd } },
    include: { caregiver: { select: CAREGIVER_SELECT } },
    orderBy: { occurredAt: "desc" },
  });

  return NextResponse.json({ activities });
}

const createSchema = z.object({
  type: z.enum(["MEAL", "SLEEP", "MILK", "NIGHT_WAKE", "DIAPER"]),
  caregiverId: z.string(),
  // Defaults to now() at the DB level when omitted -- the UI always sends
  // one (pre-filled with the current time, editable before saving). For
  // SLEEP this is the session's *start* time -- there's no end yet, that's
  // only set later via POST /api/mar-antonia/activities/sleep ("fin").
  occurredAt: z.string().datetime().optional(),
  mealQuality: z.enum(["GOOD", "REGULAR", "BAD"]).optional(),
  milkOunces: z.number().positive().optional(),
  wakeMood: z.enum(["CALM", "CRYING"]).optional(),
  diaperContent: z.enum(["PEE", "POOP"]).optional(),
  diaperAmount: z.enum(["LITTLE", "A_LOT"]).nullable().optional(),
  diaperConsistency: z.enum(["NORMAL", "HARD", "DIARRHEA"]).nullable().optional(),
  sleepType: z.enum(["SIESTA", "NOCHE"]).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let caregiver;
  try {
    caregiver = await requireAnyChild(session.user.id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const detailError = validateActivityDetail(parsed.data.type, parsed.data);
  if (detailError) return NextResponse.json({ error: detailError }, { status: 400 });

  // caregiverId must actually be a caregiver of this child -- same guard as
  // MiSuper's categoryId-belongs-to-household check on item create.
  const targetCaregiver = await prisma.childCaregiver.findUnique({
    where: { childId_userId: { childId: caregiver.childId, userId: parsed.data.caregiverId } },
  });
  if (!targetCaregiver) return NextResponse.json({ error: "Cuidador inválido" }, { status: 400 });

  if (parsed.data.type === "SLEEP") {
    // Only one open (not-yet-ended) session per sleepType at a time -- an
    // "inicio" tap while one's already running would otherwise leave the
    // earlier one stuck open forever with no way to tell them apart.
    const open = await prisma.childActivity.findFirst({
      where: { childId: caregiver.childId, type: "SLEEP", sleepType: parsed.data.sleepType, sleepEndedAt: null },
    });
    if (open) {
      return NextResponse.json(
        {
          error: `Ya hay un registro de ${SLEEP_TYPE_LABEL[parsed.data.sleepType!].toLowerCase()} en curso. Termínalo antes de iniciar uno nuevo.`,
        },
        { status: 400 },
      );
    }
  }

  const activity = await prisma.childActivity.create({
    data: {
      childId: caregiver.childId,
      type: parsed.data.type,
      caregiverId: parsed.data.caregiverId,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined,
      mealQuality: parsed.data.mealQuality,
      milkOunces: parsed.data.milkOunces,
      wakeMood: parsed.data.wakeMood,
      diaperContent: parsed.data.diaperContent,
      diaperAmount: parsed.data.diaperAmount,
      diaperConsistency: parsed.data.diaperConsistency,
      sleepType: parsed.data.sleepType,
    },
    include: { caregiver: { select: CAREGIVER_SELECT } },
  });

  return NextResponse.json({ activity }, { status: 201 });
}
