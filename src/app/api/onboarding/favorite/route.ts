import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordFavorite } from "@/lib/onboardingPairs";

const bodySchema = z.object({ titleId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const title = await prisma.title.findUnique({ where: { id: parsed.data.titleId }, select: { id: true } });
  if (!title) return NextResponse.json({ error: "No encontramos ese título" }, { status: 404 });

  await recordFavorite(session.user.id, parsed.data.titleId);

  return NextResponse.json({ ok: true });
}
