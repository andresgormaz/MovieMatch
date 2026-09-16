import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// The client-side Ajustes page needs a household id before it can call any
// of the /households/[id]/* endpoints, but (unlike the server-rendered
// Inicio page) it has no session-bound Prisma access of its own -- this is
// that bootstrap lookup. Mirrors mi-super/(guarded)/layout.tsx's "first
// membership" scoping (Fase 1 only ever guides a user through one
// household).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const membership = await prisma.householdMember.findFirst({
    where: { userId: session.user.id },
    include: { household: { select: { id: true, name: true, inviteCode: true, ownerUserId: true } } },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) return NextResponse.json({ error: "No perteneces a ningún hogar" }, { status: 404 });

  return NextResponse.json({ household: membership.household });
}
