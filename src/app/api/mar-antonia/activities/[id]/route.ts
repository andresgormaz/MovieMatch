import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";
import { validateActivityDetail } from "@/lib/marAntonia/activityTypes";

const CAREGIVER_SELECT = { id: true, name: true, email: true } as const;

async function loadOwnActivity(childId: string, activityId: string) {
  const activity = await prisma.childActivity.findUnique({ where: { id: activityId } });
  if (!activity || activity.childId !== childId) return null;
  return activity;
}

// The type itself never changes on edit -- only the caregiver credit and
// that type's own detail field (fixing a mis-tap: wrong parent, wrong
// quality/ounces/mood/content). diaperAmount/diaperConsistency accept an
// explicit null so editing a POOP diaper back to PEE can clear them --
// omitted (undefined) means "leave as-is", null means "clear it".
const patchSchema = z.object({
  caregiverId: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
  mealQuality: z.enum(["GOOD", "REGULAR", "BAD"]).optional(),
  milkOunces: z.number().positive().optional(),
  wakeMood: z.enum(["CALM", "CRYING"]).optional(),
  diaperContent: z.enum(["PEE", "POOP"]).optional(),
  diaperAmount: z.enum(["LITTLE", "A_LOT"]).nullable().optional(),
  diaperConsistency: z.enum(["NORMAL", "HARD", "DIARRHEA"]).nullable().optional(),
  sleepType: z.enum(["SIESTA", "NOCHE"]).optional(),
  // Explicit null clears it back to "still in progress" -- e.g. fixing a
  // premature "fin" tap.
  sleepEndedAt: z.string().datetime().nullable().optional(),
});

// undefined = field wasn't sent, keep the activity's existing value;
// null = explicitly cleared; anything else = the new value. Used only to
// build the *merged* view passed to validateActivityDetail -- the actual
// Prisma update below writes parsed.data's fields verbatim (Prisma treats
// undefined as "don't touch" and null as "set to NULL", which is exactly
// this same distinction).
function mergedField<T>(patched: T | null | undefined, existing: T | null): T | undefined {
  if (patched === undefined) return existing ?? undefined;
  if (patched === null) return undefined;
  return patched;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let caregiver;
  try {
    caregiver = await requireAnyChild(session.user.id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const { id } = await params;
  const activity = await loadOwnActivity(caregiver.childId, id);
  if (!activity) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  if (parsed.data.caregiverId) {
    const targetCaregiver = await prisma.childCaregiver.findUnique({
      where: { childId_userId: { childId: caregiver.childId, userId: parsed.data.caregiverId } },
    });
    if (!targetCaregiver) return NextResponse.json({ error: "Cuidador inválido" }, { status: 400 });
  }

  // Re-validate against the activity's own (unchangeable) type, merging in
  // only the detail field that type actually uses -- e.g. a MILK activity's
  // PATCH is only ever expected to send milkOunces, but this guards against
  // a stray field regardless.
  const detailError = validateActivityDetail(activity.type, {
    mealQuality: mergedField(parsed.data.mealQuality, activity.mealQuality),
    milkOunces: mergedField(parsed.data.milkOunces, activity.milkOunces),
    wakeMood: mergedField(parsed.data.wakeMood, activity.wakeMood),
    diaperContent: mergedField(parsed.data.diaperContent, activity.diaperContent),
    diaperAmount: mergedField(parsed.data.diaperAmount, activity.diaperAmount),
    diaperConsistency: mergedField(parsed.data.diaperConsistency, activity.diaperConsistency),
    sleepType: mergedField(parsed.data.sleepType, activity.sleepType),
    sleepEndedAt: mergedField(parsed.data.sleepEndedAt, activity.sleepEndedAt?.toISOString() ?? null),
  });
  if (detailError) return NextResponse.json({ error: detailError }, { status: 400 });

  const updated = await prisma.childActivity.update({
    where: { id },
    data: {
      caregiverId: parsed.data.caregiverId,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined,
      mealQuality: parsed.data.mealQuality,
      milkOunces: parsed.data.milkOunces,
      wakeMood: parsed.data.wakeMood,
      diaperContent: parsed.data.diaperContent,
      diaperAmount: parsed.data.diaperAmount,
      diaperConsistency: parsed.data.diaperConsistency,
      sleepType: parsed.data.sleepType,
      sleepEndedAt:
        parsed.data.sleepEndedAt === undefined
          ? undefined
          : parsed.data.sleepEndedAt === null
            ? null
            : new Date(parsed.data.sleepEndedAt),
    },
    include: { caregiver: { select: CAREGIVER_SELECT } },
  });

  return NextResponse.json({ activity: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let caregiver;
  try {
    caregiver = await requireAnyChild(session.user.id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const { id } = await params;
  const activity = await loadOwnActivity(caregiver.childId, id);
  if (!activity) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  await prisma.childActivity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
