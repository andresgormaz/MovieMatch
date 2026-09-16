import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";

const CAREGIVER_SELECT = { id: true, name: true, email: true } as const;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let caregiver;
  try {
    caregiver = await requireAnyChild(session.user.id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const measurements = await prisma.childGrowthMeasurement.findMany({
    where: { childId: caregiver.childId },
    include: { caregiver: { select: CAREGIVER_SELECT } },
    orderBy: { occurredAt: "asc" },
  });

  return NextResponse.json({ measurements });
}

// At least one of the three is required -- a pediatrician visit doesn't
// always take every measurement, but a row with none of them is pointless.
// Loose sanity bounds (not clinical thresholds) just to catch a fat-fingered
// unit mix-up (e.g. entering grams instead of kg).
const createSchema = z
  .object({
    caregiverId: z.string(),
    occurredAt: z.string().datetime().optional(),
    weightKg: z.number().min(0.3).max(60).optional(),
    heightCm: z.number().min(20).max(160).optional(),
    headCircumferenceCm: z.number().min(20).max(65).optional(),
  })
  .refine((d) => d.weightKg != null || d.heightCm != null || d.headCircumferenceCm != null, {
    message: "Ingresa al menos una medida (peso, estatura o circunferencia de cabeza).",
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

  const targetCaregiver = await prisma.childCaregiver.findUnique({
    where: { childId_userId: { childId: caregiver.childId, userId: parsed.data.caregiverId } },
  });
  if (!targetCaregiver) return NextResponse.json({ error: "Cuidador inválido" }, { status: 400 });

  const measurement = await prisma.childGrowthMeasurement.create({
    data: {
      childId: caregiver.childId,
      caregiverId: parsed.data.caregiverId,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined,
      weightKg: parsed.data.weightKg,
      heightCm: parsed.data.heightCm,
      headCircumferenceCm: parsed.data.headCircumferenceCm,
    },
    include: { caregiver: { select: CAREGIVER_SELECT } },
  });

  return NextResponse.json({ measurement }, { status: 201 });
}
