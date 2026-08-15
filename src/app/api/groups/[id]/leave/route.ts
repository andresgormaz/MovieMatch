import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  await prisma.groupMember.deleteMany({ where: { groupId: id, userId: session.user.id } });

  const remaining = await prisma.groupMember.count({ where: { groupId: id } });
  if (remaining === 0) {
    await prisma.group.deleteMany({ where: { id } });
  }

  return NextResponse.json({ ok: true });
}
