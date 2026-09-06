import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireListAccess, authzErrorResponse } from "@/lib/miSuper/authz";

const CATEGORY_SELECT = { id: true, name: true, sortOrder: true } as const;

async function loadItem(listId: string, itemId: string) {
  const item = await prisma.listItem.findUnique({ where: { id: itemId } });
  if (!item || item.listId !== listId) return null;
  return item;
}

const patchSchema = z.object({
  displayName: z.string().trim().min(1, "El nombre es obligatorio").max(120).optional(),
  categoryId: z.string().nullable().optional(),
  qty: z.number().positive().nullable().optional(),
  unit: z.string().trim().max(20).nullable().optional(),
  // The timestamp itself doubles as the checked flag -- same idiom as
  // onboardingCompletedAt/tourSeenAt elsewhere in this app.
  checked: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id, itemId } = await params;
  let list;
  try {
    list = await requireListAccess(session.user.id, id, "EDITOR");
  } catch (e) {
    return authzErrorResponse(e);
  }

  const item = await loadItem(id, itemId);
  if (!item) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  if (parsed.data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category || category.householdId !== list.householdId) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }
  }

  const { displayName, categoryId, qty, unit, checked } = parsed.data;
  const updated = await prisma.listItem.update({
    where: { id: itemId },
    data: {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(qty !== undefined ? { qty } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(checked !== undefined ? { checkedAt: checked ? new Date() : null } : {}),
    },
    include: { category: { select: CATEGORY_SELECT } },
  });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id, itemId } = await params;
  try {
    await requireListAccess(session.user.id, id, "EDITOR");
  } catch (e) {
    return authzErrorResponse(e);
  }

  const item = await loadItem(id, itemId);
  if (!item) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

  await prisma.listItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
