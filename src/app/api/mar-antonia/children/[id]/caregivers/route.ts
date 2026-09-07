import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireChildCaregiver, authzErrorResponse } from "@/lib/marAntonia/authz";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    await requireChildCaregiver(session.user.id, id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const caregivers = await prisma.childCaregiver.findMany({
    where: { childId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json({
    caregivers: caregivers.map((c) => ({ id: c.user.id, name: c.user.name, email: c.user.email, role: c.role })),
  });
}
