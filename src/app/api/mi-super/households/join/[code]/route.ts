import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { code } = await params;
  const household = await prisma.household.findUnique({
    where: { inviteCode: code },
    include: { members: { include: { user: { select: { name: true, email: true } } } } },
  });

  if (!household) return NextResponse.json({ error: "Ese código de invitación no existe" }, { status: 404 });

  const alreadyMember = household.members.some((m) => m.userId === session.user.id);

  return NextResponse.json({
    household: {
      id: household.id,
      name: household.name,
      members: household.members.map((m) => m.user.name || m.user.email),
    },
    alreadyMember,
  });
}

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { code } = await params;
  const household = await prisma.household.findUnique({ where: { inviteCode: code } });
  if (!household) return NextResponse.json({ error: "Ese código de invitación no existe" }, { status: 404 });

  // New joiners default to EDITOR -- can add/check items and manage
  // categories, but role changes (e.g. promoting someone, or read-only
  // VIEWER access) are an Ajustes-page action, not part of joining itself.
  await prisma.householdMember.upsert({
    where: { householdId_userId: { householdId: household.id, userId: session.user.id } },
    update: {},
    create: { householdId: household.id, userId: session.user.id, role: "EDITOR" },
  });

  return NextResponse.json({ ok: true, householdId: household.id });
}
