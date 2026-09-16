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

  const household = await prisma.household.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, inviteCode: true, ownerUserId: true },
  });
  return NextResponse.json({ household });
}

const renameSchema = z.object({ name: z.string().trim().max(80).optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    await requireHouseholdMember(session.user.id, id, "EDITOR");
  } catch (e) {
    return authzErrorResponse(e);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const household = await prisma.household.update({
    where: { id },
    data: { name: parsed.data.name || null },
    select: { id: true, name: true, inviteCode: true, ownerUserId: true },
  });
  return NextResponse.json({ household });
}
