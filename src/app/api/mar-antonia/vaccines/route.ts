import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAnyChild, authzErrorResponse } from "@/lib/marAntonia/authz";

const CAREGIVER_SELECT = { id: true, name: true, email: true } as const;

// The vaccine catalog itself (Chile's PNI schedule) is static content living
// in src/lib/marAntonia/vaccineSchedule.ts, not the database -- the client
// imports it directly and merges it with these rows client-side. This only
// returns which doses have actually been marked as given for this child.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let caregiver;
  try {
    caregiver = await requireAnyChild(session.user.id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const doses = await prisma.childVaccineDose.findMany({
    where: { childId: caregiver.childId },
    include: { caregiver: { select: CAREGIVER_SELECT } },
  });

  return NextResponse.json({ doses });
}
