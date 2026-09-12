import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      inviteCode: g.inviteCode,
      ownerId: g.ownerId,
      members: g.members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email })),
    })),
  });
}

const createSchema = z.object({ name: z.string().trim().max(80).optional() });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name || null,
      ownerId: session.user.id,
      members: { create: { userId: session.user.id } },
    },
  });

  return NextResponse.json({ group }, { status: 201 });
}
