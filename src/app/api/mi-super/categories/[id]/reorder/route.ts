import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireHouseholdMember, authzErrorResponse } from "@/lib/miSuper/authz";

const reorderSchema = z.object({ direction: z.enum(["up", "down"]) });

// Swaps sortOrder with the adjacent category rather than renumbering the
// whole list -- a plain up/down nudge, no drag-and-drop library needed.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  try {
    await requireHouseholdMember(session.user.id, category.householdId, "EDITOR");
  } catch (e) {
    return authzErrorResponse(e);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const siblings = await prisma.category.findMany({
    where: { householdId: category.householdId },
    orderBy: { sortOrder: "asc" },
  });
  const index = siblings.findIndex((c) => c.id === id);
  const neighbor = siblings[parsed.data.direction === "up" ? index - 1 : index + 1];
  if (!neighbor) return NextResponse.json({ ok: true }); // already at an edge, no-op

  await prisma.$transaction([
    prisma.category.update({ where: { id: category.id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.category.update({ where: { id: neighbor.id }, data: { sortOrder: category.sortOrder } }),
  ]);

  return NextResponse.json({ ok: true });
}
