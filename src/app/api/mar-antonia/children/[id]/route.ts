import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireChildCaregiver, authzErrorResponse } from "@/lib/marAntonia/authz";

const CHILD_SELECT = {
  id: true,
  name: true,
  inviteCode: true,
  ownerUserId: true,
  birthDate: true,
  sex: true,
  legalName: true,
  rut: true,
  passportNumber: true,
  bloodType: true,
  medicalNotes: true,
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    await requireChildCaregiver(session.user.id, id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const child = await prisma.child.findUniqueOrThrow({ where: { id }, select: CHILD_SELECT });
  return NextResponse.json({ child });
}

// Omitted key = don't touch; blank string = also don't touch (the UI always
// sends an explicit null to clear a field, never ""); explicit null =
// clear it back to unset. Same shape as the doctors/prescriptions/products
// PATCH routes' own optionalText helper.
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined))
    .nullable();

// name stays required (a profile always has one); everything else is
// optional identity/emergency info the growth charts, vaccine schedule, or
// just "good to have on hand" needs -- omitted entirely means "don't
// touch," explicit null clears it back to unset.
const updateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80).optional(),
  birthDate: z.string().datetime().nullable().optional(),
  sex: z.enum(["MALE", "FEMALE"]).nullable().optional(),
  legalName: optionalText(150),
  rut: optionalText(20),
  passportNumber: optionalText(30),
  bloodType: optionalText(10),
  medicalNotes: optionalText(4000),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    // No OWNER/EDITOR distinction here -- both caregivers can edit.
    await requireChildCaregiver(session.user.id, id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const child = await prisma.child.update({
    where: { id },
    data: {
      name: parsed.data.name,
      birthDate: parsed.data.birthDate === undefined ? undefined : parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
      sex: parsed.data.sex,
      legalName: parsed.data.legalName,
      rut: parsed.data.rut,
      passportNumber: parsed.data.passportNumber,
      bloodType: parsed.data.bloodType,
      medicalNotes: parsed.data.medicalNotes,
    },
    select: CHILD_SELECT,
  });
  return NextResponse.json({ child });
}
