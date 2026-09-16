import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireHouseholdMember, authzErrorResponse } from "@/lib/miSuper/authz";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    await requireHouseholdMember(session.user.id, id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const members = await prisma.householdMember.findMany({
    where: { householdId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json({
    members: members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role })),
  });
}
