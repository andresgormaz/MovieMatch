import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireListAccess, authzErrorResponse } from "@/lib/miSuper/authz";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    await requireListAccess(session.user.id, id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const list = await prisma.shoppingList.findUniqueOrThrow({
    where: { id },
    include: {
      items: { include: { category: { select: { id: true, name: true, sortOrder: true } } } },
    },
  });
  return NextResponse.json({ list });
}

const patchSchema = z.object({
  title: z.string().trim().min(1, "El nombre es obligatorio").max(120).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
  plannedAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    await requireListAccess(session.user.id, id, "EDITOR");
  } catch (e) {
    return authzErrorResponse(e);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const { title, status, plannedAt } = parsed.data;
  const list = await prisma.shoppingList.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(plannedAt !== undefined ? { plannedAt: plannedAt ? new Date(plannedAt) : null } : {}),
    },
    include: {
      items: { include: { category: { select: { id: true, name: true, sortOrder: true } } } },
    },
  });
  return NextResponse.json({ list });
}
