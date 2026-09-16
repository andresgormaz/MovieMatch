import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";
import { SLEEP_TYPE_LABEL } from "@/lib/marAntonia/activityTypes";

const CAREGIVER_SELECT = { id: true, name: true, email: true } as const;
const sleepTypeSchema = z.enum(["SIESTA", "NOCHE"]);

// GET ?sleepType=SIESTA|NOCHE -- the currently open (not yet ended) session
// of that subtype, if any. Used by the "fin" quick-log panel to show when
// the session being closed actually started, and to know there's one to
// close at all.
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
  const parsedType = sleepTypeSchema.safeParse(searchParams.get("sleepType"));
  if (!parsedType.success) return NextResponse.json({ error: "Tipo de sueño inválido" }, { status: 400 });

  const activity = await prisma.childActivity.findFirst({
    where: { childId: caregiver.childId, type: "SLEEP", sleepType: parsedType.data, sleepEndedAt: null },
    include: { caregiver: { select: CAREGIVER_SELECT } },
    orderBy: { occurredAt: "desc" },
  });

  return NextResponse.json({ activity });
}

const endSchema = z.object({
  sleepType: sleepTypeSchema,
  caregiverId: z.string(),
});

// POST { sleepType, caregiverId } -- closes ("fin") whichever session of
// that subtype is currently open, stamping the end time with the system
// clock (not manually adjustable, per how this was asked for -- "inicio"
// still goes through the regular create endpoint with an editable time).
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
  const parsed = endSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const targetCaregiver = await prisma.childCaregiver.findUnique({
    where: { childId_userId: { childId: caregiver.childId, userId: parsed.data.caregiverId } },
  });
  if (!targetCaregiver) return NextResponse.json({ error: "Cuidador inválido" }, { status: 400 });

  const open = await prisma.childActivity.findFirst({
    where: { childId: caregiver.childId, type: "SLEEP", sleepType: parsed.data.sleepType, sleepEndedAt: null },
    orderBy: { occurredAt: "desc" },
  });
  if (!open) {
    return NextResponse.json(
      { error: `No hay ningún registro de ${SLEEP_TYPE_LABEL[parsed.data.sleepType].toLowerCase()} en curso para terminar.` },
      { status: 404 },
    );
  }

  const updated = await prisma.childActivity.update({
    where: { id: open.id },
    data: { sleepEndedAt: new Date(), caregiverId: parsed.data.caregiverId },
    include: { caregiver: { select: CAREGIVER_SELECT } },
  });

  return NextResponse.json({ activity: updated });
}
