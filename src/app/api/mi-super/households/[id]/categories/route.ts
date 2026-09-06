import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireHouseholdMember, authzErrorResponse } from "@/lib/miSuper/authz";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    await requireHouseholdMember(session.user.id, id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const categories = await prisma.category.findMany({ where: { householdId: id }, orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ categories });
}

const createSchema = z.object({ name: z.string().trim().min(1, "El nombre es obligatorio").max(60) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    await requireHouseholdMember(session.user.id, id, "EDITOR");
  } catch (e) {
    return authzErrorResponse(e);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const last = await prisma.category.findFirst({ where: { householdId: id }, orderBy: { sortOrder: "desc" } });
  try {
    const category = await prisma.category.create({
      data: { householdId: id, name: parsed.data.name, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch {
    // Unique constraint on [householdId, name] -- the household already has
    // a category with this exact name.
    return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 400 });
  }
}
