import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";

const CAREGIVER_SELECT = { id: true, name: true, email: true } as const;

const achievedSchema = z.object({
  caregiverId: z.string(),
});

// POST { caregiverId } -- marks the currently open Dormir (NOCHE) session as
// "logrado" (the child actually fell asleep), stamping sleepAchievedAt with
// the system clock -- same "no manual time" rule as closing a session, and
// scoped to NOCHE only since siesta has no such middle checkpoint. Finding
// the open session this way (not by id) mirrors POST .../sleep's "fin".
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
  const parsed = achievedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const targetCaregiver = await prisma.childCaregiver.findUnique({
    where: { childId_userId: { childId: caregiver.childId, userId: parsed.data.caregiverId } },
  });
  if (!targetCaregiver) return NextResponse.json({ error: "Cuidador inválido" }, { status: 400 });

  const open = await prisma.childActivity.findFirst({
    where: {
      childId: caregiver.childId,
      type: "SLEEP",
      sleepType: "NOCHE",
      sleepEndedAt: null,
      sleepAchievedAt: null,
    },
    orderBy: { occurredAt: "desc" },
  });
  if (!open) {
    return NextResponse.json(
      { error: "No hay ninguna sesión de dormir en curso para marcar como lograda." },
      { status: 404 },
    );
  }

  const updated = await prisma.childActivity.update({
    where: { id: open.id },
    data: { sleepAchievedAt: new Date(), caregiverId: parsed.data.caregiverId },
    include: { caregiver: { select: CAREGIVER_SELECT } },
  });

  return NextResponse.json({ activity: updated });
}
