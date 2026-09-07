import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// The client-side Ajustes page needs a child id before it can call any of
// the /children/[id]/* endpoints, but (unlike a server-rendered page) it has
// no session-bound Prisma access of its own -- this is that bootstrap
// lookup. Mirrors /api/mi-super/households/current's shape.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const caregiver = await prisma.childCaregiver.findFirst({
    where: { userId: session.user.id },
    include: { child: { select: { id: true, name: true, inviteCode: true, ownerUserId: true } } },
    orderBy: { joinedAt: "asc" },
  });
  if (!caregiver) return NextResponse.json({ error: "No perteneces a ningún perfil" }, { status: 404 });

  return NextResponse.json({ child: caregiver.child });
}
