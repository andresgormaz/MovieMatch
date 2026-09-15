import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";
import { MAX_PHOTO_DATA_URL_LENGTH } from "@/lib/marAntonia/imageCompression";

const CAREGIVER_SELECT = { id: true, name: true, email: true } as const;
const DOCTOR_SELECT = { id: true, name: true } as const;

async function loadOwnPrescription(childId: string, id: string) {
  const prescription = await prisma.childPrescription.findUnique({ where: { id } });
  if (!prescription || prescription.childId !== childId) return null;
  return prescription;
}

const photoSchema = z
  .string()
  .max(MAX_PHOTO_DATA_URL_LENGTH, "La foto es muy pesada, prueba con otra o recórtala.")
  .startsWith("data:image/", "Formato de foto inválido.");

const patchSchema = z.object({
  date: z.string().datetime().optional(),
  // Explicit null unlinks the doctor / clears the photo; omitted leaves as-is.
  doctorId: z.string().nullable().optional(),
  medication: z.string().trim().min(1, "Escribe qué medicamento o indicación es").max(300).optional(),
  instructions: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined))
    .nullable(),
  photoDataUrl: photoSchema.nullable().optional(),
  caregiverId: z.string().optional(),
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
  const existing = await loadOwnPrescription(caregiver.childId, id);
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
  if (parsed.data.doctorId) {
    const doctor = await prisma.childDoctor.findUnique({ where: { id: parsed.data.doctorId } });
    if (!doctor || doctor.childId !== caregiver.childId) {
      return NextResponse.json({ error: "Médico inválido" }, { status: 400 });
    }
  }

  const prescription = await prisma.childPrescription.update({
    where: { id },
    data: { ...parsed.data, date: parsed.data.date ? new Date(parsed.data.date) : undefined },
    include: { caregiver: { select: CAREGIVER_SELECT }, doctor: { select: DOCTOR_SELECT } },
  });

  return NextResponse.json({ prescription });
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
  const existing = await loadOwnPrescription(caregiver.childId, id);
  if (!existing) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  await prisma.childPrescription.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
