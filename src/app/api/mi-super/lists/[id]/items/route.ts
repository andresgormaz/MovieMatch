import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireListAccess, authzErrorResponse } from "@/lib/miSuper/authz";

const CATEGORY_SELECT = { id: true, name: true, sortOrder: true } as const;

const createSchema = z.object({
  rawName: z.string().trim().min(1, "Escribe un producto").max(120),
  categoryId: z.string().optional(),
  qty: z.number().positive().optional(),
  unit: z.string().trim().max(20).optional(),
  // Guards against a double-tap on "Agregar" creating two identical rows --
  // the full offline queue (PR8) is what actually depends on this being
  // stable across retries, but the idempotency itself is free to have now.
  clientMutationId: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  let list;
  try {
    list = await requireListAccess(session.user.id, id, "EDITOR");
  } catch (e) {
    return authzErrorResponse(e);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  if (parsed.data.clientMutationId) {
    const existing = await prisma.listItem.findUnique({
      where: { listId_clientMutationId: { listId: id, clientMutationId: parsed.data.clientMutationId } },
      include: { category: { select: CATEGORY_SELECT } },
    });
    if (existing) return NextResponse.json({ item: existing });
  }

  // A category id, if given, must belong to this same household -- otherwise
  // a stale or forged id would silently attach the item to another
  // household's category.
  if (parsed.data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category || category.householdId !== list.householdId) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }
  }

  const item = await prisma.listItem.create({
    data: {
      listId: id,
      householdId: list.householdId,
      categoryId: parsed.data.categoryId || null,
      rawName: parsed.data.rawName,
      displayName: parsed.data.rawName,
      qty: parsed.data.qty,
      unit: parsed.data.unit,
      clientMutationId: parsed.data.clientMutationId || null,
    },
    include: { category: { select: CATEGORY_SELECT } },
  });
  return NextResponse.json({ item }, { status: 201 });
}
