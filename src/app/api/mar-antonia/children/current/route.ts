import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// The client-side Inicio/Ajustes pages need a child id before they can call
// any of the /children/[id]/* endpoints, but (unlike a server-rendered page)
// they have no session-bound Prisma access of their own -- this is that
// bootstrap lookup. Also returns the caregiver list in the same query
// (rather than making the client fetch /children/[id]/caregivers as a
// second round trip) -- every request here is a network hop to Turso, not a
// local query, so cutting a round trip off the critical path matters more
// than it would against a local database.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const caregiver = await prisma.childCaregiver.findFirst({
    where: { userId: session.user.id },
    include: {
      child: {
        select: {
          id: true,
          name: true,
          inviteCode: true,
          ownerUserId: true,
          caregivers: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { joinedAt: "asc" },
          },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
  if (!caregiver) return NextResponse.json({ error: "No perteneces a ningún perfil" }, { status: 404 });

  const { caregivers, ...child } = caregiver.child;
  return NextResponse.json({
    child,
    caregivers: caregivers.map((c) => ({
      id: c.user.id,
      name: c.user.name,
      email: c.user.email,
      role: c.role,
      // No SessionProvider wraps this app for a client component to read its
      // own user id via useSession() -- this flag is how the quick-log
      // panel knows which pill to default to instead.
      isYou: c.user.id === session.user.id,
    })),
  });
}
