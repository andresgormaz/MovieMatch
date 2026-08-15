import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { code } = await params;
  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    include: { members: { include: { user: { select: { name: true, email: true } } } } },
  });

  if (!group) return NextResponse.json({ error: "Ese código de invitación no existe" }, { status: 404 });

  const alreadyMember = group.members.some((m) => m.userId === session.user.id);

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      members: group.members.map((m) => m.user.name || m.user.email),
    },
    alreadyMember,
  });
}

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { code } = await params;
  const group = await prisma.group.findUnique({ where: { inviteCode: code } });
  if (!group) return NextResponse.json({ error: "Ese código de invitación no existe" }, { status: 404 });

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: session.user.id } },
    update: {},
    create: { groupId: group.id, userId: session.user.id },
  });

  return NextResponse.json({ ok: true, groupId: group.id });
}
