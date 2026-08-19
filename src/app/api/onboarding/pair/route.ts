import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pickNextPair, recordPairWinner, recordNotSeen, recordBothNotSeen, ONBOARDING_ROUNDS } from "@/lib/onboardingPairs";
import { prisma } from "@/lib/prisma";

// Candidate selection runs several sequential per-genre queries (bounded,
// but still real DB round-trips) plus a possible second pass with a widened
// pool -- give it real headroom above the platform default instead of
// risking a mid-request timeout.
export const maxDuration = 30;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  // The initial onboarding flow caps at ONBOARDING_ROUNDS; the ongoing /vs
  // page (for refining taste after onboarding) keeps going indefinitely.
  const unlimited = searchParams.get("unlimited") === "1";
  if (!unlimited) {
    const roundsCompleted = await prisma.onboardingChoice.count({
      where: { userId: session.user.id, skipped: false },
    });
    if (roundsCompleted >= ONBOARDING_ROUNDS) {
      return NextResponse.json({ pair: null, done: true });
    }
  }

  const excludeIds = (searchParams.get("exclude") ?? "").split(",").filter(Boolean);
  // Present while mid-swap ("no la he visto" on one of the two options):
  // keeps that side in place and only picks a fresh candidate for the other.
  const keepId = searchParams.get("keep") || undefined;

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { country: true } });
  try {
    const pair = await pickNextPair(session.user.id, excludeIds, user?.country ?? null, keepId);
    return NextResponse.json({ pair, done: pair === null });
  } catch (err) {
    // Without this, an exception here becomes Next.js's default HTML error
    // page instead of JSON -- the client's res.json() then throws its own
    // (unrelated-looking) parse error, hiding the real cause. Surface it.
    console.error("GET /api/onboarding/pair failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
}

const bodySchema = z.object({
  titleAId: z.string().min(1),
  titleBId: z.string().min(1),
  winnerId: z.string().min(1).optional(),
  // The id of whichever side got "No la he visto" -- mutually exclusive
  // with winnerId and bothNotSeen.
  notSeenId: z.string().min(1).optional(),
  // "No vi ninguna de las dos" -- mutually exclusive with the above two.
  bothNotSeen: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { titleAId, titleBId, winnerId, notSeenId, bothNotSeen } = parsed.data;

  if (bothNotSeen) {
    await recordBothNotSeen(session.user.id, titleAId, titleBId);
    return NextResponse.json({ ok: true });
  }

  if (notSeenId !== undefined) {
    if (notSeenId !== titleAId && notSeenId !== titleBId) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    await recordNotSeen(session.user.id, notSeenId);
    return NextResponse.json({ ok: true });
  }

  if (winnerId === undefined || (winnerId !== titleAId && winnerId !== titleBId)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  await recordPairWinner(session.user.id, titleAId, titleBId, winnerId);

  return NextResponse.json({ ok: true });
}
