import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";

const CAREGIVER_SELECT = { id: true, name: true, email: true } as const;

async function loadOwnDoctor(childId: string, id: string) {
  const doctor = await prisma.childDoctor.findUnique({ where: { id } });
  if (!doctor || doctor.childId !== childId) return null;
  return doctor;
}

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined));

const patchSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120).optional(),
  // Explicit null clears a field that had a value; omitted leaves it as-is.
  specialty: optionalText(120).nullable(),
  location: optionalText(200).nullable(),
  phone: optionalText(40).nullable(),
  email: optionalText(120).nullable(),
  notes: optionalText(2000).nullable(),
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
  const existing = await loadOwnDoctor(caregiver.childId, id);
  if (!existing) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const doctor = await prisma.childDoctor.update({
    where: { id },
    data: parsed.data,
    include: { caregiver: { select: CAREGIVER_SELECT } },
  });

  return NextResponse.json({ doctor });
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
  const existing = await loadOwnDoctor(caregiver.childId, id);
  if (!existing) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  await prisma.childDoctor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
