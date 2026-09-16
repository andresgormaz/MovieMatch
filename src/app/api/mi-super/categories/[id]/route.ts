import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireHouseholdMember, authzErrorResponse } from "@/lib/miSuper/authz";

const renameSchema = z.object({ name: z.string().trim().min(1, "El nombre es obligatorio").max(60) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id }, select: { householdId: true } });
  if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  try {
    await requireHouseholdMember(session.user.id, category.householdId, "EDITOR");
  } catch (e) {
    return authzErrorResponse(e);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  try {
    const updated = await prisma.category.update({ where: { id }, data: { name: parsed.data.name } });
    return NextResponse.json({ category: updated });
  } catch {
    return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id }, select: { householdId: true } });
  if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  try {
    await requireHouseholdMember(session.user.id, category.householdId, "EDITOR");
  } catch (e) {
    return authzErrorResponse(e);
  }

  // Items in this category survive uncategorized -- see schema.prisma's
  // ListItem.category onDelete: SetNull.
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
