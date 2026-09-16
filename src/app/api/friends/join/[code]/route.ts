import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { areFriends, orderedPair } from "@/lib/friends";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { code } = await params;
  const owner = await prisma.user.findUnique({ where: { friendCode: code }, select: { id: true, name: true, email: true } });
  if (!owner) return NextResponse.json({ error: "Ese código de invitación no existe" }, { status: 404 });

  if (owner.id === session.user.id) {
    return NextResponse.json({ error: "Ese es tu propio código de invitación" }, { status: 400 });
  }

  const alreadyFriends = await areFriends(session.user.id, owner.id);

  return NextResponse.json({
    person: { name: owner.name || owner.email },
    alreadyFriends,
  });
}

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { code } = await params;
  const owner = await prisma.user.findUnique({ where: { friendCode: code }, select: { id: true } });
  if (!owner) return NextResponse.json({ error: "Ese código de invitación no existe" }, { status: 404 });
  if (owner.id === session.user.id) {
    return NextResponse.json({ error: "Ese es tu propio código de invitación" }, { status: 400 });
  }

  const [userAId, userBId] = orderedPair(session.user.id, owner.id);
  await prisma.friendship.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    update: {},
    create: { userAId, userBId },
  });

  return NextResponse.json({ ok: true });
}
