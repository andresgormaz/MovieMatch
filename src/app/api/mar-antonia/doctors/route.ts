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

  const doctors = await prisma.childDoctor.findMany({
    where: { childId: caregiver.childId },
    include: { caregiver: { select: CAREGIVER_SELECT } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ doctors });
}

// Empty strings from an optional text input are treated the same as
// "not provided" -- a blank field shouldn't round-trip as a stored "". Also
// accepts an explicit null (the client sends one for a field it left empty,
// same shape PATCH uses for "clear this field") rather than omitting the
// key entirely.
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined))
    .nullable();

const createSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  specialty: optionalText(120),
  location: optionalText(200),
  phone: optionalText(40),
  email: optionalText(120),
  notes: optionalText(2000),
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

  const doctor = await prisma.childDoctor.create({
    data: { childId: caregiver.childId, ...parsed.data },
    include: { caregiver: { select: CAREGIVER_SELECT } },
  });

  return NextResponse.json({ doctor }, { status: 201 });
}
