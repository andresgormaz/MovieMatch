import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { code } = await params;
  const child = await prisma.child.findUnique({
    where: { inviteCode: code },
    include: { caregivers: { include: { user: { select: { name: true, email: true } } } } },
  });

  if (!child) return NextResponse.json({ error: "Ese código de invitación no existe" }, { status: 404 });

  const alreadyCaregiver = child.caregivers.some((c) => c.userId === session.user.id);

  return NextResponse.json({
    child: {
      id: child.id,
      name: child.name,
      caregivers: child.caregivers.map((c) => ({ label: c.user.name || c.user.email, role: c.role })),
    },
    alreadyCaregiver,
  });
}

const joinSchema = z.object({ role: z.enum(["MAMA", "PAPA"]) });

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { code } = await params;
  const child = await prisma.child.findUnique({ where: { inviteCode: code } });
  if (!child) return NextResponse.json({ error: "Ese código de invitación no existe" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  // Upsert rather than insert -- revisiting an invite link after already
  // joining (or to correct a mis-picked role) just updates the role instead
  // of failing on the unique constraint.
  await prisma.childCaregiver.upsert({
    where: { childId_userId: { childId: child.id, userId: session.user.id } },
    update: { role: parsed.data.role },
    create: { childId: child.id, userId: session.user.id, role: parsed.data.role },
  });

  return NextResponse.json({ ok: true, childId: child.id });
}
