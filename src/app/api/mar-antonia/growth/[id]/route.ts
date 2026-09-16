import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";

const CAREGIVER_SELECT = { id: true, name: true, email: true } as const;

async function loadOwnMeasurement(childId: string, id: string) {
  const measurement = await prisma.childGrowthMeasurement.findUnique({ where: { id } });
  if (!measurement || measurement.childId !== childId) return null;
  return measurement;
}

const patchSchema = z.object({
  caregiverId: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
  // Explicit null clears a previously-entered measurement (e.g. fixing a
  // typo where the wrong field was filled in) -- omitted means "leave as-is".
  weightKg: z.number().min(0.3).max(60).nullable().optional(),
  heightCm: z.number().min(20).max(160).nullable().optional(),
  headCircumferenceCm: z.number().min(20).max(65).nullable().optional(),
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
  const existing = await loadOwnMeasurement(caregiver.childId, id);
  if (!existing) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

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

  const merged = {
    weightKg: parsed.data.weightKg === undefined ? existing.weightKg : parsed.data.weightKg,
    heightCm: parsed.data.heightCm === undefined ? existing.heightCm : parsed.data.heightCm,
    headCircumferenceCm:
      parsed.data.headCircumferenceCm === undefined ? existing.headCircumferenceCm : parsed.data.headCircumferenceCm,
  };
  if (merged.weightKg == null && merged.heightCm == null && merged.headCircumferenceCm == null) {
    return NextResponse.json(
      { error: "Ingresa al menos una medida (peso, estatura o circunferencia de cabeza)." },
      { status: 400 },
    );
  }

  const measurement = await prisma.childGrowthMeasurement.update({
    where: { id },
    data: {
      caregiverId: parsed.data.caregiverId,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined,
      weightKg: parsed.data.weightKg,
      heightCm: parsed.data.heightCm,
      headCircumferenceCm: parsed.data.headCircumferenceCm,
    },
    include: { caregiver: { select: CAREGIVER_SELECT } },
  });

  return NextResponse.json({ measurement });
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
  const existing = await loadOwnMeasurement(caregiver.childId, id);
  if (!existing) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  await prisma.childGrowthMeasurement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
