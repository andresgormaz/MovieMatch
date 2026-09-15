import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";
import { allVaccineKeys } from "@/lib/marAntonia/vaccineSchedule";

const CAREGIVER_SELECT = { id: true, name: true, email: true } as const;
const KNOWN_KEYS = new Set(allVaccineKeys());

const markSchema = z.object({
  caregiverId: z.string(),
  givenAt: z.string().datetime().optional(),
});

// POST { caregiverId, givenAt? } -- marks this catalog dose as given
// (upsert, since a caregiver might edit the date after the fact rather than
// unmark-then-remark). DELETE clears it back to "not given" -- see
// ChildVaccineDose's own comment: no row means not given yet.
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { key } = await params;
  if (!KNOWN_KEYS.has(key)) return NextResponse.json({ error: "Vacuna desconocida" }, { status: 404 });

  let caregiver;
  try {
    caregiver = await requireAnyChild(session.user.id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = markSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const targetCaregiver = await prisma.childCaregiver.findUnique({
    where: { childId_userId: { childId: caregiver.childId, userId: parsed.data.caregiverId } },
  });
  if (!targetCaregiver) return NextResponse.json({ error: "Cuidador inválido" }, { status: 400 });

  const dose = await prisma.childVaccineDose.upsert({
    where: { childId_vaccineKey: { childId: caregiver.childId, vaccineKey: key } },
    create: {
      childId: caregiver.childId,
      vaccineKey: key,
      caregiverId: parsed.data.caregiverId,
      givenAt: parsed.data.givenAt ? new Date(parsed.data.givenAt) : new Date(),
    },
    update: {
      caregiverId: parsed.data.caregiverId,
      givenAt: parsed.data.givenAt ? new Date(parsed.data.givenAt) : new Date(),
    },
    include: { caregiver: { select: CAREGIVER_SELECT } },
  });

  return NextResponse.json({ dose });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { key } = await params;

  let caregiver;
  try {
    caregiver = await requireAnyChild(session.user.id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  await prisma.childVaccineDose.deleteMany({ where: { childId: caregiver.childId, vaccineKey: key } });
  return NextResponse.json({ ok: true });
}
