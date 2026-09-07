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
// quality/ounces/mood/content).
const patchSchema = z.object({
  caregiverId: z.string().optional(),
  mealQuality: z.enum(["GOOD", "REGULAR", "BAD"]).optional(),
  milkOunces: z.number().positive().optional(),
  wakeMood: z.enum(["CALM", "CRYING"]).optional(),
  diaperContent: z.enum(["PEE", "POOP"]).optional(),
});

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
    mealQuality: parsed.data.mealQuality ?? activity.mealQuality ?? undefined,
    milkOunces: parsed.data.milkOunces ?? activity.milkOunces ?? undefined,
    wakeMood: parsed.data.wakeMood ?? activity.wakeMood ?? undefined,
    diaperContent: parsed.data.diaperContent ?? activity.diaperContent ?? undefined,
  });
  if (detailError) return NextResponse.json({ error: detailError }, { status: 400 });

  const updated = await prisma.childActivity.update({
    where: { id },
    data: {
      caregiverId: parsed.data.caregiverId,
      mealQuality: parsed.data.mealQuality,
      milkOunces: parsed.data.milkOunces,
      wakeMood: parsed.data.wakeMood,
      diaperContent: parsed.data.diaperContent,
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
