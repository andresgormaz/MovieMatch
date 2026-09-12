import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  // Scoped by userId too, not just id -- deleteMany silently matches zero
  // rows instead of throwing if the id belongs to someone else, so this
  // can't be used to delete another user's saved filter.
  await prisma.savedFilter.deleteMany({ where: { id, userId: session.user.id } });

  return NextResponse.json({ ok: true });
}
