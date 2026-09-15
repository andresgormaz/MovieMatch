import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";
import { MAX_PHOTO_DATA_URL_LENGTH } from "@/lib/marAntonia/imageCompression";

const CAREGIVER_SELECT = { id: true, name: true, email: true } as const;

async function loadOwnProduct(childId: string, id: string) {
  const product = await prisma.childProduct.findUnique({ where: { id } });
  if (!product || product.childId !== childId) return null;
  return product;
}

const photoSchema = z
  .string()
  .max(MAX_PHOTO_DATA_URL_LENGTH, "La foto es muy pesada, prueba con otra o recórtala.")
  .startsWith("data:image/", "Formato de foto inválido.");

const patchSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(150).optional(),
  category: z
    .string()
    .max(60)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined))
    .nullable(),
  notes: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined))
    .nullable(),
  photoDataUrl: photoSchema.nullable().optional(),
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
  const existing = await loadOwnProduct(caregiver.childId, id);
  if (!existing) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const product = await prisma.childProduct.update({
    where: { id },
    data: parsed.data,
    include: { caregiver: { select: CAREGIVER_SELECT } },
  });

  return NextResponse.json({ product });
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
  const existing = await loadOwnProduct(caregiver.childId, id);
  if (!existing) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  await prisma.childProduct.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
