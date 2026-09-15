import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";
import { MAX_PHOTO_DATA_URL_LENGTH } from "@/lib/marAntonia/imageCompression";

const CAREGIVER_SELECT = { id: true, name: true, email: true } as const;
const DOCTOR_SELECT = { id: true, name: true } as const;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let caregiver;
  try {
    caregiver = await requireAnyChild(session.user.id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const prescriptions = await prisma.childPrescription.findMany({
    where: { childId: caregiver.childId },
    include: { caregiver: { select: CAREGIVER_SELECT }, doctor: { select: DOCTOR_SELECT } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ prescriptions });
}

const photoSchema = z
  .string()
  .max(MAX_PHOTO_DATA_URL_LENGTH, "La foto es muy pesada, prueba con otra o recórtala.")
  .startsWith("data:image/", "Formato de foto inválido.");

const createSchema = z.object({
  date: z.string().datetime().optional(),
  doctorId: z.string().optional(),
  medication: z.string().trim().min(1, "Escribe qué medicamento o indicación es").max(300),
  instructions: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  photoDataUrl: photoSchema.optional(),
  caregiverId: z.string(),
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

  if (parsed.data.doctorId) {
    const doctor = await prisma.childDoctor.findUnique({ where: { id: parsed.data.doctorId } });
    if (!doctor || doctor.childId !== caregiver.childId) {
      return NextResponse.json({ error: "Médico inválido" }, { status: 400 });
    }
  }

  const prescription = await prisma.childPrescription.create({
    data: {
      childId: caregiver.childId,
      ...parsed.data,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
    },
    include: { caregiver: { select: CAREGIVER_SELECT }, doctor: { select: DOCTOR_SELECT } },
  });

  return NextResponse.json({ prescription }, { status: 201 });
}
