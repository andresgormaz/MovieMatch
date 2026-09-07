import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireChildCaregiver, authzErrorResponse } from "@/lib/marAntonia/authz";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    await requireChildCaregiver(session.user.id, id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const child = await prisma.child.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, inviteCode: true, ownerUserId: true },
  });
  return NextResponse.json({ child });
}

const renameSchema = z.object({ name: z.string().trim().min(1, "El nombre es obligatorio").max(80) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    // No OWNER/EDITOR distinction here -- both caregivers can rename.
    await requireChildCaregiver(session.user.id, id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const child = await prisma.child.update({
    where: { id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, inviteCode: true, ownerUserId: true },
  });
  return NextResponse.json({ child });
}
