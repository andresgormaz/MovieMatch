import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pickNextPair, recordPairWinner, ONBOARDING_ROUNDS } from "@/lib/onboardingPairs";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const roundsCompleted = await prisma.onboardingChoice.count({ where: { userId: session.user.id } });
  if (roundsCompleted >= ONBOARDING_ROUNDS) {
    return NextResponse.json({ pair: null, done: true });
  }

  const { searchParams } = new URL(request.url);
  const excludeIds = (searchParams.get("exclude") ?? "").split(",").filter(Boolean);

  const pair = await pickNextPair(session.user.id, excludeIds);
  return NextResponse.json({ pair, done: pair === null });
}

const bodySchema = z.object({
  titleAId: z.string().min(1),
  titleBId: z.string().min(1),
  winnerId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { titleAId, titleBId, winnerId } = parsed.data;
  if (winnerId !== titleAId && winnerId !== titleBId) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  await recordPairWinner(session.user.id, titleAId, titleBId, winnerId);

  return NextResponse.json({ ok: true });
}
