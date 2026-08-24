import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { areFriends } from "@/lib/friends";

const schema = z.object({ friendId: z.string().min(1), titleId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const { friendId, titleId } = parsed.data;

  if (!(await areFriends(session.user.id, friendId))) {
    return NextResponse.json({ error: "No son amigos" }, { status: 403 });
  }

  const title = await prisma.title.findUnique({ where: { id: titleId }, select: { id: true } });
  if (!title) return NextResponse.json({ error: "Título no encontrado" }, { status: 404 });

  await prisma.sentRecommendation.create({
    data: { fromUserId: session.user.id, toUserId: friendId, titleId },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
